export function punchQuery(params){
 const values=[],where=[],add=value=>{values.push(value);return '$'+values.length;};
 const fail=message=>{const e=new Error(message);e.status=400;throw e;};
 const q=(params.get('q')||'').trim(),type=params.get('kind')||'',from=params.get('from')||'',to=params.get('to')||'';
 const offset=Number(params.get('offset')||0);
 if(!Number.isSafeInteger(offset)||offset<0)fail('Página inválida');
 if(q.length>100)fail('Busca con un máximo de 100 caracteres');
 if(q){const arg=add(q);where.push('(strpos(lower(worker_name),lower('+arg+'))>0 OR strpos(lower(worker_code),lower('+arg+'))>0)');}
 const types={IN:['IN',null],OUT:['OUT',null],MEAL_START:['BREAK_START','MEAL'],MEAL_END:['BREAK_END','MEAL'],REST_START:['BREAK_START','REST'],REST_END:['BREAK_END','REST']};
 if(type){if(!Object.hasOwn(types,type))fail('Tipo de checada inválido');const [kind,action]=types[type];where.push('kind='+add(kind));if(action)where.push("COALESCE(action,'REST')="+add(action));}
 for(const date of [from,to])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))fail('Selecciona fechas válidas');
 if(from&&to&&from>to)fail('La fecha final debe ser igual o posterior a la inicial');
 const date="(to_timestamp(occurred_at/1000.0) AT TIME ZONE zone_id)::date";
 if(from)where.push(date+'>='+add(from)+'::date');
 if(to)where.push(date+'<='+add(to)+'::date');
 return {sql:'SELECT event_id,worker_code,worker_name,kind,occurred_at,zone_id,method,action FROM b0d_punches'+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY occurred_at,event_id LIMIT 501 OFFSET '+add(offset),values,offset};
}

