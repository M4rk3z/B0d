import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {PGlite} from '@electric-sql/pglite';
import {migrate,bootstrapAdmin,createApplication} from '../app.mjs';
import {seedDemo,demoStatus} from '../demo-data.mjs';
import {loadReport,excelReport,pdfReport} from '../reports.mjs';
test('Carga DEMO completa, conservadora, idempotente y solo Admin',async()=>{
 const db=new PGlite();const pool={query:async(sql,args)=>sql.includes('CREATE TABLE')?(await db.exec(sql)).at(-1):db.query(sql,args),connect:async()=>({query:pool.query,release(){}})};
 await migrate(pool);await bootstrapAdmin(pool,'admin','abcdef');const actor=(await db.query('SELECT id FROM b0d_users')).rows[0].id;
 const real=randomUUID();await db.query('INSERT INTO b0d_workers(id,code,name) VALUES($1,$2,$3)',[real,'DEMO-001','Existente']);
 await assert.rejects(seedDemo(pool,actor),e=>e.status===409);assert.equal((await demoStatus(pool)).loaded,false);
 await db.query('UPDATE b0d_workers SET code=$1 WHERE id=$2',['REAL-001',real]);
 const result=await seedDemo(pool,actor);assert.equal(result.punches,450);
 assert.equal((await seedDemo(pool,actor)).alreadyLoaded,true);
 assert.equal((await db.query('SELECT count(*) AS n FROM b0d_workers')).rows[0].n,16);
 assert.equal((await db.query('SELECT active FROM b0d_workers WHERE id=$1',[real])).rows[0].active,true);
 assert.equal((await db.query('SELECT count(*) AS n FROM b0d_punches')).rows[0].n,450);
 assert.equal((await db.query('SELECT count(*) AS n FROM b0d_schedule_assignments')).rows[0].n,15);
 const report=await loadReport(pool,new URLSearchParams({from:result.from,to:result.to,type:'total'}));
 assert.equal(report.rows.length,75);assert.equal(report.rows.filter(r=>r.extra>0).length,25);
 assert.equal(report.rows.reduce((n,r)=>n+r.extra,0)/3600000,25);
 assert.equal(report.rows.reduce((n,r)=>n+r.effective,0)/3600000,600);
 assert.ok(report.rows.every(r=>!r.issues.length));assert.ok(excelReport(report).length>0);assert.ok((await pdfReport(report)).length>0);
 const origin='http://127.0.0.1:3000',server=createApplication(pool,{origin});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;let cookie='';
 const req=(path,method='GET',body)=>fetch(base+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await req('/api/demo-data','POST',{confirmation:'DEMO-15'})).status,401);
  let login=await req('/api/login','POST',{user:'admin',password:'abcdef'});cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await req('/api/demo-data','POST',{confirmation:'wrong'})).status,400);
  assert.equal((await req('/api/demo-data','POST',{confirmation:'DEMO-15'})).status,200);
  await req('/api/users','POST',{username:'reader',password:'abcdef',role:'User'});
  login=await req('/api/login','POST',{user:'reader',password:'abcdef'});cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await req('/api/demo-data','POST',{confirmation:'DEMO-15'})).status,403);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();}
});
