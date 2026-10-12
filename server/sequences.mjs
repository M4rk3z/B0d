export const defaults={meal:{enabled:true,from:0,to:1440},rest:{enabled:true,from:0,to:1440}};
export function validateSequence(value){
 const out={};for(const key of ['meal','rest']){
  const rule=value?.[key];
  if(!rule||typeof rule.enabled!=='boolean'||!Number.isInteger(rule.from)||!Number.isInteger(rule.to)||rule.from<0||rule.to>2880||rule.from>=rule.to){const e=new Error('Define límites válidos: desde 0 hasta 48 horas, con inicio menor que fin');e.status=400;throw e;}
  out[key]={enabled:rule.enabled,from:rule.from,to:rule.to};
 }return out;
}
export async function getSequence(pool){return (await pool.query('SELECT definition FROM b0d_sequences WHERE id=1')).rows[0].definition;}
