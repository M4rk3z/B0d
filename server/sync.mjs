import { randomUUID, randomBytes, randomInt, createHash } from 'node:crypto';
const digest = value => createHash('sha256').update(value).digest('hex');
function check(ok, status, message) { if (!ok) { const error = new Error(message); error.status = status; throw error; } }
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function deviceRoute(pool, req, path, input) {
 const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')?.[1];
 check(token, 401, 'Vincula la tablet desde la web');
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  const device = (await client.query('SELECT id FROM b0d_devices WHERE token_hash=$1 AND active FOR UPDATE', [digest(token)])).rows[0];
  check(device, 401, 'Vinculación revocada o inválida');
  let result;
  if (req.method === 'GET' && path === '/api/device/workers') {
   result = { deviceId: device.id, workers: (await client.query('SELECT id,code,name,active FROM b0d_workers ORDER BY code')).rows };
  } else if (req.method === 'POST' && path === '/api/device/worker') {
   check(uuid(input?.id) && typeof input.code === 'string' && /^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(input.code) && typeof input.name === 'string' && input.name.trim().length > 0 && input.name.length <= 100 && !/[\x00-\x1f\x7f]/.test(input.name) && typeof input.active === 'boolean', 400, 'Colaborador inválido');
   let worker = (await client.query('SELECT w.id,w.code,w.name,w.active FROM b0d_device_workers m JOIN b0d_workers w ON w.id=m.worker_id WHERE m.device_id=$1 AND m.local_id=$2', [device.id,input.id])).rows[0];
   if (!worker) {
    await client.query('INSERT INTO b0d_workers(id,code,name,active) VALUES($1,$2,$3,$4) ON CONFLICT(code) DO NOTHING', [randomUUID(),input.code,input.name.trim(),input.active]);
    worker = (await client.query('SELECT id,code,name,active FROM b0d_workers WHERE code=$1', [input.code])).rows[0];
    check(worker.name === input.name.trim(), 409, `Conflicto de colaborador: ${input.code}. Revisa el nombre en web y tablet.`);
    await client.query('INSERT INTO b0d_device_workers(device_id,local_id,worker_id) VALUES($1,$2,$3)', [device.id,input.id,worker.id]);
   }
   result = worker;
  } else if (req.method === 'POST' && path === '/api/device/punch') {
   check(uuid(input?.eventId) && uuid(input.workerId) && ['IN','OUT','BREAK_START','BREAK_END'].includes(input.kind) && ['manual','facial'].includes(input.method) && Number.isSafeInteger(input.time) && input.time > 0 && input.time <= Date.now()+86400000 && typeof input.zone === 'string' && input.zone.length <= 100 && (input.action === null || ['IN','OUT','MEAL','REST'].includes(input.action)), 400, 'Marcación inválida');
   try { new Intl.DateTimeFormat('en', { timeZone: input.zone }); } catch { check(false, 400, 'Zona horaria inválida'); }
   check(typeof input.code === 'string' && /^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(input.code) && typeof input.name === 'string' && input.name.length > 0 && input.name.length <= 100, 400, 'Datos históricos inválidos');
   const worker = (await client.query('SELECT worker_id FROM b0d_device_workers WHERE device_id=$1 AND local_id=$2', [device.id,input.workerId])).rows[0];
   check(worker, 409, 'Sincroniza primero al colaborador');
   const values = [input.eventId,worker.worker_id,device.id,input.code,input.name,input.kind,input.time,input.zone,input.method,input.action];
   await client.query('INSERT INTO b0d_punches(event_id,worker_id,device_id,worker_code,worker_name,kind,occurred_at,zone_id,method,action) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(event_id) DO NOTHING', values);
   const saved = (await client.query('SELECT * FROM b0d_punches WHERE event_id=$1', [input.eventId])).rows[0];
   check(saved.worker_id === worker.worker_id && saved.worker_code === input.code && saved.worker_name === input.name && saved.kind === input.kind && Number(saved.occurred_at) === input.time && saved.zone_id === input.zone && saved.method === input.method && saved.action === input.action, 409, 'El identificador ya tiene otros datos; registro conservado');
   result = { eventId: input.eventId, stored: true };
  } else check(false, 404, 'Ruta no disponible');
  await client.query('UPDATE b0d_devices SET last_seen=now() WHERE id=$1', [device.id]);
  await client.query('COMMIT'); return result;
 } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export async function manageDevices(pool, req, path, current, input) {
 check(current.role === 'Admin', 403, 'Solo administradores');
 if (path === '/api/devices' && req.method === 'GET') return (await pool.query('SELECT id,name,active,last_seen FROM b0d_devices ORDER BY created_at DESC')).rows;
 if (path === '/api/devices' && req.method === 'POST') {
  check(typeof input?.name === 'string' && input.name.trim().length > 0 && input.name.length <= 80, 400, 'Nombre requerido (máximo 80 caracteres)');
  const token = randomBytes(32).toString('hex'); const id = randomUUID();
  const code = String(randomInt(0,100000000)).padStart(8,'0');
  const client = await pool.connect();
  try {
   await client.query('BEGIN');
   await client.query('DELETE FROM b0d_pairing WHERE expires_at<=now()');
   await client.query('INSERT INTO b0d_devices(id,name,token_hash) VALUES($1,$2,$3)', [id,input.name.trim(),digest(token)]);
   await client.query("INSERT INTO b0d_pairing VALUES($1,$2,now()+interval '10 minutes')", [digest(code),id]);
   await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  return { id, code, expiresIn: 600 };
 }
 const id = path.slice('/api/devices/'.length);
 check(req.method === 'DELETE' && uuid(id), 400, 'Solicitud inválida');
 await pool.query('UPDATE b0d_devices SET active=false WHERE id=$1', [id]); return { ok: true };
}
export async function redeemPairing(pool, input) {
 const code = typeof input?.code === 'string' ? input.code.replace(/[ -]/g,'') : '';
 check(/^\d{8}$/.test(code),400,'Escribe el código de 8 dígitos');
 const client = await pool.connect(); let result, limited = false;
 try {
  await client.query('BEGIN');
  const guard = (await client.query("SELECT *,window_start<=now()-interval '1 minute' AS expired FROM b0d_pair_guard WHERE id=1 FOR UPDATE")).rows[0];
  if (!guard.expired && guard.attempts>=5) limited = true;
  else {
   await client.query('UPDATE b0d_pair_guard SET attempts=$1,window_start=CASE WHEN $2 THEN now() ELSE window_start END WHERE id=1', [guard.expired?1:guard.attempts+1,guard.expired]);
   const pair = (await client.query('SELECT p.device_id FROM b0d_pairing p JOIN b0d_devices d ON d.id=p.device_id WHERE p.code_hash=$1 AND p.expires_at>now() AND d.active FOR UPDATE OF p,d',[digest(code)])).rows[0];
   if (pair) {
    const token=randomBytes(32).toString('hex');
    await client.query('UPDATE b0d_devices SET token_hash=$1 WHERE id=$2',[digest(token),pair.device_id]);
    await client.query('DELETE FROM b0d_pairing WHERE code_hash=$1',[digest(code)]);
    result={token,deviceId:pair.device_id};
   }
  }
  await client.query('COMMIT');
 } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
 check(!limited,429,'Espera un minuto antes de volver a intentar');
 check(result,401,'Código inválido, vencido o ya utilizado. Genera uno nuevo en la web');
 return result;
}
