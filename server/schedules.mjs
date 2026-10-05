import { randomUUID } from 'node:crypto';
import { validateSchedule } from './public/schedule-rules.js';
export async function scheduleRoute(pool, req, path, current, input) {
 const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
 if(current.role!=='Admin' && !(['GET','PATCH'].includes(req.method) || (req.method==='POST' && path==='/api/schedule-assignments'))) fail(403,'Solo administradores');
 if(path==='/api/schedule-assignments') {
  if(req.method==='GET') return (await pool.query("SELECT a.id,a.worker_id,a.schedule_id,a.revision,to_char(a.effective_date,'YYYY-MM-DD') AS effective_date,v.definition->>'name' AS name FROM b0d_schedule_assignments a JOIN b0d_schedule_versions v ON v.schedule_id=a.schedule_id AND v.revision=a.revision ORDER BY effective_date DESC")).rows;
  if(req.method!=='POST' || !/^[a-f0-9-]{36}$/.test(input?.workerId||'') || !/^[a-f0-9-]{36}$/.test(input?.scheduleId||'') || !/^\d{4}-\d{2}-\d{2}$/.test(input?.date||'')) fail(400,'AsignaciÃ³n invÃ¡lida');
  const parsed=new Date(input.date+'T00:00:00Z');
  if(!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==input.date) fail(400,'Fecha invÃ¡lida');
  const client=await pool.connect();
  try {
   await client.query('BEGIN');
   const schedule=(await client.query('SELECT revision,definition FROM b0d_schedules WHERE id=$1 AND NOT deleted FOR UPDATE',[input.scheduleId])).rows[0];
   if(!schedule) fail(404,'Horario no encontrado');
   const allowed=(await client.query("SELECT $1::date > (now() AT TIME ZONE $2)::date AS ok",[input.date,schedule.definition.zone])).rows[0].ok;
   if(!allowed) fail(400,'Elige una fecha a partir de maÃ±ana para conservar las jornadas iniciadas');
   const worker=(await client.query('SELECT id FROM b0d_workers WHERE id=$1 AND active FOR UPDATE',[input.workerId])).rows[0];
   if(!worker) fail(400,'Colaborador no disponible');
   const id=randomUUID();
   await client.query('INSERT INTO b0d_schedule_assignments(id,worker_id,schedule_id,revision,effective_date) VALUES($1,$2,$3,$4,$5) ON CONFLICT(worker_id,effective_date) DO UPDATE SET id=excluded.id,schedule_id=excluded.schedule_id,revision=excluded.revision,created_at=now()',[id,input.workerId,input.scheduleId,schedule.revision,input.date]);
   await client.query('COMMIT');return {id};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 if(req.method==='GET' && path==='/api/schedules') return (await pool.query("SELECT id,revision,definition,updated_at FROM b0d_schedules WHERE NOT deleted ORDER BY definition->>'name',id")).rows;
 const creating=req.method==='POST' && path==='/api/schedules';
 const id=creating?randomUUID():path.slice('/api/schedules/'.length);
 if(req.method==='DELETE' && /^[a-f0-9-]{36}$/.test(id)) {await pool.query('UPDATE b0d_schedules SET deleted=true WHERE id=$1',[id]);return {ok:true};}
 if(!creating && (req.method!=='PATCH' || !/^[a-f0-9-]{36}$/.test(id))) fail(400,'Horario invÃ¡lido');
 let definition;
 try { definition=validateSchedule(input); } catch(error) { fail(400,error.message); }
 if(!creating && (!Number.isInteger(input.revision) || input.revision<1)) fail(400,'VersiÃ³n invÃ¡lida');
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  let revision=1;
  if(creating) await client.query('INSERT INTO b0d_schedules(id,revision,definition) VALUES($1,1,$2)',[id,JSON.stringify(definition)]);
  else {
   const current=(await client.query('SELECT revision FROM b0d_schedules WHERE id=$1 AND NOT deleted FOR UPDATE',[id])).rows[0];
   if(!current) fail(404,'Horario no encontrado');
   if(current.revision!==input.revision) fail(409,'Otra persona modificÃ³ este horario. Vuelve a seleccionarlo para cargar sus cambios');
   revision=current.revision+1;
   await client.query('UPDATE b0d_schedules SET revision=$2,definition=$3,updated_at=now() WHERE id=$1',[id,revision,JSON.stringify(definition)]);
  }
  await client.query('INSERT INTO b0d_schedule_versions(schedule_id,revision,definition,actor_id) VALUES($1,$2,$3,$4)',[id,revision,JSON.stringify(definition),current.id]);
  await client.query('COMMIT'); return {id,revision,definition};
 } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
