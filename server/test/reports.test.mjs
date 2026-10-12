import {test} from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import {calculateDay,reportRows,excelReport,pdfReport,loadReport,regularValues,cells} from '../reports.mjs';
const H=3600000, base=Date.parse('2026-10-01T00:00:00Z');
const context={date:'2026-10-01',zone:'UTC',schedule:'v1',plan:{start:base+8*H,end:base+17*H,target:8*H,marked:false,rests:[[base+13*H,base+14*H]]}};
const events=(list)=>list.map(([kind,h],i)=>({kind,occurred_at:base+h*H,event_id:String(i),worker_id:'w',worker_code:'001',worker_name:'Persona',zone_id:'UTC',context:kind==='IN'?context:null}));
test('Regular conserva tope de ocho horas sin descontar pausas ni depender de horarios',()=>{
 const row=reportRows(events([['IN',8],['BREAK_START',12],['BREAK_END',13],['OUT',18]]),'2026-10-01','2026-10-01')[0];
 const regular=regularValues(row),difference=Math.abs(regular.exit-(base+16*H));
 assert.equal(regular.total,8*H);assert.ok(difference>=60000&&difference<=300000);
 assert.deepEqual(regularValues(row),regular);assert.equal(row.exit,base+18*H);assert.equal(row.effective,10*H);
 assert.equal(cells(row,'regular')[4],'8:00');assert.equal(cells(row,'total')[8],'10:00');
 const short=calculateDay(events([['IN',8],['OUT',15]]));
 assert.equal(short.effective,7*H);assert.equal(short.extra,0);
});
test('Pausas opcionales, reportes idénticos con o sin contexto antiguo',()=>{
 const list=events([['IN',8],['OUT',17]]);
 assert.deepEqual(calculateDay(list,context),calculateDay(list,null));
 assert.equal(calculateDay(list).effective,9*H);assert.equal(calculateDay(list).extra,H);
});
test('No inventa totales en secuencias abiertas, inválidas o pausas de tipo distinto',()=>{
 for(const list of [[['IN',8]],[['OUT',17]],[['IN',8],['BREAK_START',12],['OUT',17]]])assert.equal(calculateDay(events(list)).effective,null);
 const list=events([['IN',8],['BREAK_START',12],['BREAK_END',13],['OUT',17]]);list[1].action='MEAL';list[2].action='REST';
 assert.equal(calculateDay(list).effective,null);
});
test('Acumula entradas de un día, pero conserva el día de inicio al cruzar medianoche',()=>{
 const rows=reportRows(events([['IN',8],['OUT',12],['IN',14],['OUT',19]]),'2026-10-01','2026-10-01');
 assert.equal(rows.length,1);assert.equal(rows[0].extra,H);assert.equal(rows[0].extraStart,base+18*H);
 const night=events([['IN',22],['BREAK_START',25],['BREAK_END',26],['OUT',30]]).map(e=>({...e,context:null}));
 const nights=reportRows(night,'2026-10-01','2026-10-01');assert.equal(nights.length,1);assert.equal(nights[0].effective,8*H);
});
test('Checkbox incluye todas las pausas en XLS sin cambiar horas',async()=>{
 const list=events([['IN',8],['BREAK_START',10],['BREAK_END',10.25],['BREAK_START',12],['BREAK_END',13],['OUT',16]]);
 list[1].action=list[2].action='REST';list[3].action=list[4].action='MEAL';
 const rows=reportRows(list,'2026-10-01','2026-10-01'),report={type:'regular',from:'2026-10-01',to:'2026-10-01',rows};
 const basic=cells(rows[0],'regular'),detail=cells(rows[0],'regular',false,true);
 assert.equal(basic.length,5);assert.equal(detail.length,9);assert.deepEqual(detail.slice(0,5),basic);assert.equal(detail[4],'8:00');assert.notEqual(detail[5],'—');
 const ws=XLSX.read(excelReport({...report,includeBreaks:true})).Sheets['Marcaje Regular'];
 assert.equal(ws.F4.v,'Salida a comida');assert.equal(ws.E5.v,8/24);
 const pdf=await pdfReport({...report,includeBreaks:true});assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,2);
});
test('XLS real preserva columnas, grupos, código, duración y texto sin fórmulas',()=>{
 const rows=reportRows(events([['IN',8],['OUT',19]]),'2026-10-01','2026-10-01');rows[0].name='=1+1';
 const bytes=excelReport({type:'total',from:'2026-10-01',to:'2026-10-01',rows});
 assert.equal(bytes.subarray(0,4).toString('hex'),'d0cf11e0');
 const wb=XLSX.read(bytes,{cellNF:true});const ws=wb.Sheets['Marcaje Total'];
 assert.equal(ws.A5.v,'001');assert.equal(ws.B5.v,'=1+1');assert.equal(ws.B5.f,undefined);
 assert.equal(ws.E5.v,8/24);assert.equal(ws.H5.v,3/24);assert.equal(ws.I5.v,11/24);assert.equal(ws.E5.z,'[h]:mm');assert.equal(ws['!merges'].length,4);
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
