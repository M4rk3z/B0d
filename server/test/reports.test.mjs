import {test} from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import {calculateDay,reportRows,excelReport,pdfReport,loadReport} from '../reports.mjs';
const H=3600000, base=Date.parse('2026-10-01T00:00:00Z');
const context={date:'2026-10-01',zone:'UTC',schedule:'v1',plan:{start:base+8*H,end:base+17*H,target:8*H,marked:false,rests:[[base+13*H,base+14*H]]}};
const events=(list)=>list.map(([kind,h],i)=>({kind,occurred_at:base+h*H,event_id:String(i),worker_id:'w',worker_code:'001',worker_name:'Persona',zone_id:'UTC',context:kind==='IN'?context:null}));
test('Descuenta comida y conserva ocho horas efectivas',()=>{
 const row=calculateDay(events([['IN',8],['OUT',17]]),context);
 assert.equal(row.effective,8*H);assert.equal(row.extra,0);assert.equal(row.ordinary,8*H);
});
test('Llegar tarde no anticipa extras; se cuentan desde horas efectivas',()=>{
 assert.equal(calculateDay(events([['IN',9],['OUT',18]]),context).extra,0);
 const row=calculateDay(events([['IN',9],['OUT',19]]),context);
 assert.equal(row.extra,H);assert.equal(row.extraStart,base+18*H);
});
test('Descanso marcado utiliza tiempo real y faltante deja N/D',()=>{
 const ctx={...context,plan:{...context.plan,marked:true}};
 const row=calculateDay(events([['IN',8],['BREAK_START',13],['BREAK_END',13.5],['OUT',17]]),ctx);
 assert.equal(row.effective,8.5*H);assert.equal(row.extraStart,base+16.5*H);
 assert.equal(calculateDay(events([['IN',8],['OUT',17]]),ctx).effective,null);
});
test('Jornadas abiertas, sin contexto y secuencias inválidas no inventan totales',()=>{
 for(const [list,ctx] of [[[['IN',8]],context],[[['IN',8],['OUT',17]],null],[[['OUT',17]],context]])assert.equal(calculateDay(events(list),ctx).effective,null);
 const row=calculateDay(events([['IN',8],['OUT',17]]),{...context,plan:null});
 assert.equal(row.effective,9*H);assert.equal(row.extra,null);
});
test('Varias entradas de una jornada acumulan un solo objetivo diario',()=>{
 const rows=reportRows(events([['IN',8],['OUT',12],['IN',14],['OUT',19]]),'2026-10-01','2026-10-01');
 assert.equal(rows.length,1);assert.equal(rows[0].extra,H);assert.equal(rows[0].extraStart,base+18*H);
});
test('Turno nocturno pertenece a la fecha del inicio',()=>{
 const ctx={...context,plan:{...context.plan,start:base+22*H,end:base+30*H,rests:[]}};
 const punches=events([['IN',22],['OUT',30]]);punches[0].context=ctx;
 const rows=reportRows(punches,'2026-10-01','2026-10-01');assert.equal(rows.length,1);assert.equal(rows[0].effective,8*H);
});
test('Contextos diferentes en un mismo día se señalan',()=>{
 const punches=events([['IN',8],['OUT',12],['IN',14],['OUT',19]]);punches[2].context={...context,schedule:'v2'};
 assert.equal(reportRows(punches,'2026-10-01','2026-10-01')[0].effective,null);
});
test('XLS real preserva columnas, grupos, código, duración y texto sin fórmulas',()=>{
 const rows=reportRows(events([['IN',8],['OUT',19]]),'2026-10-01','2026-10-01');rows[0].name='=1+1';
 const bytes=excelReport({type:'total',from:'2026-10-01',to:'2026-10-01',rows});
 assert.equal(bytes.subarray(0,4).toString('hex'),'d0cf11e0');
 const wb=XLSX.read(bytes,{cellNF:true});const ws=wb.Sheets['Marcaje Total'];
 assert.equal(ws.A5.v,'001');assert.equal(ws.B5.v,'=1+1');assert.equal(ws.B5.f,undefined);
 assert.equal(ws.E5.v,8/24);assert.equal(ws.H5.v,2/24);assert.equal(ws.I5.v,10/24);assert.equal(ws.E5.z,'[h]:mm');assert.equal(ws['!merges'].length,4);
});
test('PDF genera archivo binario para ambos formatos con múltiples páginas',async()=>{
 const rows=reportRows(events([['IN',8],['OUT',19]]),'2026-10-01','2026-10-01');
 for(const type of ['regular','total']){
  const bytes=await pdfReport({type,from:'2026-10-01',to:'2026-10-01',rows:Array.from({length:100},()=>rows[0])});
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>1000);
  assert.equal((bytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,10,'El pie no debe generar páginas vacías');
 }
});
test('Valida fechas y límite antes de consultar',async()=>{
 const pool={query(){throw new Error('No debe consultar');}};
 for(const q of ['from=2026-02-30&to=2026-03-01','from=2026-01-01&to=2026-10-01','from=2026-10-02&to=2026-10-01'])await assert.rejects(loadReport(pool,new URLSearchParams(q)),e=>e.status===400);
});
