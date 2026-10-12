import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {punchQuery} from '../punch-filters.mjs';
test('Filtros completos antes de paginar, fechas locales y texto literal',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE TABLE b0d_punches(event_id text,worker_code text,worker_name text,kind text,occurred_at bigint,zone_id text,method text,action text)');
  await db.query("INSERT INTO b0d_punches SELECT 'e'||n,'001','Ana Pérez','IN', $1::bigint+n,'America/Mexico_City','manual','IN' FROM generate_series(1,502) n",[Date.parse('2026-10-12T02:00:00Z')]);
  await db.query("INSERT INTO b0d_punches VALUES('meal','002','O''Brien 100%','BREAK_START',$1,'UTC','manual','MEAL'),('rest','003','Luis','BREAK_START',$1,'UTC','manual',NULL)",[Date.parse('2026-10-12T02:00:00Z')]);
  const search=async qs=>{const {sql,values}=punchQuery(new URLSearchParams(qs));return (await db.query(sql,values)).rows;};
  assert.equal((await search('q=ana&from=2026-10-11&to=2026-10-11')).length,501);
  assert.equal((await search('q=001&offset=500')).length,2);
  assert.equal((await search('q=Ana&from=2026-10-12')).length,0);
  assert.equal((await search('kind=MEAL_START'))[0].event_id,'meal');
  assert.equal((await search('kind=REST_START'))[0].event_id,'rest');
  assert.equal((await search(new URLSearchParams({q:"O'Brien 100%"})))[0].worker_code,'002');
  assert.equal((await search('kind=OUT')).length,0);
  assert.equal((await search(new URLSearchParams({q:"' OR 1=1 --"}))).length,0);
 }finally{await db.close();}
});
test('Rechaza fechas, tipos y paginación inválidos',()=>{
 for(const q of ['from=2026-02-30','from=2026-10-12&to=2026-10-11','offset=-1','offset=0.5','kind=other','q='+ 'a'.repeat(101)])assert.throws(()=>punchQuery(new URLSearchParams(q)),e=>e.status===400);
});
