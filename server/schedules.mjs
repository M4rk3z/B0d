import { randomUUID } from 'node:crypto';
import { validateSchedule } from './public/schedule-rules.js';
export async function scheduleRoute(pool, req, path, current, input) {
 const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
 if(current.role!=='Admin') fail(403,'Solo administradores');
 if(req.method==='GET' && path==='/api/schedules') return (await pool.query("SELECT id,revision,definition,updated_at FROM b0d_schedules ORDER BY definition->>'name',id")).rows;
 const creating=req.method==='POST' && path==='/api/schedules';
 const id=creating?randomUUID():path.slice('/api/schedules/'.length);
 if(!creating && (req.method!=='PATCH' || !/^[a-f0-9-]{36}$/.test(id))) fail(400,'Horario inválido');
 let definition;
 try { definition=validateSchedule(input); } catch(error) { fail(400,error.message); }
 if(!creating && (!Number.isInteger(input.revision) || input.revision<1)) fail(400,'Versión inválida');
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  let revision=1;
  if(creating) await client.query('INSERT INTO b0d_schedules(id,revision,definition) VALUES($1,1,$2)',[id,JSON.stringify(definition)]);
  else {
   const current=(await client.query('SELECT revision FROM b0d_schedules WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!current) fail(404,'Horario no encontrado');
   if(current.revision!==input.revision) fail(409,'Otra persona modificó este horario. Vuelve a seleccionarlo para cargar sus cambios');
   revision=current.revision+1;
   await client.query('UPDATE b0d_schedules SET revision=$2,definition=$3,updated_at=now() WHERE id=$1',[id,revision,JSON.stringify(definition)]);
  }
  await client.query('INSERT INTO b0d_schedule_versions(schedule_id,revision,definition,actor_id) VALUES($1,$2,$3,$4)',[id,revision,JSON.stringify(definition),current.id]);
  await client.query('COMMIT'); return {id,revision,definition};
 } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
