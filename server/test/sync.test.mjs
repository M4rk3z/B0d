import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createApplication, migrate, bootstrapAdmin } from '../app.mjs';

test('Sincronización autorizada, durable e idempotente', async t => {
 const db = new PGlite();
 const pool = { query: async (sql,args) => sql.includes('CREATE TABLE') ? (await db.exec(sql)).at(-1) : db.query(sql,args), connect: async () => ({ query: pool.query, release() {} }) };
 await migrate(pool); await migrate(pool); await bootstrapAdmin(pool,'admin','admin-password-123');
 const origin = 'http://127.0.0.1:3000'; const server = createApplication(pool,{origin}); server.listen(0,'127.0.0.1'); await once(server,'listening');
 const base = `http://127.0.0.1:${server.address().port}`; let cookie='',token='',deviceId='';
 const request = (path,method='GET',body,device=false) => fetch(base+path,{method,headers:{'Content-Type':'application/json',...(device?{Authorization:`Bearer ${token}`}:{Origin:origin,Cookie:cookie})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const worker={id:randomUUID(),code:'FIRE-1',name:'Persona de prueba',active:true};
 const event={eventId:randomUUID(),workerId:worker.id,code:worker.code,name:worker.name,kind:'IN',time:Date.now()-60000,zone:'America/Mexico_City',method:'facial',action:'IN'};
 try {
  const login=await request('/api/login','POST',{user:'admin',password:'admin-password-123'}); cookie=login.headers.get('set-cookie').split(';')[0];
  await t.test('Admin vincula sin exponer credencial almacenada',async()=>{
   const res=await request('/api/devices','POST',{name:'Fire HD 10'}); assert.equal(res.status,200); const device=await res.json(); deviceId=device.id;
   assert.match(device.code,/^\d{8}$/); assert.equal(device.token,undefined);
   const paired=await request('/api/device/pair','POST',{code:device.code},true); assert.equal(paired.status,200); token=(await paired.json()).token;
   assert.equal((await request('/api/device/pair','POST',{code:device.code},true)).status,401);
   const rows=await (await request('/api/devices')).json(); assert.equal(rows[0].token,undefined); assert.equal(rows[0].token_hash,undefined);
   assert.equal((await fetch(base+'/api/device/workers')).status,401);
   assert.equal((await request('/api/workers','GET',undefined,true)).status,401);
  });
  await t.test('importa colaborador y repetir no duplica; conflicto no fusiona',async()=>{
   assert.equal((await request('/api/device/worker','POST',worker,true)).status,200);
   assert.equal((await request('/api/device/worker','POST',worker,true)).status,200);
   assert.equal((await request('/api/device/worker','POST',{...worker,id:randomUUID(),name:'Otra persona'},true)).status,409);
   assert.equal((await db.query('SELECT count(*) AS n FROM b0d_workers')).rows[0].n,1);
  });
  await t.test('recuperación tras respuesta perdida usa mismo evento',async()=>{
   assert.equal((await request('/api/device/punch','POST',event,true)).status,200);
   const replay=await request('/api/device/punch','POST',event,true); assert.deepEqual(await replay.json(),{eventId:event.eventId,stored:true});
   assert.equal((await db.query('SELECT count(*) AS n FROM b0d_punches')).rows[0].n,1);
   assert.equal((await request('/api/device/punch','POST',{...event,kind:'OUT'},true)).status,409);
   assert.equal((await db.query('SELECT kind FROM b0d_punches')).rows[0].kind,'IN');
  });
  await t.test('horario histórico confirmado es idempotente e inmutable',async()=>{
   const date=new Date(event.time).toISOString().slice(0,10);
   const context={date,zone:'UTC',schedule:null,plan:null};
   const send=c=>request('/api/device/context','POST',{eventId:event.eventId,context:c},true);
   assert.equal((await send(context)).status,200);assert.equal((await send(context)).status,200);
   assert.equal((await send({...context,schedule:'other'})).status,409);
   assert.equal((await send({...context,zone:'bad'})).status,400);
   assert.equal((await request('/api/device/context','POST',{eventId:randomUUID(),context},true)).status,403);
   const q=`/api/reports?from=${date}&to=${date}&type=total`;
   assert.equal((await fetch(base+q)).status,401);
   const report=await (await request(q)).json();assert.equal(report.rows.length,1);assert.equal(report.rows[0].effective,null);
   for(const format of ['xls','pdf']){const res=await request(q+'&format='+format);assert.equal(res.status,200);assert.match(res.headers.get('content-disposition'),new RegExp('\\.'+format));}
  });
  await t.test('rechaza evento sin colaborador y fechas inválidas',async()=>{
   assert.equal((await request('/api/device/punch','POST',{...event,eventId:randomUUID(),workerId:randomUUID()},true)).status,409);
   assert.equal((await request('/api/device/punch','POST',{...event,time:Date.now()+172800000},true)).status,400);
   assert.equal((await request('/api/device/punch','POST',{...event,zone:'invalid'},true)).status,400);
  });
  await t.test('web consulta el mismo registro y tablet recibe altas web',async()=>{
   const page=await (await request('/api/punches')).json(); assert.equal(page.rows[0].event_id,event.eventId); assert.equal(page.next,null);
   await request('/api/workers','POST',{code:'WEB-1',name:'Alta web'});
   const catalog=await (await request('/api/device/workers','GET',undefined,true)).json(); assert.equal(catalog.workers.length,2);
   const imported=catalog.workers.find(row=>row.code===worker.code);
   assert.equal((await request(`/api/workers/${imported.id}`,'PATCH',{active:false})).status,409);
   const fresh=catalog.workers.find(row=>row.code==='WEB-1');
   assert.equal((await request(`/api/workers/${fresh.id}`,'PATCH',{active:false})).status,200);
   const updated=await (await request('/api/device/workers','GET',undefined,true)).json(); assert.equal(updated.workers.find(row=>row.id===fresh.id).active,false);
  });
  await t.test('User no administra dispositivos',async()=>{
   await request('/api/users','POST',{username:'reader',password:'reader-password-123',role:'User'});
   const adminCookie=cookie; const login=await request('/api/login','POST',{user:'reader',password:'reader-password-123'}); cookie=login.headers.get('set-cookie').split(';')[0];
   assert.equal((await request('/api/devices')).status,403); assert.equal((await request('/api/devices','POST',{name:'No'})).status,403); assert.equal((await request('/api/punches')).status,200);
   assert.equal((await request('/api/reports?from=2026-10-01&to=2026-10-01&type=regular&format=xls')).status,200);cookie=adminCookie;
  });
  await t.test('revocación bloquea nuevos envíos sin borrar registros',async()=>{
   await request(`/api/devices/${deviceId}`,'DELETE',{});
   assert.equal((await request('/api/device/punch','POST',event,true)).status,401);
   await migrate(pool); assert.equal((await db.query('SELECT count(*) AS n FROM b0d_punches')).rows[0].n,1);
  });
  await t.test('código caducado y límite persistente de intentos',async()=>{
   const device=await (await request('/api/devices','POST',{name:'Expired'})).json();
   await db.query("UPDATE b0d_pairing SET expires_at=now()-interval '1 second'");
   assert.equal((await request('/api/device/pair','POST',{code:device.code},true)).status,401);
   await db.query('UPDATE b0d_pair_guard SET attempts=5,window_start=now()');
   assert.equal((await request('/api/device/pair','POST',{code:'00000000'},true)).status,429);
  });
  await t.test('eliminar retira dispositivo, conserva historial y bloquea acceso',async()=>{
   const login=await request('/api/login','POST',{user:'reader',password:'reader-password-123'});
   const adminCookie=cookie; cookie=login.headers.get('set-cookie').split(';')[0];
   assert.equal((await request(`/api/devices/${deviceId}/remove`,'DELETE',{})).status,403);
   cookie=adminCookie;
   await db.query('UPDATE b0d_devices SET active=true WHERE id=$1',[deviceId]);
   assert.equal((await request(`/api/devices/${deviceId}/remove`,'DELETE',{})).status,200);
   assert.equal((await (await request('/api/devices')).json()).some(row=>row.id===deviceId),false);
   assert.equal((await request('/api/device/workers','GET',undefined,true)).status,401);
   assert.equal((await db.query('SELECT count(*) AS n FROM b0d_punches')).rows[0].n,1);
   await migrate(pool);
   assert.equal((await (await request('/api/devices')).json()).some(row=>row.id===deviceId),false);
  });
 } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); await db.close(); }
});
