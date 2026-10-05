import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { deviceRoute, manageDevices } from './sync.mjs';

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
    if (![1, 2, 3].includes(version)) throw new Error('Unsupported database version');
    await client.query(await readFile(new URL('./users.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('./sync.sql', import.meta.url), 'utf8'));
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function bootstrapAdmin(pool, adminUser, adminPassword) {
  if (!adminUser || !adminPassword || adminPassword.length < 12) throw new Error('Configure ADMIN_USER y ADMIN_PASSWORD (mínimo 12 caracteres)');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(80405002)');
    if (!(await client.query('SELECT 1 FROM b0d_users LIMIT 1')).rows.length) {
      const salt = randomBytes(16).toString('hex');
      await client.query("INSERT INTO b0d_users(id,username,role,salt,password_hash) VALUES($1,$2,'Admin',$3,$4)", [randomUUID(), adminUser, salt, scryptSync(adminPassword, salt, 32).toString('hex')]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export function createApplication(pool, { origin }) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('PUBLIC_URL requiere HTTPS');
  origin = url.origin;
  const dummySalt = randomBytes(16).toString('hex');
  const secure = url.protocol === 'https:';
  const cookie = (token, age) => `b0d_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
  async function session(req) {
    const token = /(?:^|;\s*)b0d_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!token) throw new HttpError(401, 'Inicia sesión');
    const result = await pool.query('SELECT u.id,u.username,u.role FROM b0d_sessions s JOIN b0d_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active', [hash(token)]);
    if (!result.rows.length) throw new HttpError(401, 'La sesión terminó');
    return { ...result.rows[0], tokenHash: hash(token) };
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
      if (req.method === 'GET' && path === '/healthz') { await pool.query('SELECT 1'); json(200, { status: 'ok', stage: 'tablet-sync-v1' }); return; }
      if (path.startsWith('/api/device/')) {
        json(200, await deviceRoute(pool, req, path, req.method === 'POST' ? await body(req) : null)); return;
      }
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
            const account = (await client.query('SELECT * FROM b0d_users WHERE lower(username)=lower($1)', [input.user.trim()])).rows[0];
            const candidate = scryptSync(input.password, account?.salt || dummySalt, 32);
            const valid = timingSafeEqual(candidate, account ? Buffer.from(account.password_hash, 'hex') : Buffer.alloc(32)) && account?.active;
            if (!valid) {
              rejected = true;
              const failures = guard.locked_until ? 1 : guard.failures + 1;
              await client.query("UPDATE b0d_login_guard SET failures=$1, locked_until=CASE WHEN $1>=5 THEN now()+interval '5 minutes' ELSE NULL END WHERE id=1", [failures]);
            } else {
              token = randomBytes(32).toString('hex');
              await client.query('UPDATE b0d_login_guard SET failures=0,locked_until=NULL WHERE id=1');
              await client.query('DELETE FROM b0d_sessions WHERE expires_at<=now()');
              await client.query("INSERT INTO b0d_sessions(token_hash,expires_at,user_id) VALUES($1,now()+interval '30 minutes',$2)", [hash(token), account.id]);
            }
          }
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
        if (locked) throw new HttpError(429, 'Acceso bloqueado temporalmente');
        if (rejected) throw new HttpError(401, 'Credenciales incorrectas');
        res.setHeader('Set-Cookie', cookie(token, 1800)); json(200, { ok: true }); return;
      }
      const current = await session(req);
      const { tokenHash } = current;
      if (path === '/api/devices' || path.startsWith('/api/devices/')) {
        json(200, await manageDevices(pool, req, path, current, req.method === 'POST' ? await body(req) : null)); return;
      }
      if (req.method === 'GET' && path === '/api/punches') {
        const params = new URL(req.url, origin).searchParams;
        const offset = Number(params.get('offset') || 0);
        requireValue(Number.isSafeInteger(offset) && offset >= 0, 'Página inválida');
        const rows = (await pool.query('SELECT event_id,worker_code,worker_name,kind,occurred_at,zone_id,method,action FROM b0d_punches ORDER BY occurred_at,event_id LIMIT 501 OFFSET $1', [offset])).rows;
        json(200, { rows: rows.slice(0,500), next: rows.length > 500 ? offset+500 : null }); return;
      }
      const requireAdmin = () => { if (current.role !== 'Admin') throw new HttpError(403, 'Solo administradores'); };
      if (req.method === 'GET' && path === '/api/me') { json(200, { id: current.id, username: current.username, role: current.role }); return; }
      if (path === '/api/users' && req.method === 'GET') {
        requireAdmin(); json(200, (await pool.query('SELECT id,username,role,active FROM b0d_users ORDER BY username')).rows); return;
      }
      if (path === '/api/users' && req.method === 'POST') {
        const input = await body(req);
        requireValue(typeof input?.username === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.@-]{2,99}$/.test(input.username.trim()), 'Usuario: entre 3 y 100 caracteres, sin espacios');
        requireValue(['Admin', 'User'].includes(input.role), 'Rol inválido');
        if (current.role !== 'Admin' && input.role !== 'User') throw new HttpError(403, 'Solo Admin puede crear administradores');
        requireValue(typeof input.password === 'string' && input.password.length >= 12 && input.password.length <= 256, 'Contraseña: entre 12 y 256 caracteres');
        const salt = randomBytes(16).toString('hex');
        const result = await pool.query('INSERT INTO b0d_users(id,username,role,salt,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id,username,role,active', [randomUUID(), input.username.trim(), input.role, salt, scryptSync(input.password, salt, 32).toString('hex')]);
        json(201, result.rows[0]); return;
      }
      if (path.startsWith('/api/users/') && req.method === 'PATCH') {
        requireAdmin(); const id = path.slice('/api/users/'.length); const input = await body(req);
        requireValue(/^[a-f0-9-]{36}$/.test(id) && input && ['Admin', 'User'].includes(input.role) && typeof input.active === 'boolean', 'Datos inválidos');
        requireValue(input.password === undefined || (typeof input.password === 'string' && input.password.length >= 12 && input.password.length <= 256), 'Contraseña: entre 12 y 256 caracteres');
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SELECT pg_advisory_xact_lock(80405002)');
          const actor = (await client.query('SELECT role,active FROM b0d_users WHERE id=$1', [current.id])).rows[0];
          if (!actor?.active || actor.role !== 'Admin') throw new HttpError(403, 'Solo administradores');
          const target = (await client.query('SELECT * FROM b0d_users WHERE id=$1', [id])).rows[0];
          if (!target) throw new HttpError(404, 'Usuario no encontrado');
          if (target.active && target.role === 'Admin' && (!input.active || input.role !== 'Admin')) {
            const count = (await client.query("SELECT count(*) AS total FROM b0d_users WHERE active AND role='Admin'")).rows[0].total;
            if (Number(count) <= 1) throw new HttpError(409, 'Debe quedar al menos un administrador activo');
          }
          const salt = input.password ? randomBytes(16).toString('hex') : target.salt;
          const passwordHash = input.password ? scryptSync(input.password, salt, 32).toString('hex') : target.password_hash;
          await client.query('UPDATE b0d_users SET role=$2,active=$3,salt=$4,password_hash=$5 WHERE id=$1', [id, input.role, input.active, salt, passwordHash]);
          await client.query('DELETE FROM b0d_sessions WHERE user_id=$1', [id]);
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
        json(200, { ok: true }); return;
      }
      if (req.method === 'POST' && path === '/api/logout') {
        await pool.query('DELETE FROM b0d_sessions WHERE token_hash=$1', [tokenHash]); res.setHeader('Set-Cookie', cookie('', 0)); json(200, { ok: true }); return;
      }
      if (req.method === 'GET' && path === '/api/workers') {
        json(200, (await pool.query('SELECT id,code,name,active FROM b0d_workers ORDER BY active DESC,name,code')).rows); return;
      }
      if (req.method === 'POST' && path === '/api/workers') {
        requireAdmin();
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
      if (req.method === 'PATCH' && path.startsWith('/api/workers/')) {
        requireAdmin(); const id = path.slice('/api/workers/'.length); const input = await body(req);
        requireValue(/^[a-f0-9-]{36}$/.test(id) && typeof input?.active === 'boolean', 'Estado inválido');
        if (!input.active) {
          const last = (await pool.query('SELECT kind FROM b0d_punches WHERE worker_id=$1 ORDER BY occurred_at DESC,event_id DESC LIMIT 1', [id])).rows[0];
          if (last && last.kind !== 'OUT') throw new HttpError(409, 'Registra y sincroniza la salida antes de desactivar');
        }
        const result = await pool.query('UPDATE b0d_workers SET active=$2,updated_at=now() WHERE id=$1 RETURNING id,code,name,active', [id,input.active]);
        if (!result.rows.length) throw new HttpError(404, 'Colaborador no encontrado');
        json(200,result.rows[0]); return;
      }
      throw new HttpError(404, 'Ruta no disponible en esta fase');
    } catch (error) {
      if (!res.headersSent) json(error.code === '23505' ? 409 : error.status || 500,
        { error: error.code === '23505' ? 'El código o usuario ya existe' : error.status ? error.message : 'No se pudo completar la operación' });
      else res.end();
    }
  });
}
