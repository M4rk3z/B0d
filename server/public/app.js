const $ = id => document.getElementById(id);
let current;
let workerRows = [];
function showView(id, focus = false) {
  for (const view of document.querySelectorAll('.view')) view.hidden = view.id !== id;
  for (const button of document.querySelectorAll('[data-view]')) {
    if (button.dataset.view === id) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  if (focus) $(`${id}-title`).focus();
  $('status').textContent = '';
  if (id !== 'tablets') { $('device-token').value = ''; $('device-secret').hidden = true; }
  if (focus && id === 'tablets' && current?.role === 'Admin') loadDevices().catch(error => { $('status').textContent = error.message; });
  if (focus && id === 'attendance') loadPunches().catch(error => { $('status').textContent = error.message; });
  if (focus && id === 'schedules' && current?.role === 'Admin') loadSchedules().catch(error => { $('status').textContent = error.message; });
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => showView(button.dataset.view, true));
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) visible(false);
    throw new Error(data.error || 'No se pudo completar la operación');
  }
  return data;
}
const write = (path, data, method = 'POST') => api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
function visible(logged) {
    if (!logged) { scheduleRows=[];scheduleId=null;scheduleRevision=null;scheduleDirty=false;weekDraft=[];$('day-dialog').close();$('schedule-form').reset();$('schedule-days').replaceChildren();$('schedule-list').replaceChildren(); }
  if (!logged) { $('device-token').value = ''; $('device-secret').hidden = true; $('devices').replaceChildren(); $('punches').replaceChildren(); }
  $('login').hidden = logged; $('workspace').hidden = !logged; $('logout').hidden = !logged;
  if (!logged) { current = null; workerRows = []; $('profile').close(); $('profile-content').replaceChildren(); $('workers').replaceChildren(); $('users').replaceChildren(); $('identity').textContent = ''; $('account').reset(); $('worker').reset(); $('worker-search').value = ''; $('export-count').textContent = ''; }
}
function element(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
async function load() {
  current = await api('/api/me'); visible(true);
  showView('accounts');
  const admin = current.role === 'Admin';
  $('tablet-nav').hidden = !admin;
  $('schedule-nav').hidden = !admin;
  $('identity').textContent = `${current.username} · ${current.role}`;
  $('worker').hidden = !admin; $('user-list').hidden = !admin;
  $('role').replaceChildren(...(admin ? ['User', 'Admin'] : ['User']).map(role => { const option = element('option', role); option.value = role; return option; }));
  await loadWorkers(); if (admin) await loadUsers();
}
async function loadWorkers() {
  workerRows = await api('/api/workers'); renderWorkers(); updateExportCount();
}
function renderWorkers() {
  const query = $('worker-search').value.trim().toLocaleLowerCase('es');
  const workers = workerRows.filter(worker => `${worker.name} ${worker.code}`.toLocaleLowerCase('es').includes(query));
  $('workers').replaceChildren();
  if (!workers.length) $('workers').append(element('p', workerRows.length ? 'Sin coincidencias' : 'Sin colaboradores registrados'));
  for (const worker of workers) {
    const card = element('article', '', 'card');
    const open = element('button', 'Ver perfil', 'profile-button'); open.type = 'button'; open.setAttribute('aria-label', `Ver perfil de ${worker.name}`);
    open.addEventListener('click', async () => {
      open.disabled = true;
      try {
        const latest = await api('/api/workers'); const record = latest.find(row => row.id === worker.id);
        if (!record) throw new Error('El colaborador ya no está disponible');
        const details = document.createElement('dl');
        for (const [title, value] of [['Nombre', record.name], ['Código', record.code], ['Estado', record.active ? 'Activo' : 'Inactivo']]) details.append(element('dt', title), element('dd', value));
        $('profile-content').replaceChildren(details);
        if (current?.role === 'Admin') {
          const toggle = element('button', record.active ? 'Desactivar' : 'Activar'); toggle.type = 'button';
          toggle.addEventListener('click', async () => {
            toggle.disabled = true;
            try { await write(`/api/workers/${record.id}`, { active: !record.active }, 'PATCH'); $('profile').close(); await loadWorkers(); }
            catch (error) { $('status').textContent = error.message; $('profile').close(); }
          }); $('profile-content').append(toggle);
        }
        if (current?.role === 'Admin') $('profile-content').append(await profileSchedule(record));
        $('profile').showModal();
      } catch (error) { $('status').textContent = error.message; } finally { open.disabled = false; }
    });
    card.append(element('h3', worker.name), element('p', worker.code, 'muted'), element('span', worker.active ? 'Activo' : 'Inactivo', 'pill'), open); $('workers').append(card);
  }
}
$('worker-search').addEventListener('input', renderWorkers);
$('close-profile').addEventListener('click', () => $('profile').close());
function exportRows(rows) { const state = $('export-state').value; return rows.filter(row => state === 'all' || row.active === (state === 'active')); }
function updateExportCount() { const count = exportRows(workerRows).length; $('export-count').textContent = `${count} colaborador${count === 1 ? '' : 'es'}`; }
$('export-state').addEventListener('change', updateExportCount);
async function loadUsers() {
  const users = await api('/api/users'); $('users').replaceChildren();
  for (const user of users) {
    const form = element('form', '', 'card'); form.append(element('h3', user.username));
    const role = document.createElement('select'); role.setAttribute('aria-label', `Rol de ${user.username}`);
    for (const value of ['User', 'Admin']) { const option = element('option', value); option.value = value; role.append(option); } role.value = user.role;
    const active = document.createElement('input'); active.type = 'checkbox'; active.checked = user.active;
    const label = element('label', 'Activo', 'check'); label.append(active);
    const password = document.createElement('input'); password.type = 'password'; password.placeholder = 'Nueva contraseña (opcional)'; password.minLength = 12; password.maxLength = 256; password.autocomplete = 'new-password'; password.setAttribute('aria-label', `Nueva contraseña de ${user.username}`);
    const button = element('button', 'Guardar cambios'); form.append(role, label, password, button);
    form.addEventListener('submit', async event => {
      event.preventDefault(); button.disabled = true; $('status').textContent = '';
      try {
        await write(`/api/users/${user.id}`, { role: role.value, active: active.checked, ...(password.value ? { password: password.value } : {}) }, 'PATCH');
        password.value = '';
        if (user.id === current.id) { visible(false); $('status').textContent = 'Cambios guardados. Inicia sesión de nuevo.'; }
        else { await loadUsers(); $('status').textContent = 'Usuario actualizado'; }
      } catch (error) { $('status').textContent = error.message; } finally { button.disabled = false; }
    }); $('users').append(form);
  }
}
function submit(id, callback) {
  $(id).addEventListener('submit', async event => {
    event.preventDefault(); const button = $(id).querySelector('button'); button.disabled = true; $('status').textContent = '';
    try { await callback(Object.fromEntries(new FormData($(id)))); }
    catch (error) { $('status').textContent = error.message; }
    finally { button.disabled = false; }
  });
}
submit('login', async data => { try { await write('/api/login', data); await load(); } finally { $('login').elements.password.value = ''; } });
submit('worker', async data => { await write('/api/workers', data); $('worker').reset(); await loadWorkers(); });
submit('account', async data => { await write('/api/users', data); $('account').reset(); if (current.role === 'Admin') await loadUsers(); $('status').textContent = 'Usuario creado'; });
$('logout').addEventListener('click', async () => { try { await write('/api/logout', {}); visible(false); } catch (error) { $('status').textContent = error.message; } });
$('download').addEventListener('click', async () => {
  $('download').disabled = true; $('status').textContent = '';
  try {
    workerRows = await api('/api/workers'); updateExportCount(); renderWorkers();
    const rows = exportRows(workerRows);
    if (!rows.length) throw new Error('No hay colaboradores para descargar con este filtro');
    const cell = value => { let text = String(value); if (/^[\s]*[=+@-]/u.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
    const csv = '\ufeff' + [['Código', 'Nombre', 'Estado'], ...rows.map(row => [row.code, row.name, row.active ? 'Activo' : 'Inactivo'])].map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'B0d-colaboradores.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('status').textContent = 'Descarga generada';
  } catch (error) { $('status').textContent = error.message; } finally { $('download').disabled = false; }
});
load().catch(error => { visible(false); if (error.message !== 'Inicia sesión' && error.message !== 'La sesión terminó') $('status').textContent = error.message; });

let punchOffset = 0;
async function loadDevices() {
  const rows = await api('/api/devices'); $('devices').replaceChildren();
  for (const row of rows) {
    const card = element('article', '', 'card');
    card.append(element('h3', row.name), element('p', row.active ? 'Vinculación activa' : 'Revocada'), element('p', row.last_seen ? `Última conexión: ${new Date(row.last_seen).toLocaleString()}` : 'Esperando conexión', 'muted'));
    if (row.active) {
      const revoke = element('button', 'Revocar'); revoke.type = 'button';
      revoke.addEventListener('click', async () => {
        if (!confirm(`¿Revocar la conexión de ${row.name}? Los registros guardados se conservarán.`)) return;
        revoke.disabled = true;
        try { await write(`/api/devices/${row.id}`, {}, 'DELETE'); $('device-token').value = ''; $('device-secret').hidden = true; await loadDevices(); }
        catch (error) { $('status').textContent = error.message; revoke.disabled = false; }
      }); card.append(revoke);
    }
    const remove = element('button', 'Eliminar', 'danger'); remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar ${row.name}? Se bloqueará su conexión y se conservarán sus marcaciones.`)) return;
      remove.disabled = true;
      try { await write(`/api/devices/${row.id}/remove`, {}, 'DELETE'); $('device-token').value = ''; $('device-secret').hidden = true; await loadDevices(); }
      catch (error) { $('status').textContent = error.message; remove.disabled = false; }
    }); card.append(remove); $('devices').append(card);
  }
}
submit('device-form', async data => {
  const device = await write('/api/devices', data); $('device-token').value = device.code.slice(0,4) + ' ' + device.code.slice(4); $('device-secret').hidden = false; $('device-form').reset(); await loadDevices();
});
const kindLabel = row => ({ IN: 'Entrada', OUT: 'Salida', BREAK_START: row.action === 'MEAL' ? 'Inicio de comida' : 'Inicio de descanso', BREAK_END: row.action === 'MEAL' ? 'Fin de comida' : 'Fin de descanso' })[row.kind] || row.kind;
async function loadPunches(reset = true) {
  if (reset) { punchOffset = 0; $('punches').replaceChildren(); }
  const page = await api(`/api/punches?offset=${punchOffset}`);
  if (reset && !page.rows.length) $('punches').append(element('p', 'Todavía no hay marcaciones sincronizadas'));
  for (const row of page.rows) {
    const card = element('article', '', 'card'); card.append(element('h3', row.worker_name), element('p', row.worker_code, 'muted'), element('span', kindLabel(row), 'pill'), element('p', new Date(Number(row.occurred_at)).toLocaleString('es', { timeZone: row.zone_id })), element('p', row.zone_id, 'muted')); $('punches').append(card);
  }
  punchOffset = page.next; $('more-punches').hidden = page.next === null;
}
for (const [id, reset] of [['refresh-punches', true], ['more-punches', false]]) $(id).addEventListener('click', async () => {
  $(id).disabled = true; try { await loadPunches(reset); } catch (error) { $('status').textContent = error.message; } finally { $(id).disabled = false; }
});
$('download-punches').addEventListener('click', async () => {
  $('download-punches').disabled = true;
  try {
    let offset = 0; const rows = [];
    do { const page = await api(`/api/punches?offset=${offset}`); rows.push(...page.rows); offset = page.next; } while (offset !== null);
    const cell = value => { let text = String(value ?? ''); if (/^[\s]*[=+@-]/u.test(text)) text = "'" + text; return '"' + text.replaceAll('"','""') + '"'; };
    const values = [['Evento','Código','Nombre','Marcación','Fecha UTC','Zona','Método'], ...rows.map(row => [row.event_id,row.worker_code,row.worker_name,kindLabel(row),new Date(Number(row.occurred_at)).toISOString(),row.zone_id,row.method])];
    const blob = new Blob(['\ufeff'+values.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'B0d-marcaciones.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  } catch (error) { $('status').textContent = error.message; } finally { $('download-punches').disabled = false; }
});

let scheduleRows=[],scheduleId=null,scheduleRevision=null,scheduleDirty=false,weekDraft=[],editingDay=1;
const dayNames=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const scheduleRules=import('/schedule-rules.js');
const duration=n=>`${Math.floor(n/60)} h ${n%60} min`;
const clock12=value=>{const [h,m]=value.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;};
function timeControl(value,label){
 const box=element('label',label,'time12'),parts=value.split(':').map(Number);
 const fields=element('span','','time12-fields');
 for(const [name,values,selected] of [['hour',Array.from({length:12},(_,i)=>String(i+1)),String(parts[0]%12||12)],['minute',Array.from({length:60},(_,i)=>String(i).padStart(2,'0')),String(parts[1]).padStart(2,'0')],['period',['AM','PM'],parts[0]<12?'AM':'PM']]){
  const select=document.createElement('select');select.dataset.part=name;select.setAttribute('aria-label',`${label} ${name==='hour'?'hora':name==='minute'?'minuto':'AM o PM'}`);
  for(const v of values){const option=element('option',v);option.value=v;select.append(option);}select.value=selected;fields.append(select);
 }box.append(fields);return box;
}
function readTime(box){let h=Number(box.querySelector('[data-part=hour]').value)%12;if(box.querySelector('[data-part=period]').value==='PM')h+=12;return String(h).padStart(2,'0')+':'+box.querySelector('[data-part=minute]').value;}
function readSchedule(){return {name:$('schedule-name').value,zone:$('schedule-zone').value,markBreaks:$('schedule-mark').checked,days:weekDraft.filter(d=>d.selected).map(d=>{if(!d.configured)throw new Error(`Configura ${dayNames[d.weekday-1]}`);return {weekday:d.weekday,...d.value};})};}
async function schedulePreview(){try{const {validateSchedule}=await scheduleRules;const result=validateSchedule(readSchedule());$('schedule-summary').textContent=`${duration(result.weeklyMinutes)} efectivas / semana`;}catch(error){$('schedule-summary').textContent=error.message;}}
function scheduleChanged(){scheduleDirty=true;schedulePreview();}
function renderWeek(){
 $('schedule-days').replaceChildren();
 for(const d of weekDraft){const card=element('article','','calendar-day '+(d.selected?(d.configured?'ready':'pending'):'off'));
  const select=element('button',dayNames[d.weekday-1],'day-select');select.type='button';select.setAttribute('aria-pressed',String(d.selected));select.addEventListener('click',()=>{d.selected=!d.selected;scheduleChanged();renderWeek();});card.append(select);
  card.append(element('span',!d.selected?'Libre':d.configured?'Configurado':'Por configurar','day-state'));
  if(d.selected&&d.configured)card.append(element('p',`${clock12(d.value.start)} – ${clock12(d.value.end)}`),element('small',`${d.value.breaks.length} comida / descansos`));
  if(d.selected){const edit=element('button',d.configured?'Editar horas':'Configurar horas');edit.type='button';edit.addEventListener('click',()=>openDay(d.weekday));card.append(edit);}
  $('schedule-days').append(card);
 }
}
function addDialogBreak(rest={kind:'Comida',start:'13:00',end:'14:00'}){
 if($('day-breaks').children.length>=8){$('day-error').textContent='Máximo 8 pausas';return;}
 const row=element('div','','dialog-break');const kind=document.createElement('select');kind.setAttribute('aria-label','Tipo de pausa');for(const v of ['Comida','Descanso']){const option=element('option',v);option.value=v;kind.append(option);}kind.value=rest.kind;
 const remove=element('button','Quitar','danger');remove.type='button';remove.addEventListener('click',()=>row.remove());row.append(kind,timeControl(rest.start,'Inicio'),timeControl(rest.end,'Fin'),remove);$('day-breaks').append(row);
}
function openDay(day){editingDay=day;const draft=weekDraft[day-1];const value=draft.value||{start:'08:00',end:'17:00',breaks:[]};$('day-title').textContent=dayNames[day-1];$('day-times').replaceChildren(timeControl(value.start,'Entrada'),timeControl(value.end,'Salida'));$('day-breaks').replaceChildren();for(const r of value.breaks)addDialogBreak(r);$('day-error').textContent='';$('day-copy').checked=false;$('day-dialog').showModal();}
$('day-add-break').addEventListener('click',()=>addDialogBreak());
$('day-cancel').addEventListener('click',()=>$('day-dialog').close());
$('day-form').addEventListener('submit',async event=>{
 event.preventDefault();const times=$('day-times').children;const value={start:readTime(times[0]),end:readTime(times[1]),breaks:[...$('day-breaks').children].map(row=>({kind:row.querySelector('select').value,start:readTime(row.querySelectorAll('.time12')[0]),end:readTime(row.querySelectorAll('.time12')[1])}))};
 try{
  const {validateSchedule}=await scheduleRules;const changed=structuredClone(weekDraft);
  for(const d of changed)if(d.weekday===editingDay||($('day-copy').checked&&d.selected)){d.value=structuredClone(value);d.configured=true;}
  validateSchedule({name:$('schedule-name').value.trim()||'Horario',zone:$('schedule-zone').value,markBreaks:$('schedule-mark').checked,days:changed.filter(d=>d.selected&&d.configured).map(d=>({weekday:d.weekday,...d.value}))});
  weekDraft=changed;scheduleChanged();renderWeek();$('day-dialog').close();
 }catch(error){$('day-error').textContent=error.message;}
});
function editSchedule(row=null){
 if(scheduleDirty&&!confirm('¿Descartar cambios sin guardar?'))return;
 scheduleId=row?.id||null;scheduleRevision=row?.revision||null;const value=row?.definition||{name:'',zone:'America/Mexico_City',markBreaks:false,days:[]};
 $('schedule-name').value=value.name;if(![...$('schedule-zone').options].some(o=>o.value===value.zone)){const option=element('option',value.zone);option.value=value.zone;$('schedule-zone').append(option);}$('schedule-zone').value=value.zone;$('schedule-mark').checked=value.markBreaks;
 weekDraft=dayNames.map((_,i)=>{const d=value.days.find(d=>d.weekday===i+1);return {weekday:i+1,selected:Boolean(d),configured:Boolean(d),value:d?{start:d.start,end:d.end,breaks:structuredClone(d.breaks)}:null};});
 $('schedule-message').textContent='';$('save-schedule').textContent=scheduleId?'Guardar cambios':'Crear horario';scheduleDirty=false;renderWeek();schedulePreview();renderSchedules();
}
function renderSchedules(){
 $('schedule-list').replaceChildren();const query=$('schedule-search').value.trim().toLocaleLowerCase('es');const rows=scheduleRows.filter(row=>row.definition.name.toLocaleLowerCase('es').includes(query));if(!rows.length)$('schedule-list').append(element('p','Sin horarios'));
 for(const row of rows){const button=element('button','','schedule-choice');button.type='button';button.setAttribute('aria-pressed',String(row.id===scheduleId));button.append(element('strong',row.definition.name),element('span',`${row.definition.days.length} días · ${duration(row.definition.weeklyMinutes)}`));button.addEventListener('click',async()=>{try{scheduleRows=await api('/api/schedules');editSchedule(scheduleRows.find(r=>r.id===row.id));}catch(error){$('schedule-message').textContent=error.message;}});$('schedule-list').append(button);}
}
async function loadSchedules(){scheduleRows=await api('/api/schedules');if(!$('schedule-days').children.length)editSchedule();else renderSchedules();}
$('schedule-search').addEventListener('input',renderSchedules);$('new-schedule').addEventListener('click',()=>editSchedule());$('schedule-form').addEventListener('input',scheduleChanged);$('schedule-form').addEventListener('change',scheduleChanged);
$('schedule-form').addEventListener('submit',async event=>{
 event.preventDefault();$('save-schedule').disabled=true;
 try{const {validateSchedule}=await scheduleRules;const definition=validateSchedule(readSchedule());const saved=await write(scheduleId?`/api/schedules/${scheduleId}`:'/api/schedules',{...definition,revision:scheduleRevision},scheduleId?'PATCH':'POST');scheduleDirty=false;scheduleRows=await api('/api/schedules');editSchedule(saved);$('schedule-message').textContent='Guardado. Para aplicar esta versión, asígnala desde el perfil del colaborador.';}catch(error){$('schedule-message').textContent=error.message;}finally{$('save-schedule').disabled=false;}
});
async function profileSchedule(worker){
 const [schedules,assignments]=await Promise.all([api('/api/schedules'),api('/api/schedule-assignments')]);
 const box=element('section','','profile-schedule');box.append(element('h3','Horario'));const last=assignments.find(a=>a.worker_id===worker.id);box.append(element('p',last?`${last.name} · v${last.revision} · desde ${last.effective_date}`:'Sin horario web asignado','muted'));
 const form=document.createElement('form');const select=document.createElement('select');select.setAttribute('aria-label','Horario');for(const row of schedules){const option=element('option',`${row.definition.name} · v${row.revision}`);option.value=row.id;select.append(option);}if(last)select.value=last.schedule_id;
 const date=document.createElement('input');date.type='date';date.required=true;date.setAttribute('aria-label','Fecha de inicio');const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);date.value=`${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
 const label=element('label','Aplicar desde (a partir de mañana)');label.append(date);const save=element('button','Guardar asignación');save.disabled=!schedules.length;const message=element('p','');message.setAttribute('role','status');form.append(select,label,save,message);
 form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{await write('/api/schedule-assignments',{workerId:worker.id,scheduleId:select.value,date:date.value});message.textContent='Asignación guardada. Se enviará a la tablet en la próxima sincronización.';}catch(error){message.textContent=error.message;}finally{save.disabled=!schedules.length;}});
 const edit=element('button','Editar horario');edit.type='button';edit.disabled=!schedules.length;edit.addEventListener('click',async()=>{try{scheduleRows=await api('/api/schedules');const row=scheduleRows.find(row=>row.id===select.value);$('profile').close();showView('schedules');editSchedule(row);}catch(error){message.textContent=error.message;}});box.append(form,edit);return box;
}
