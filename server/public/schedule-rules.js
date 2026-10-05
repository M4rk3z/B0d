const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const minutes = text => {
 ensure(typeof text === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(text), 'Usa horas válidas de 00:00 a 23:59');
 return Number(text.slice(0,2))*60+Number(text.slice(3));
};
export function validateSchedule(input) {
 ensure(input && typeof input.name === 'string' && input.name.trim().length > 0 && input.name.trim().length <= 80 && !/[\x00-\x1f\x7f]/.test(input.name), 'Escribe un nombre de hasta 80 caracteres');
 ensure(typeof input.zone === 'string' && input.zone.length <= 100, 'Selecciona una zona horaria');
 try { new Intl.DateTimeFormat('es',{timeZone:input.zone}); } catch { throw new Error('Zona horaria inválida'); }
 ensure(typeof input.markBreaks === 'boolean', 'Modo de descansos inválido');
 ensure(Array.isArray(input.days) && input.days.length >= 1 && input.days.length <= 7, 'Selecciona al menos un día');
 const days = input.days.map(day => {
  ensure(day && Number.isInteger(day.weekday) && day.weekday>=1 && day.weekday<=7, 'Día inválido');
  const start=minutes(day.start); const finish=minutes(day.end);
  ensure(start!==finish, 'Entrada y salida no pueden ser iguales');
  const end=finish<start?finish+1440:finish;
  ensure(Array.isArray(day.breaks) && day.breaks.length<=8,'Máximo 8 comidas o descansos por día');
  const breaks=day.breaks.map(rest=>{
   ensure(rest && ['Comida','Descanso'].includes(rest.kind),'Tipo de descanso inválido');
   const from=(minutes(rest.start)-start+1440)%1440, to=(minutes(rest.end)-start+1440)%1440;
   ensure(to>from && to<=end-start,'La comida y los descansos deben quedar dentro del turno');
   return {kind:rest.kind,start:rest.start,end:rest.end,from,to};
  }).sort((a,b)=>a.from-b.from);
  let previous=-1, excluded=0;
  for (const rest of breaks) { ensure(rest.from>=previous,'Los descansos no pueden superponerse'); previous=rest.to; excluded+=rest.to-rest.from; }
  ensure(end-start-excluded>0,'Debe quedar tiempo efectivo de trabajo');
  return {weekday:day.weekday,start:day.start,end:day.end,breaks:breaks.map(({kind,start,end})=>({kind,start,end})),effectiveMinutes:end-start-excluded,overnight:finish<start};
 }).sort((a,b)=>a.weekday-b.weekday);
 for (let i=0;i<days.length;i++) {
  const day=days[i], next=days[(i+1)%days.length];
  if (i+1<days.length) ensure(day.weekday!==next.weekday,'Día repetido');
  const end=(day.weekday-1)*1440+minutes(day.end)+(day.overnight?1440:0);
  const nextStart=(next.weekday-1)*1440+minutes(next.start)+(i===days.length-1?10080:0);
  ensure(end<=nextStart,'Un turno nocturno se superpone con el día siguiente');
 }
 return {name:input.name.trim(),zone:input.zone,markBreaks:input.markBreaks,days,weeklyMinutes:days.reduce((sum,day)=>sum+day.effectiveMinutes,0)};
}
