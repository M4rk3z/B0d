import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createApplication,migrate,bootstrapAdmin} from '../app.mjs';
import {encryptSamples,decryptSamples,validateSamples} from '../faces.mjs';
import {MotionSteps} from '../public/face-motion.js';

// Structural JPEG fixtures test transport validation, not facial inference.
const samples=poses=>poses.map((pose,i)=>({pose,elapsed:1000+i*1000,jpeg:Buffer.from([255,216,255,192,0,11,8,1,0,1,0,1,1,17,i,255,217]).toString('base64')}));
test('Movimiento exige estabilidad, orden y una sola cara',()=>{
 const steps=new MotionSteps(['center','left','center']);
 assert.equal(steps.observe(0,true,0),false);
 assert.equal(steps.observe(0,true,300),false);
 assert.equal(steps.observe(0,false,600),false);
 for(const [time,result] of [[700,false],[1000,false],[1300,true]])assert.equal(steps.observe(0,true,time),result);
 assert.equal(steps.observe(0,true,2000),false);
 for(const [time,result] of [[2100,false],[2400,false],[2700,true]])assert.equal(steps.observe(.4,true,time),result);
 assert.equal(steps.index,2);
});
test('Captura cifrada ligada al colaborador y revisión; rechaza muestras repetidas',()=>{
 process.env.FACE_ENCRYPTION_KEY='test-only-key-'.repeat(4);
 const poses=['center','left','center','right','center'],images=validateSamples(samples(poses),poses);
 const row={worker_id:randomUUID(),revision:randomUUID()};row.encrypted_samples=encryptSamples(row.worker_id,row.revision,images);
 assert.deepEqual(decryptSamples(row),images);
 assert.throws(()=>decryptSamples({...row,worker_id:randomUUID()}));
 assert.throws(()=>decryptSamples({...row,revision:randomUUID()}));
 assert.throws(()=>validateSamples(samples(poses).slice(1),poses));
 assert.throws(()=>validateSamples(samples(poses).map(s=>({...s,jpeg:images[0]})),poses));
 assert.throws(()=>validateSamples(samples(poses).map(s=>({...s,elapsed:1000})),poses));
 assert.throws(()=>validateSamples([null,...samples(poses).slice(1)],poses));
});
test('Captura web, validación de tablet, revocación y permisos',async()=>{
 process.env.FACE_ENCRYPTION_KEY='test-only-key-'.repeat(4);
 const db=new PGlite(),pool={query:async(sql,args)=>sql.includes('CREATE TABLE')?(await db.exec(sql)).at(-1):db.query(sql,args),connect:async()=>({query:pool.query,release(){}})};
 await migrate(pool);await bootstrapAdmin(pool,'admin','test-password-123');
 const origin='http://127.0.0.1:3000',server=createApplication(pool,{origin});server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;let cookie='',token='';
 const req=(path,method='GET',body,device=false)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(device?{Authorization:'Bearer '+token}:{Cookie:cookie})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 try{
  const login=await req('/api/login','POST',{user:'admin',password:'test-password-123'});cookie=login.headers.get('set-cookie').split(';')[0];
  const device=await(await req('/api/devices','POST',{name:'Test tablet'})).json();token=(await(await req('/api/device/pair','POST',{code:device.code},true)).json()).token;
  const local=randomUUID(),worker=await(await req('/api/device/worker','POST',{id:local,code:'FACE-1',name:'Test face',active:true},true)).json();
  const path='/api/workers/'+worker.id+'/face';
  assert.equal((await fetch(base+path+'/challenge',{method:'POST'})).status,403);
  const challenge=await(await req(path+'/challenge','POST',{})).json();
  assert.equal(challenge.poses.length,5);
  const input={challenge:challenge.id,samples:samples(challenge.poses)};
  assert.equal((await req(path,'POST',input)).status,200);
  assert.equal((await req(path,'POST',input)).status,409);
  let status=(await(await req('/api/workers')).json())[0];assert.equal(status.face_captured,true);assert.equal(status.face_ready,false);
  const stored=(await db.query('SELECT * FROM b0d_face_profiles')).rows[0];assert.ok(!stored.encrypted_samples.includes(input.samples[0].jpeg));
  assert.equal((await req('/api/device/face','POST',{workerId:randomUUID()},true)).status,404);
  const imported=await(await req('/api/device/face','POST',{workerId:local},true)).json();assert.deepEqual(imported.samples,input.samples.map(s=>s.jpeg));
  const report={workerId:local,present:true,samples:5,revision:imported.revision,error:null};
  assert.equal((await req('/api/device/face-status','POST',{profiles:[report]},true)).status,200);
  assert.equal((await(await req('/api/workers')).json())[0].face_ready,true);
  assert.equal((await req(path,'DELETE',{})).status,200);
  status=(await(await req('/api/workers')).json())[0];assert.equal(status.face_captured,false);assert.equal(status.face_ready,false);
  const deleted=await(await req('/api/device/face','POST',{workerId:local},true)).json();assert.equal(deleted.deleted,true);assert.deepEqual(deleted.samples,[]);
  // A stale device acknowledgement cannot resurrect a deleted profile.
  await req('/api/device/face-status','POST',{profiles:[report]},true);
  assert.equal((await(await req('/api/workers')).json())[0].face_captured,false);
  for(const asset of ['/face-capture.js','/face-motion.js','/face-vendor/vision_bundle.mjs','/face-vendor/wasm/vision_wasm_internal.wasm','/models/face_landmarker.task'])assert.equal((await req(asset)).status,200);
 }finally{await new Promise(r=>server.close(r));await db.close();}
});
