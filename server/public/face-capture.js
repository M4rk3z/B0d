import {MotionSteps} from '/face-motion.js';
let cancelActive=null;
export function closeFaceCapture(){cancelActive?.();}
export async function openFaceCapture(worker,api,write,onSaved){
 closeFaceCapture();
 const dialog=document.getElementById('face-dialog'),video=document.getElementById('face-video'),canvas=document.getElementById('face-overlay'),message=document.getElementById('face-message'),progress=document.getElementById('face-progress'),start=document.getElementById('face-start'),save=document.getElementById('face-save'),consent=document.getElementById('face-consent');
 let stream=null,detector=null,timer=null,closed=false,samples=[],challenge=null,started=0,steps=null,lastTime=-1;
 const stopCamera=()=>{clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;detector?.close();detector=null;};
 const hidden=()=>{if(document.hidden)cleanup();};
 const cleanup=()=>{if(closed)return;closed=true;document.removeEventListener('visibilitychange',hidden);stopCamera();samples=[];dialog.close();cancelActive=null;};
 cancelActive=cleanup;document.getElementById('face-close').onclick=cleanup;
 dialog.oncancel=event=>{event.preventDefault();cleanup();};
 dialog.onclose=cleanup;
 document.getElementById('face-worker').textContent=worker.name+' · '+worker.code;
 consent.checked=false;start.disabled=false;save.disabled=true;progress.value=0;message.textContent='La captura requiere autorización del colaborador. Sigue las flechas sin mover la cámara.';canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
 dialog.showModal();
 const frame=document.createElement('canvas'),crop=document.createElement('canvas');
 const prompt=pose=>pose==='center'?'Mira al frente':pose==='left'?'← Gira ligeramente hacia la flecha':'Gira ligeramente hacia la flecha →';
 async function tick(){
  if(closed||!detector)return;
  try{
   if(performance.now()-started>90000)throw new Error('Tiempo agotado. Inicia una captura nueva.');
   if(video.readyState<2||video.currentTime===lastTime){timer=setTimeout(tick,140);return;}lastTime=video.currentTime;
   frame.width=video.videoWidth;frame.height=video.videoHeight;const ctx=frame.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0);
   const result=detector.detectForVideo(video,performance.now()),landmarks=result.faceLandmarks;
   canvas.width=frame.width;canvas.height=frame.height;const overlay=canvas.getContext('2d');overlay.clearRect(0,0,canvas.width,canvas.height);
   const pose=challenge.poses[steps.index];message.textContent=(steps.index+1)+'/5 · '+prompt(pose);
   let valid=landmarks.length===1,ratio=NaN,box=null;
   if(valid){
    const points=landmarks[0],xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
    ratio=2*(points[1].x-(points[33].x+points[263].x)/2)/Math.abs(points[263].x-points[33].x);
    valid=w*frame.width>=160&&h*frame.height>=160&&x>0.03&&y>0.03&&x+w<0.97&&y+h<0.97;
    overlay.fillStyle='#39d8a4';for(let i=0;i<points.length;i+=3){overlay.beginPath();overlay.arc(points[i].x*canvas.width,points[i].y*canvas.height,1.5,0,7);overlay.fill();}
    box={x:Math.max(0,Math.floor((x-w*.18)*frame.width)),y:Math.max(0,Math.floor((y-h*.18)*frame.height)),w:Math.ceil(w*1.36*frame.width),h:Math.ceil(h*1.36*frame.height)};
    box.w=Math.min(box.w,frame.width-box.x);box.h=Math.min(box.h,frame.height-box.y);
    if(valid){
     const pixels=ctx.getImageData(Math.floor(x*frame.width),Math.floor(y*frame.height),Math.floor(w*frame.width),Math.floor(h*frame.height)),data=pixels.data;let sum=0,edges=0,count=0;
     for(let i=4;i<data.length-4;i+=16){const light=(data[i]+data[i+1]+data[i+2])/3;sum+=light;edges+=Math.abs(light-(data[i-4]+data[i-3]+data[i-2])/3);count++;}
     valid=sum/count>35&&sum/count<225&&edges/count>1.2;
     if(!valid)message.textContent='Mejora la luz y mantén el rostro enfocado.';
    }
   }else message.textContent=landmarks.length>1?'Solo una persona frente a la cámara.':'Centra tu rostro y acércate.';
   if(steps.observe(ratio,valid,performance.now())){
    const scale=Math.min(1,640/Math.max(box.w,box.h));crop.width=Math.round(box.w*scale);crop.height=Math.round(box.h*scale);crop.getContext('2d').drawImage(frame,box.x,box.y,box.w,box.h,0,0,crop.width,crop.height);
    const jpeg=crop.toDataURL('image/jpeg',0.86).split(',')[1];samples.push({jpeg,pose,elapsed:Math.round(performance.now()-started)});progress.value=samples.length;
    if(samples.length===5){stopCamera();message.textContent='Movimientos completados. Guarda el perfil para enviarlo a las tablets.';save.disabled=false;start.disabled=false;return;}
   }
   timer=setTimeout(tick,140);
  }catch(error){stopCamera();message.textContent=error.message;start.disabled=false;samples=[];}
 }
 start.onclick=async()=>{
  if(!consent.checked){message.textContent='Confirma la autorización antes de activar la cámara.';return;}
  stopCamera();start.disabled=true;save.disabled=true;samples=[];progress.value=0;message.textContent='Preparando cámara y guía facial…';
  try{
   challenge=await write('/api/workers/'+worker.id+'/face/challenge',{});
   const {FaceLandmarker,FilesetResolver}=await import('/face-vendor/vision_bundle.mjs');
   const vision=await FilesetResolver.forVisionTasks('/face-vendor/wasm');
   if(closed)return;
   const model=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'/models/face_landmarker.task'},runningMode:'VIDEO',numFaces:2,minFaceDetectionConfidence:.7,minFacePresenceConfidence:.7,minTrackingConfidence:.7});
   if(closed){model.close();return;}detector=model;
   const camera=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
   if(closed){camera.getTracks().forEach(t=>t.stop());return;}
   stream=camera;video.srcObject=stream;await video.play();if(closed)return;
   started=performance.now();steps=new MotionSteps(challenge.poses);lastTime=-1;tick();
  }catch(error){stopCamera();if(!closed){message.textContent=error.name==='NotAllowedError'?'Permite el acceso a la cámara e inténtalo otra vez.':error.message;start.disabled=false;}}
 };
 save.onclick=async()=>{
  save.disabled=true;start.disabled=true;message.textContent='Guardando captura cifrada…';
  try{await write('/api/workers/'+worker.id+'/face',{challenge:challenge.id,samples});cleanup();await onSaved();}
  catch(error){if(!closed){message.textContent=error.message;save.disabled=false;start.disabled=false;}}
 };
 document.addEventListener('visibilitychange',hidden);
}
