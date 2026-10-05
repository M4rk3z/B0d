import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate,bootstrapAdmin } from '../app.mjs';
import { scheduleRoute } from '../schedules.mjs';
import { validateSchedule } from '../public/schedule-rules.js';
import { createHash,randomUUID } from 'node:crypto';
import { deviceRoute } from '../sync.mjs';
const base=()=>({name:'Mañana',zone:'America/Mexico_City',markBreaks:false,days:[{weekday:1,start:'08:00',end:'17:00',breaks:[{kind:'Comida',start:'13:00',end:'14:00'}]}]});
test('horas efectivas y modo de marcación',()=>{
 const value=validateSchedule(base());assert.equal(value.weeklyMinutes,480);assert.equal(value.days[0].effectiveMinutes,480);
 assert.equal(validateSchedule({...base(),markBreaks:true}).weeklyMinutes,480);
});
test('nocturno con descanso después de medianoche',()=>{
 const value=base();value.days=[{weekday:1,start:'22:00',end:'06:00',breaks:[{kind:'Descanso',start:'02:00',end:'02:30'}]}];
 const result=validateSchedule(value);assert.equal(result.weeklyMinutes,450);assert.equal(result.days[0].overnight,true);
});
test('rechaza solapamientos, descansos externos, días duplicados y 24 horas',()=>{
 const value=base();value.days[0].breaks.push({kind:'Descanso',start:'13:30',end:'14:30'});assert.throws(()=>validateSchedule(value),/superponerse/);
 value.days[0].breaks=[{kind:'Comida',start:'07:00',end:'08:00'}];assert.throws(()=>validateSchedule(value),/dentro/);
 value.days[0].breaks=[];value.days[0].end='08:00';assert.throws(()=>validateSchedule(value),/iguales/);
 value.days=[{weekday:7,start:'22:00',end:'09:00',breaks:[]},{weekday:1,start:'08:00',end:'17:00',breaks:[]}];assert.throws(()=>validateSchedule(value),/superpone/);
 value.days=[base().days[0],base().days[0]];assert.throws(()=>validateSchedule(value),/repetido/);
 assert.throws(()=>validateSchedule({...base(),days:[]}));
});
test('horarios persistentes con versiones y control de permisos',async()=>{
 const db=new PGlite();const pool={query:async(sql,args)=>sql.includes('CREATE TABLE')?(await db.exec(sql)).at(-1):db.query(sql,args),connect:async()=>({query:pool.query,release(){}})};
 try {
  await migrate(pool);await bootstrapAdmin(pool,'admin','admin-password-123');
  const admin=(await db.query('SELECT id,role FROM b0d_users')).rows[0];
  await assert.rejects(()=>scheduleRoute(pool,{method:'POST'},'/api/schedules',{...admin,role:'User'},base()),error=>error.status===403);
  const created=await scheduleRoute(pool,{method:'POST'},'/api/schedules',admin,base());assert.equal(created.revision,1);
  const workerId=randomUUID();await db.query('INSERT INTO b0d_workers(id,code,name) VALUES($1,$2,$3)',[workerId,'SCHED-1','Prueba']);
  const future=new Date(Date.now()+172800000).toISOString().slice(0,10);
  const assignment={workerId,scheduleId:created.id,date:future};
  await scheduleRoute(pool,{method:'POST'},'/api/schedule-assignments',admin,assignment);
  const today=(await db.query("SELECT to_char((now() AT TIME ZONE 'America/Mexico_City')::date,'YYYY-MM-DD') AS date")).rows[0].date;
  for(const date of ['2020-01-01',today]) {
   await scheduleRoute(pool,{method:'POST'},'/api/schedule-assignments',admin,{...assignment,date});
   const saved=await scheduleRoute(pool,{method:'GET'},'/api/schedule-assignments',admin);
   assert.ok(saved.some(row=>row.worker_id===workerId && row.effective_date===date));
  }
  await db.query('DELETE FROM b0d_schedule_assignments WHERE worker_id=$1 AND effective_date < $2::date',[workerId,future]);
  await assert.rejects(()=>scheduleRoute(pool,{method:'POST'},'/api/schedule-assignments',admin,{...assignment,date:'2099-02-30'}),e=>e.status===400);
  await scheduleRoute(pool,{method:'POST'},'/api/schedule-assignments',{...admin,role:'User'},assignment);
  const edited=base();edited.days[0].end='18:00';edited.revision=1;
  const updated=await scheduleRoute(pool,{method:'PATCH'},`/api/schedules/${created.id}`,{...admin,role:'User'},edited);assert.equal(updated.revision,2);assert.equal(updated.definition.weeklyMinutes,540);
  await assert.rejects(()=>scheduleRoute(pool,{method:'PATCH'},`/api/schedules/${created.id}`,{...admin,role:'User'},edited),error=>error.status===409);
  const versions=(await db.query('SELECT revision,definition FROM b0d_schedule_versions ORDER BY revision')).rows;assert.equal(versions.length,2);assert.equal(versions[0].definition.weeklyMinutes,480);
  const assigned=await scheduleRoute(pool,{method:'GET'},'/api/schedule-assignments',admin);assert.equal(assigned[0].revision,1);
  const token='b'.repeat(64);await db.query('INSERT INTO b0d_devices(id,name,token_hash) VALUES($1,$2,$3)',[randomUUID(),'Test',createHash('sha256').update(token).digest('hex')]);
  const snapshot=await deviceRoute(pool,{method:'GET',headers:{authorization:`Bearer ${token}`}},'/api/device/schedules',null);assert.equal(snapshot.versions.length,2);assert.equal(snapshot.assignments[0].revision,1);assert.equal(snapshot.assignments[0].effective_date,future);
  await scheduleRoute(pool,{method:'POST'},'/api/schedule-assignments',admin,assignment);
  const reassigned=await scheduleRoute(pool,{method:'GET'},'/api/schedule-assignments',admin);assert.equal(reassigned.length,1);assert.equal(reassigned[0].revision,2);assert.notEqual(reassigned[0].id,assigned[0].id);
  await migrate(pool);const rows=await scheduleRoute(pool,{method:'GET'},'/api/schedules',{...admin,role:'User'});assert.equal(rows.length,1);assert.equal(rows[0].revision,2);
  const invalid=base();invalid.days[0].end='08:00';await assert.rejects(()=>scheduleRoute(pool,{method:'POST'},'/api/schedules',admin,invalid),error=>error.status===400);
  await assert.rejects(()=>scheduleRoute(pool,{method:'DELETE'},`/api/schedules/${created.id}`,{...admin,role:'User'}),e=>e.status===403);
  await scheduleRoute(pool,{method:'DELETE'},`/api/schedules/${created.id}`,admin);
  assert.equal((await scheduleRoute(pool,{method:'GET'},'/api/schedules',admin)).length,0);
  assert.equal((await db.query('SELECT count(*) AS n FROM b0d_schedule_versions')).rows[0].n,2);
  assert.equal((await scheduleRoute(pool,{method:'GET'},'/api/schedule-assignments',admin)).length,1);
  await assert.rejects(()=>scheduleRoute(pool,{method:'POST'},'/api/schedule-assignments',admin,assignment),e=>e.status===404);
  await assert.rejects(()=>scheduleRoute(pool,{method:'PATCH'},`/api/schedules/${created.id}`,admin,{...base(),revision:2}),e=>e.status===404);
 } finally {await db.close();}
});
