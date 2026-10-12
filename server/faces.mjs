import {randomUUID,randomInt,createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const fail=(ok,status,message)=>{if(!ok){const e=new Error(message);e.status=status;throw e;}};
function key(){const value=process.env.FACE_ENCRYPTION_KEY;fail(value&&value.length>=32,503,'La captura web necesita configurar FACE_ENCRYPTION_KEY en Render');return createHash('sha256').update(value).digest();}
export function encryptSamples(worker,revision,samples){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(worker+revision));const bytes=Buffer.concat([cipher.update(JSON.stringify(samples)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64');}
export function decryptSamples(row){const data=Buffer.from(row.encrypted_samples,'base64'),cipher=createDecipheriv('aes-256-gcm',key(),data.subarray(0,12));cipher.setAAD(Buffer.from(row.worker_id+row.revision));cipher.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString());}
export function jpegSize(bytes){
 fail(bytes.length>4&&bytes[0]===255&&bytes[1]===216,400,'Imagen JPEG inválida');
 for(let i=2;i+4<bytes.length;){
  fail(bytes[i]===255,400,'JPEG inválido');while(bytes[i]===255)i++;const marker=bytes[i++];
  if(marker===217||marker===218)break;
  const len=bytes.readUInt16BE(i);fail(len>=2&&i+len<=bytes.length,400,'JPEG incompleto');
  if([192,193,194].includes(marker)){fail(len>=8,400,'JPEG inválido');return {height:bytes.readUInt16BE(i+3),width:bytes.readUInt16BE(i+5)};}i+=len;
 }fail(false,400,'No se pudieron leer las dimensiones');
}
export function validateSamples(samples,poses){
 fail(Array.isArray(samples)&&samples.length===5,400,'Completa las cinco posiciones del rostro');
 const hashes=new Set();let last=-1000;
 return samples.map((sample,i)=>{
  fail(sample&&sample.pose===poses[i]&&Number.isInteger(sample.elapsed)&&sample.elapsed-last>=350&&sample.elapsed<=90000,400,'Secuencia de movimientos incompleta');
  last=sample.elapsed;
  fail(typeof sample.jpeg==='string'&&sample.jpeg.length<=240000&&/^[A-Za-z0-9+/]+={0,2}$/.test(sample.jpeg),400,'Captura inválida');
  const bytes=Buffer.from(sample.jpeg,'base64'),size=jpegSize(bytes);
  fail(size.width>=160&&size.height>=160&&size.width<=640&&size.height<=640,400,'Acerca el rostro a la cámara');
  hashes.add(createHash('sha256').update(bytes).digest('hex'));return sample.jpeg;
 }).map((sample,i,all)=>{fail(hashes.size===all.length,400,'Repite la captura con movimientos reales');return sample;});
}
export async function faceRoute(pool,current,worker,method,challenge,input){
 fail(/^[0-9a-f-]{36}$/i.test(worker),400,'Colaborador inválido');
 fail((await pool.query('SELECT 1 FROM b0d_workers WHERE id=$1',[worker])).rows.length,404,'Colaborador no encontrado');
 if(challenge&&method==='POST'){
  key();const id=randomUUID(),side=randomInt(2)?'left':'right',poses=['center',side,'center',side==='left'?'right':'left','center'];
  await pool.query('DELETE FROM b0d_face_challenges WHERE expires_at<now() OR (worker_id=$1 AND user_id=$2)',[worker,current.id]);
  await pool.query("INSERT INTO b0d_face_challenges VALUES($1,$2,$3,$4,now()+interval '3 minutes')",[id,worker,current.id,JSON.stringify(poses)]);
  return {id,poses};
 }
 if(!challenge&&method==='POST'){
  fail(typeof input?.challenge==='string'&&/^[0-9a-f-]{36}$/i.test(input.challenge),400,'Reinicia la captura');
  const client=await pool.connect();try{
   await client.query('BEGIN');
   const row=(await client.query('SELECT poses FROM b0d_face_challenges WHERE id=$1 AND worker_id=$2 AND user_id=$3 AND expires_at>now() FOR UPDATE',[input.challenge,worker,current.id])).rows[0];
   fail(row,409,'La captura venció o ya se utilizó. Reintenta');
   const samples=validateSamples(input.samples,row.poses),revision=randomUUID(),encrypted=encryptSamples(worker,revision,samples);
   await client.query('INSERT INTO b0d_face_profiles(worker_id,revision,encrypted_samples) VALUES($1,$2,$3) ON CONFLICT(worker_id) DO UPDATE SET revision=$2,encrypted_samples=$3,deleted=false,captured_at=now()',[worker,revision,encrypted]);
   await client.query('DELETE FROM b0d_face_challenges WHERE id=$1',[input.challenge]);await client.query('COMMIT');return {captured:true,ready:false};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 if(!challenge&&method==='DELETE'){
  await pool.query('INSERT INTO b0d_face_profiles(worker_id,revision,deleted) VALUES($1,$2,true) ON CONFLICT(worker_id) DO UPDATE SET revision=$2,encrypted_samples=NULL,deleted=true,captured_at=now()',[worker,randomUUID()]);
  return {captured:false};
 }
 fail(false,405,'Método no permitido');
}
export const workerFaceQuery=`SELECT w.id,w.code,w.name,w.active,
 (f.worker_id IS NOT NULL OR EXISTS(SELECT 1 FROM b0d_device_faces d WHERE d.worker_id=w.id)) AS face_known,
 CASE WHEN f.deleted THEN false ELSE f.encrypted_samples IS NOT NULL OR EXISTS(SELECT 1 FROM b0d_device_faces d JOIN b0d_devices v ON v.id=d.device_id AND v.active WHERE d.worker_id=w.id AND d.present) END AS face_captured,
 CASE WHEN f.deleted THEN false ELSE EXISTS(SELECT 1 FROM b0d_device_faces d JOIN b0d_devices v ON v.id=d.device_id AND v.active WHERE d.worker_id=w.id AND d.present AND (f.revision IS NULL OR d.revision=f.revision)) END AS face_ready,
 EXISTS(SELECT 1 FROM b0d_device_faces d JOIN b0d_devices v ON v.id=d.device_id AND v.active WHERE d.worker_id=w.id AND d.error IS NOT NULL AND d.revision=f.revision) AS face_error
 FROM b0d_workers w LEFT JOIN b0d_face_profiles f ON f.worker_id=w.id ORDER BY w.active DESC,w.name,w.code`;
export async function deviceFaceRoute(client,device,path,input){
 if(path==='/api/device/faces')return {profiles:(await client.query('SELECT worker_id,revision,deleted FROM b0d_face_profiles')).rows};
 if(path==='/api/device/face'){
  fail(typeof input?.workerId==='string'&&/^[0-9a-f-]{36}$/i.test(input.workerId),400,'Colaborador inválido');
  const row=(await client.query('SELECT f.* FROM b0d_face_profiles f JOIN b0d_device_workers m ON m.worker_id=f.worker_id WHERE m.device_id=$1 AND m.local_id=$2',[device,input.workerId])).rows[0];
  fail(row,404,'Perfil no disponible');return {revision:row.revision,deleted:row.deleted,samples:row.deleted?[]:decryptSamples(row)};
 }
 if(path==='/api/device/face-status'){
  fail(Array.isArray(input?.profiles)&&input.profiles.length<=50,400,'Estado inválido');
  for(const p of input.profiles){
   fail(p&&typeof p.workerId==='string'&&/^[0-9a-f-]{36}$/i.test(p.workerId)&&typeof p.present==='boolean'&&Number.isInteger(p.samples)&&p.samples>=0&&p.samples<=5&&(p.revision===null||/^[0-9a-f-]{36}$/i.test(p.revision))&&[null,'capture_rejected'].includes(p.error),400,'Estado inválido');
   const map=(await client.query('SELECT worker_id FROM b0d_device_workers WHERE device_id=$1 AND local_id=$2',[device,p.workerId])).rows[0];fail(map,403,'Colaborador no vinculado');
   if(p.present&&p.revision)await client.query('UPDATE b0d_face_profiles SET deleted=false WHERE worker_id=$1 AND revision=$2 AND deleted=true',[map.worker_id,p.revision]);
   await client.query('INSERT INTO b0d_device_faces(device_id,worker_id,present,samples,revision,error) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(device_id,worker_id) DO UPDATE SET present=$3,samples=$4,revision=$5,error=$6,updated_at=now()',[device,map.worker_id,p.present,p.samples,p.revision,p.error]);
  }return {stored:true};
 }
 fail(false,404,'Ruta no disponible');
}
