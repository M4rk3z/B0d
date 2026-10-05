import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate,bootstrapAdmin } from '../app.mjs';
import { scheduleRoute } from '../schedules.mjs';
import { validateSchedule } from '../public/schedule-rules.js';
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
  const edited=base();edited.days[0].end='18:00';edited.revision=1;
  const updated=await scheduleRoute(pool,{method:'PATCH'},`/api/schedules/${created.id}`,admin,edited);assert.equal(updated.revision,2);assert.equal(updated.definition.weeklyMinutes,540);
  await assert.rejects(()=>scheduleRoute(pool,{method:'PATCH'},`/api/schedules/${created.id}`,admin,edited),error=>error.status===409);
  const versions=(await db.query('SELECT revision,definition FROM b0d_schedule_versions ORDER BY revision')).rows;assert.equal(versions.length,2);assert.equal(versions[0].definition.weeklyMinutes,480);
  await migrate(pool);const rows=await scheduleRoute(pool,{method:'GET'},'/api/schedules',admin);assert.equal(rows.length,1);assert.equal(rows[0].revision,2);
  const invalid=base();invalid.days[0].end='08:00';await assert.rejects(()=>scheduleRoute(pool,{method:'POST'},'/api/schedules',admin,invalid),error=>error.status===400);
 } finally {await db.close();}
});
