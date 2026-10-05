import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
const fail=message=>{const e=new Error(message);e.status=400;throw e;};
const merge=spans=>{const out=[];for(const [a,b] of spans.filter(s=>s[1]>s[0]).sort((a,b)=>a[0]-b[0])){const last=out.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else out.push([a,b]);}return out;};
const overlap=(a,b)=>Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]));
function subtract(presence,rests){let result=merge(presence);for(const [a,b]of merge(rests)){const next=[];for(const [x,y]of result){if(b<=x||a>=y)next.push([x,y]);else{if(x<a)next.push([x,a]);if(b<y)next.push([b,y]);}}result=next;}return result;}
const localDate=(time,zone)=>{const parts=new Intl.DateTimeFormat('en',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time));const get=t=>parts.find(p=>p.type===t).value;return `${get('year')}-${get('month')}-${get('day')}`;};
export function calculateDay(events,context){
 let state=0,start=0,rest=0,invalid=false,completed=0;const presence=[],rests=[];
 for(const e of events){const time=Number(e.occurred_at);switch(e.kind){case 'IN':if(state)invalid=true;else{start=time;state=1;}break;case 'BREAK_START':if(state!==1)invalid=true;else{rest=time;state=2;}break;case 'BREAK_END':if(state!==2)invalid=true;else{rests.push([rest,time]);completed++;state=1;}break;case 'OUT':if(!state)invalid=true;else{if(state===2){rests.push([rest,time]);invalid=true;}presence.push([start,time]);state=0;}break;default:invalid=true;}}
 const plan=context?.plan;const expected=plan?plan.rests.filter(r=>presence.some(p=>overlap(p,r)>0)).length:0;
 const issues=[];if(!context)issues.push('Pendiente de sincronizar horario de la jornada');if(state)issues.push('Falta salida');if(invalid)issues.push('Secuencia incompleta o inválida');if(plan?.marked&&completed<expected)issues.push('Faltan marcaciones de descanso');
 const valid=context&&!state&&!invalid&&!(plan?.marked&&completed<expected);
 const spans=subtract(presence,plan&&!plan.marked?plan.rests:rests);const effective=spans.reduce((sum,[a,b])=>sum+b-a,0);
 const ordinary=plan?Math.min(plan.target,effective):null,extra=plan?Math.max(0,effective-plan.target):null;
 let threshold=null;if(extra>0){let remaining=ordinary;for(const [a,b]of spans){if(remaining<b-a){threshold=a+remaining;break;}remaining-=b-a;}}
 if(context&&!plan)issues.push('Sin horario asignado: no se calculan horas extras');
 let capEnd=null,remainingCap=8*3600000;for(const [a,b]of spans){if(remainingCap<=b-a){capEnd=a+remainingCap;break;}remainingCap-=b-a;}
 const first=events.find(e=>e.kind==='IN'),last=[...events].reverse().find(e=>e.kind==='OUT');
 return {capEnd:valid?capEnd:null,entry:first?Number(first.occurred_at):null,exit:last?Number(last.occurred_at):null,effective:valid?effective:null,ordinary:valid?ordinary:null,extra:valid?extra:null,extraStart:valid?threshold:null,regularEnd:valid?(threshold||Number(last?.occurred_at)||null):null,issues};
}
export function reportRows(punches,from,to){
 const workers=new Map();for(const p of punches){if(!workers.has(p.worker_id))workers.set(p.worker_id,[]);workers.get(p.worker_id).push(p);}
 const result=[];
 for(const events of workers.values()){
  events.sort((a,b)=>Number(a.occurred_at)-Number(b.occurred_at)||a.event_id.localeCompare(b.event_id));let active=null;const groups=new Map();
  for(const p of events){if(p.kind==='IN')active=p.context||null;const date=active?.date||localDate(Number(p.occurred_at),p.zone_id),zone=active?.zone||p.zone_id;const key=date+'|'+zone;
   if(!groups.has(key))groups.set(key,{date,zone,context:active,events:[],mismatch:false,code:p.worker_code,name:p.worker_name});const g=groups.get(key);
   if(p.kind==='IN'&&JSON.stringify(g.context)!==JSON.stringify(active))g.mismatch=true;g.events.push(p);if(p.kind==='OUT')active=null;
  }
  for(const g of groups.values())if(g.date>=from&&g.date<=to){const row={...g,...calculateDay(g.events,g.context)};delete row.events;delete row.context;if(g.mismatch){row.issues.push('Más de un horario o contexto sin confirmar en la jornada');row.effective=row.ordinary=row.extra=row.extraStart=row.regularEnd=null;}result.push(row);}
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date)||a.code.localeCompare(b.code));
}
export async function loadReport(pool,params){
 const from=params.get('from'),to=params.get('to'),type=params.get('type')||'regular';
 if(!['regular','total'].includes(type))fail('Formato inválido');
 for(const date of [from,to])if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Selecciona fechas válidas');
 if(to<from || Date.parse(to)-Date.parse(from)>92*86400000)fail('Elige un rango de hasta 93 días');
 const rows=(await pool.query('SELECT p.*,c.context FROM b0d_punches p LEFT JOIN b0d_shift_contexts c ON c.event_id=p.event_id WHERE p.occurred_at >= $1 AND p.occurred_at < $2 ORDER BY p.worker_id,p.occurred_at,p.event_id LIMIT 50001',[Date.parse(from)-2*86400000,Date.parse(to)+3*86400000])).rows;
 if(rows.length>50000)fail('Demasiados registros. Reduce el rango de fechas');
 return {type,from,to,note:type==='regular'?regularNote:'',rows:reportRows(rows,from,to)};
}
export const headers=type=>type==='regular'?['Código','Usuario','Entrada','Salida*','Total Horas Trabajadas']:['Código','Usuario','Entrada','Salida','Total Horas','Inicio Hrs Extra','Fin Hrs Extra','Total Hrs Extra','Total Horas Trabajadas'];
export const title=type=>type==='regular'?'Marcaje Regular':'Marcaje Total';
const clock=(time,zone)=>time===null?'—':new Intl.DateTimeFormat('es-MX',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(time));
const hours=n=>n===null?'N/D':`${Math.floor(n/3600000)}:${String(Math.floor(n/60000)%60).padStart(2,'0')}`;
export const regularNote='* Máximo 8 h; salida aproximada con variación de 1 a 5 min en jornadas mayores a 8 h. Original en Marcaje Total.';
export function regularValues(row){
 if(row.effective===null)return {exit:row.exit,total:null};
 if(row.effective<=8*3600000)return {exit:row.exit,total:row.effective};
 if(row.capEnd===null || row.capEnd===undefined)return {exit:null,total:null};
 // Stable presentation-only approximation; repeated exports never change punch records.
 let hash=0;for(const c of `${row.code}|${row.date}`)hash=(hash*31+c.charCodeAt(0))>>>0;
 const delta=(hash%5+1)*60000;let offset=hash%2?delta:-delta;
 if(row.capEnd+offset>row.exit)offset=-delta;
 return {exit:row.capEnd+offset,total:8*3600000};
}
export function cells(row,type,numeric=false){const regular=regularValues(row);const duration=n=>numeric&&n!==null?n/86400000:hours(n);return type==='regular'?[row.code,row.name,clock(row.entry,row.zone),clock(regular.exit,row.zone),duration(regular.total)]:[row.code,row.name,clock(row.entry,row.zone),clock(row.regularEnd,row.zone),duration(row.ordinary),clock(row.extraStart,row.zone),clock(row.extra>0?row.exit:null,row.zone),duration(row.extra),duration(row.effective)];}
export function excelReport(report){
 const wb=XLSX.utils.book_new();const width=headers(report.type).length;const groups=report.type==='total'?['','','Horario Regular','','','Horas Extras','','','Horas regulares + extras']:[];
 const data=[[title(report.type)],[`${report.from} a ${report.to} · ${report.type==='regular'?regularNote:'Una fila por colaborador y jornada'}`],groups,headers(report.type),...report.rows.map(row=>cells(row,report.type,true))];const sheet=XLSX.utils.aoa_to_sheet(data);
 sheet['!merges']=[{s:{r:0,c:0},e:{r:0,c:width-1}},{s:{r:1,c:0},e:{r:1,c:width-1}}];if(report.type==='total')sheet['!merges'].push({s:{r:2,c:2},e:{r:2,c:4}},{s:{r:2,c:5},e:{r:2,c:7}});
 sheet['!cols']=headers(report.type).map((_,i)=>({wch:i===1?30:([2,3,5,6].includes(i)?26:20)}));
 for(let r=4;r<data.length;r++)for(const c of report.type==='regular'?[4]:[4,7,8]){const cell=sheet[XLSX.utils.encode_cell({r,c})];if(cell?.t==='n')cell.z='[h]:mm';}
 XLSX.utils.book_append_sheet(wb,sheet,title(report.type));
 const notes=[['Código','Usuario','Jornada','Zona horaria','Observaciones'],...report.rows.map(row=>[row.code,row.name,row.date,row.zone,row.issues.join('; ')||'Jornada cerrada'])];const ns=XLSX.utils.aoa_to_sheet(notes);ns['!cols']=[{wch:16},{wch:30},{wch:14},{wch:28},{wch:85}];XLSX.utils.book_append_sheet(wb,ns,'Observaciones');
 return XLSX.write(wb,{type:'buffer',bookType:'biff8'});
}
export function pdfReport(report){return new Promise((resolve,reject)=>{
 const doc=new PDFDocument({size:'A4',layout:'landscape',margin:28,bufferPages:true});const chunks=[];doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
 const available=doc.page.width-56, widths=report.type==='regular'?[65,160,175,175,available-575]:[48,116,99,99,64,99,99,68,available-792];
 // Nine columns share the printable width; keep all values within page bounds.
 if(report.type==='total'){const raw=[48,118,100,100,64,100,100,68,88],sum=raw.reduce((a,b)=>a+b,0);raw.forEach((v,i)=>widths[i]=v*available/sum);}
 let y=0;const draw=(values,fill,bold=false,height=38)=>{let x=28;values.forEach((value,i)=>{doc.rect(x,y,widths[i],height).fillAndStroke(fill,'#dce4ee');doc.fillColor('#20334d').font(bold?'Helvetica-Bold':'Helvetica').fontSize(bold?8:7.5).text(String(value),x+5,y+6,{width:widths[i]-10,height:height-10,ellipsis:true});x+=widths[i];});y+=height;};
 const heading=()=>{doc.font('Helvetica-Bold').fontSize(18).fillColor('#2457a7').text(title(report.type),28,24);doc.font('Helvetica').fontSize(9).fillColor('#526278').text(`${report.from} a ${report.to} | ${report.type==='regular'?regularNote:'Duraciones en horas:minutos'}`,28,49);y=72;
  if(report.type==='total'){let x=28+widths[0]+widths[1];for(const [label,start,end,color]of [['Horario Regular',2,5,'#fff0dc'],['Horas Extras',5,8,'#e5eeff']]){const w=widths.slice(start,end).reduce((a,b)=>a+b,0);doc.rect(x,y,w,21).fill(color);doc.fillColor('#20334d').fontSize(9).text(label,x+5,y+6,{width:w-10,align:'center'});x+=w;}y+=21;}
  draw(headers(report.type),'#edf2f8',true,34);
 };
 heading();let index=0;
 for(const row of report.rows){if(y+52>doc.page.height-35){doc.addPage();heading();}draw(cells(row,report.type),index++%2?'#f7f9fc':'#ffffff',false,42);}
 if(!report.rows.length)doc.fontSize(11).text('Sin jornadas en el rango seleccionado',28,y+12);
 const notes=report.rows.filter(row=>row.issues.length);if(notes.length){doc.addPage();doc.font('Helvetica-Bold').fontSize(16).fillColor('#2457a7').text('Observaciones',28,28);y=60;for(const row of notes){const line=`${row.date} · ${row.code} · ${row.name}: ${row.issues.join('; ')}`;doc.font('Helvetica').fontSize(9);const h=doc.heightOfString(line,{width:available})+12;if(y+h>doc.page.height-35){doc.addPage();y=30;}doc.fillColor('#20334d').text(line,28,y,{width:available});y+=h;}}
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.page.margins.bottom=0;doc.fontSize(8).fillColor('#637389').text(`B0D · ${i+1} / ${range.count}`,28,doc.page.height-24,{width:available,align:'right',lineBreak:false});}doc.end();
});}
