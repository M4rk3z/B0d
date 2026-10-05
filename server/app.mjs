import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const hash = value => createHash('sha256').update(value).digest('hex');
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const requireValue = (ok, message) => { if (!ok) throw new HttpError(400, message); };
async function body(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new HttpError(415, 'Se requiere JSON');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 16384) throw new HttpError(413, 'Solicitud demasiado grande'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'JSON inválido'); }
}
export function workerFields(input) {
  requireValue(input && typeof input.code === 'string' && typeof input.name === 'string', 'Código y nombre requeridos');
  const code = input.code.trim().toUpperCase(); const name = input.name.trim().replace(/\s+/gu, ' ');
  requireValue(/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(code), 'Código inválido');
  requireValue(name.length > 0 && name.length <= 100 && !/[\x00-\x1f\x7f]/u.test(name), 'Nombre inválido');
  return { code, name };
}
export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(80405001)');
    await client.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    const version = (await client.query('SELECT max(version) AS version FROM b0d_schema_version')).rows[0].version;
    if (version !== 1) throw new Error('Unsupported database version');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export function createApplication(pool, { origin, adminUser, adminPassword }) {
  if (!adminUser || !adminPassword || adminPassword.length < 12) throw new Error('Configure ADMIN_USER y ADMIN_PASSWORD (mínimo 12 caracteres)');
  const url = new URL(origin);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('PUBLIC_URL requiere HTTPS');
  origin = url.origin;
  const salt = randomBytes(16), passwordHash = scryptSync(adminPassword, salt, 32);
  const secure = url.protocol === 'https:';
  const cookie = (token, age) => `b0d_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
  async function session(req) {
    const token = /(?:^|;\s*)b0d_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!token) throw new HttpError(401, 'Inicia sesión');
    const result = await pool.query('SELECT 1 FROM b0d_sessions WHERE token_hash=$1 AND expires_at>now()', [hash(token)]);
    if (!result.rows.length) throw new HttpError(401, 'La sesión terminó');
    return hash(token);
  }
  const assets = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
    '/styles.css': ['styles.css', 'text/css; charset=utf-8']
  };
  return createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store');
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const path = new URL(req.url, origin).pathname;
      if (req.method === 'GET' && assets[path]) {
        const [file, type] = assets[path]; res.setHeader('Content-Type', type);
        res.end(await readFile(new URL(`./public/${file}`, import.meta.url))); return;
      }
      if (req.method === 'GET' && path === '/healthz') { await pool.query('SELECT 1'); json(200, { status: 'ok', stage: 'cloud-foundation' }); return; }
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) throw new HttpError(403, 'Origen no permitido');
      if (req.method === 'POST' && path === '/api/login') {
        const input = await body(req);
        requireValue(typeof input?.user === 'string' && typeof input?.password === 'string' && input.password.length <= 256, 'Credenciales inválidas');
        const client = await pool.connect(); let token, rejected = false, locked = false;
        try {
          await client.query('BEGIN');
          const guard = (await client.query('SELECT *, locked_until>now() AS locked FROM b0d_login_guard WHERE id=1 FOR UPDATE')).rows[0];
          if (guard.locked) locked = true;
          else {
            const valid = timingSafeEqual(scryptSync(input.password, salt, 32), passwordHash) && input.user === adminUser;
            if (!valid) {
              rejected = true;
              const failures = guard.locked_until ? 1 : guard.failures + 1;
              await client.query("UPDATE b0d_login_guard SET failures=$1, locked_until=CASE WHEN $1>=5 THEN now()+interval '5 minutes' ELSE NULL END WHERE id=1", [failures]);
            } else {
              token = randomBytes(32).toString('hex');
              await client.query('UPDATE b0d_login_guard SET failures=0,locked_until=NULL WHERE id=1');
              await client.query('DELETE FROM b0d_sessions WHERE expires_at<=now()');
              await client.query("INSERT INTO b0d_sessions VALUES($1,now()+interval '30 minutes')", [hash(token)]);
            }
          }
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
        if (locked) throw new HttpError(429, 'Acceso bloqueado temporalmente');
        if (rejected) throw new HttpError(401, 'Credenciales incorrectas');
        res.setHeader('Set-Cookie', cookie(token, 1800)); json(200, { ok: true }); return;
      }
      const tokenHash = await session(req);
      if (req.method === 'POST' && path === '/api/logout') {
        await pool.query('DELETE FROM b0d_sessions WHERE token_hash=$1', [tokenHash]); res.setHeader('Set-Cookie', cookie('', 0)); json(200, { ok: true }); return;
      }
      if (req.method === 'GET' && path === '/api/workers') {
        json(200, (await pool.query('SELECT id,code,name,active FROM b0d_workers ORDER BY active DESC,name,code')).rows); return;
      }
      if (req.method === 'POST' && path === '/api/workers') {
        const { code, name } = workerFields(await body(req)); const id = randomUUID();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('INSERT INTO b0d_workers(id,code,name) VALUES($1,$2,$3)', [id, code, name]);
          await client.query("INSERT INTO b0d_audit(worker_id,action) VALUES($1,'created')", [id]);
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
        json(201, { id, code, name, active: true }); return;
      }
      throw new HttpError(404, 'Ruta no disponible en esta fase');
    } catch (error) {
      if (!res.headersSent) json(error.code === '23505' ? 409 : error.status || 500,
        { error: error.code === '23505' ? 'El código ya existe' : error.status ? error.message : 'No se pudo completar la operación' });
      else res.end();
    }
  });
}
