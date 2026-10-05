import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {validateSchedule} from './public/schedule-rules.js';

const deviceId='b0d00000-0000-4000-8000-000000000015';
export const demoSummary={workers:15,schedules:3,days:75,punches:450,overtimeDays:25,overtimeHours:25,from:'2026-09-28',to:'2026-10-02'};
const zone='America/Mexico_City';
const clock=m=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const specs=[
 {name:'DEMO · Matutino',start:480,end:1020,meal:[780,840],rest:[630,645]},
 {name:'DEMO · Vespertino',start:840,end:1380,meal:[1080,1125],rest:[960,975]},
 {name:'DEMO · Nocturno',start:1320,end:1800,meal:[1560,1590],rest:[1440,1455]}
];
export async function demoStatus(pool){return {loaded:(await pool.query('SELECT 1 FROM b0d_devices WHERE id=$1',[deviceId])).rows.length>0,...demoSummary};}
export async function seedDemo(pool,actor){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(80405015)');
  if((await demoStatus(client)).loaded){await client.query('COMMIT');return {loaded:true,alreadyLoaded:true,...demoSummary};}
  const codes=Array.from({length:15},(_,i)=>`DEMO-${String(i+1).padStart(3,'0')}`);
  if((await client.query('SELECT 1 FROM b0d_workers WHERE code=ANY($1::text[])',[codes])).rows.length){const e=new Error('Ya existen códigos DEMO. No se modificaron los registros existentes.');e.status=409;throw e;}
  // Disabled and hidden: this origin can never authenticate as a physical tablet.
  await client.query('INSERT INTO b0d_devices(id,name,token_hash,active,deleted) VALUES($1,$2,$3,false,true)',[deviceId,'DEMO · Datos sintéticos',createHash('sha256').update(randomBytes(32)).digest('hex')]);
  const schedules=[];
  for(const spec of specs){
   const id=randomUUID(),definition=validateSchedule({name:spec.name,zone,markBreaks:true,days:[1,2,3,4,5].map(weekday=>({weekday,start:clock(spec.start),end:clock(spec.end),breaks:[{kind:'Comida',start:clock(spec.meal[0]),end:clock(spec.meal[1])},{kind:'Descanso',start:clock(spec.rest[0]),end:clock(spec.rest[1])}]}))});
   await client.query('INSERT INTO b0d_schedules(id,revision,definition) VALUES($1,1,$2)',[id,JSON.stringify(definition)]);
   await client.query('INSERT INTO b0d_schedule_versions(schedule_id,revision,definition,actor_id) VALUES($1,1,$2,$3)',[id,JSON.stringify(definition),actor]);
   schedules.push({id,...spec});
  }
  for(let i=0;i<15;i++){
   const worker=randomUUID(),code=codes[i],name=`DEMO · Colaborador ${String(i+1).padStart(2,'0')}`,s=schedules[Math.floor(i/5)];
   await client.query('INSERT INTO b0d_workers(id,code,name,active) VALUES($1,$2,$3,false)',[worker,code,name]);
   await client.query("INSERT INTO b0d_audit(worker_id,action) VALUES($1,'demo_created')",[worker]);
   await client.query('INSERT INTO b0d_schedule_assignments(id,worker_id,schedule_id,revision,effective_date) VALUES($1,$2,$3,1,$4)',[randomUUID(),worker,s.id,demoSummary.from]);
   for(let d=0;d<5;d++){
    const date=new Date(Date.parse(demoSummary.from)+d*86400000).toISOString().slice(0,10);
    const at=m=>Date.parse(`${date}T00:00:00-06:00`)+m*60000;
    const extra=(i+d)%3===0?60:0,late=(i+d)%5===0?15:0;
    const rests=[s.meal,s.rest].sort((a,b)=>a[0]-b[0]);
    const context={date,zone,schedule:s.id+':1',plan:{start:at(s.start),end:at(s.end),target:(s.end-s.start-rests.reduce((n,r)=>n+r[1]-r[0],0))*60000,marked:true,rests:rests.map(r=>r.map(at))}};
    const events=[['IN',s.start+late,'IN'],['BREAK_START',s.meal[0],'MEAL'],['BREAK_END',s.meal[1],'MEAL'],['BREAK_START',s.rest[0],'REST'],['BREAK_END',s.rest[1],'REST'],['OUT',s.end+late+extra,'OUT']].sort((a,b)=>a[1]-b[1]);
    for(const [kind,minute,action]of events){const id=randomUUID();await client.query('INSERT INTO b0d_punches(event_id,worker_id,device_id,worker_code,worker_name,kind,occurred_at,zone_id,method,action) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,worker,deviceId,code,name,kind,at(minute),zone,'manual',action]);
     if(kind==='IN')await client.query('INSERT INTO b0d_shift_contexts(event_id,context) VALUES($1,$2)',[id,JSON.stringify(context)]);
    }
   }
  }
  await client.query('COMMIT');return {loaded:true,alreadyLoaded:false,...demoSummary};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
