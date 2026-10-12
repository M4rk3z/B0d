const $ = id => document.getElementById(id);
let current;
let workerRows = [];
function showView(id, focus = false) {
  for (const view of document.querySelectorAll('.view')) view.hidden = view.id !== id;
  for (const button of document.querySelectorAll('[data-view]')) {
    if (button.dataset.view === id) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  $('settings-nav').classList.toggle('current', ['accounts','tablets'].includes(id));
  $('settings-nav').open = false;
  if (focus) $(`${id}-title`).focus();
  $('status').textContent = '';
  if (id !== 'tablets') { $('device-token').value = ''; $('device-secret').hidden = true; }
  if (focus && id === 'tablets' && current?.role === 'Admin') loadDevices().catch(error => { $('status').textContent = error.message; });
  if (focus && id === 'sequences') loadSequence().catch(error=>{$('sequence-error').textContent=error.message;});
  if (focus && id === 'attendance') loadPunches().catch(error => { $('status').textContent = error.message; });
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
    document.body.classList.toggle('login-screen', !logged);
    if (logged) document.querySelector('.app-header').after($('status'));
    else $('login').insertBefore($('status'), $('login').querySelector('button'));
    if (!logged) { ++punchRequest;appliedPunchFilters=new URLSearchParams();$('punch-filters').reset();$('report-preview').replaceChildren(); $('report-status').textContent = ''; }
    if (!logged) { $('password-dialog').close();finishConfirm(false); }
  if (!logged) { $('device-token').value = ''; $('device-secret').hidden = true; $('devices').replaceChildren(); $('punches').replaceChildren(); }
  $('login').hidden = logged; $('workspace').hidden = !logged; $('logout').hidden = !logged; $('identity').hidden = !logged;
  if (!logged) { current = null; workerRows = []; $('profile').close(); $('profile-content').replaceChildren(); $('workers').replaceChildren(); $('users').replaceChildren(); $('identity').textContent = ''; $('account').reset(); $('worker').reset(); $('worker-search').value = ''; $('export-count').textContent = ''; }
}
function element(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
async function load() {
  current = await api('/api/me'); visible(true);
  showView('staff');
  const admin = current.role === 'Admin';
    $('demo-seed').hidden = !admin;
  $('tablet-nav').hidden = !admin;
  $('settings-nav').hidden = !admin;
  $('identity').textContent = `${current.username} · ${current.role}`;
  $('worker').hidden = false; $('user-list').hidden = !admin;
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
        if (current) {
          const toggle = element('button', record.active ? 'Desactivar' : 'Activar'); toggle.type = 'button';
          toggle.addEventListener('click', async () => {
            toggle.disabled = true;
            try { await write(`/api/workers/${record.id}`, { active: !record.active }, 'PATCH'); $('profile').close(); await loadWorkers(); }
            catch (error) { $('status').textContent = error.message; $('profile').close(); }
          }); $('profile-content').append(toggle);
        }
        $('profile-content').append(workerEditor(record));
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
    const password = element('button', 'Cambiar contraseña', 'secondary'); password.type='button';
    password.addEventListener('click',()=>openPassword(user));
    const button = element('button', 'Guardar cambios'); form.append(role, label, password, button);
    form.addEventListener('submit', async event => {
      event.preventDefault(); button.disabled = true; $('status').textContent = '';
      try {
        await write(`/api/users/${user.id}`, { role: role.value, active: active.checked }, 'PATCH');

        if (user.id === current.id) { visible(false); $('status').textContent = ''; }
        else { await loadUsers(); $('status').textContent = ''; }
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
submit('account', async data => { await write('/api/users', data); $('account').reset(); if (current.role === 'Admin') await loadUsers(); $('status').textContent = ''; });
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
    $('status').textContent = '';
  } catch (error) { $('status').textContent = error.message; } finally { $('download').disabled = false; }
});
load().catch(error => { visible(false); if (error.message !== 'Inicia sesión' && error.message !== 'La sesión terminó') $('status').textContent = error.message; });

let punchOffset = 0, punchRequest = 0;
let appliedPunchFilters=new URLSearchParams();
async function loadDevices() {
  const rows = await api('/api/devices'); $('devices').replaceChildren();
  for (const row of rows) {
    const card = element('article', '', 'card');
    card.append(element('h3', row.name), element('p', row.active ? 'Vinculación activa' : 'Revocada'), element('p', row.last_seen ? `Última conexión: ${new Date(row.last_seen).toLocaleString()}` : 'Esperando conexión', 'muted'));
    if (row.active) {
      const revoke = element('button', 'Revocar'); revoke.type = 'button';
      revoke.addEventListener('click', async () => {
        if (!await confirmAction(`¿Revocar la conexión de ${row.name}? Los registros guardados se conservarán.`)) return;
        revoke.disabled = true;
        try { await write(`/api/devices/${row.id}`, {}, 'DELETE'); $('device-token').value = ''; $('device-secret').hidden = true; await loadDevices(); }
        catch (error) { $('status').textContent = error.message; revoke.disabled = false; }
      }); card.append(revoke);
    }
    const remove = element('button', 'Eliminar', 'danger'); remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!await confirmAction(`¿Eliminar ${row.name}? Se bloqueará su conexión y se conservarán sus marcaciones.`)) return;
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
  const request=++punchRequest;
  if (reset) { punchOffset = 0; $('punches').replaceChildren(); $('more-punches').hidden=true; }
  const params=new URLSearchParams(appliedPunchFilters);params.set('offset',punchOffset);
  const page = await api('/api/punches?'+params);
  if(request!==punchRequest||!current)return;
  if (reset && !page.rows.length) $('punches').append(element('p', 'No hay marcaciones con estos filtros'));
  for (const row of page.rows) {
    const card = element('article', '', 'card'); card.append(element('h3', row.worker_name), element('p', row.worker_code, 'muted'), element('span', kindLabel(row), 'pill punch-'+row.kind.toLowerCase()), element('p', new Date(Number(row.occurred_at)).toLocaleString('es', { timeZone: row.zone_id })), element('p', row.zone_id, 'muted')); $('punches').append(card);
  }
  punchOffset = page.next; $('more-punches').hidden = page.next === null;
}
for (const [id, reset] of [['refresh-punches', true], ['more-punches', false]]) $(id).addEventListener('click', async () => {
  $(id).disabled = true; try { await loadPunches(reset); } catch (error) { $('status').textContent = error.message; } finally { $(id).disabled = false; }
});
$('punch-filters').addEventListener('submit',async event=>{
 event.preventDefault();
 appliedPunchFilters=new URLSearchParams({q:$('punch-search').value.trim(),kind:$('punch-kind').value,from:$('punch-from').value,to:$('punch-to').value});
 $('status').textContent='';
 try{await loadPunches();}catch(error){$('status').textContent=error.message;}
});
$('punch-clear').addEventListener('click',()=>{$('punch-filters').reset();$('punch-filters').requestSubmit();});
$('download-punches').addEventListener('click', async () => {
  $('download-punches').disabled = true;
  try {
    let offset = 0; const rows = [];const filters=new URLSearchParams(appliedPunchFilters);
    do { filters.set('offset',offset);const page = await api('/api/punches?'+filters); rows.push(...page.rows); offset = page.next; } while (offset !== null);
    const cell = value => { let text = String(value ?? ''); if (/^[\s]*[=+@-]/u.test(text)) text = "'" + text; return '"' + text.replaceAll('"','""') + '"'; };
    const values = [['Evento','Código','Nombre','Marcación','Fecha UTC','Zona','Método'], ...rows.filter(row=>$('report-breaks').checked||['IN','OUT'].includes(row.kind)).map(row => [row.event_id,row.worker_code,row.worker_name,kindLabel(row),new Date(Number(row.occurred_at)).toISOString(),row.zone_id,row.method])];
    const blob = new Blob(['\ufeff'+values.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'B0d-marcaciones.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  } catch (error) { $('status').textContent = error.message; } finally { $('download-punches').disabled = false; }
});

let confirmResolve=null,passwordUser=null;
function confirmAction(message){
 if(confirmResolve)return Promise.resolve(false);
 $('confirm-message').textContent=message;$('confirm-dialog').showModal();$('confirm-no').focus();
 return new Promise(resolve=>{confirmResolve=resolve;});
}
function finishConfirm(value){const resolve=confirmResolve;confirmResolve=null;$('confirm-dialog').close();if(resolve)resolve(value);}
$('confirm-no').addEventListener('click',()=>finishConfirm(false));$('confirm-yes').addEventListener('click',()=>finishConfirm(true));
$('confirm-dialog').addEventListener('cancel',event=>{event.preventDefault();finishConfirm(false);});
function openPassword(user){passwordUser=user;$('password-form').reset();$('password-message').textContent='';$('password-title').textContent='Contraseña · '+user.username;$('password-dialog').showModal();$('new-password').focus();}
$('password-cancel').addEventListener('click',()=>$('password-dialog').close());
$('password-dialog').addEventListener('close',()=>{$('password-form').reset();passwordUser=null;});
submit('password-form',async()=>{
 if($('new-password').value!==$('repeat-password').value){$('password-message').textContent='Las contraseñas no coinciden';return;}
 const user=passwordUser;
 try{await write('/api/users/'+user.id,{password:$('new-password').value},'PATCH');$('password-dialog').close();
 if(user.id===current.id){visible(false);$('status').textContent='';}else $('status').textContent='';
 }catch(error){$('password-message').textContent=error.message;}
});
const reportToday=new Date(), reportDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
$('report-to').value=reportDate(reportToday);$('report-from').value=reportDate(new Date(reportToday.getFullYear(),reportToday.getMonth(),1));
function reportParams(format){return new URLSearchParams({from:$('report-from').value,to:$('report-to').value,type:$('report-type').value,includeBreaks:String($('report-breaks').checked),format});}
async function runReport(format){
 if(!$('report-form').reportValidity())return;
 const buttons=$('report-form').querySelectorAll('button');buttons.forEach(b=>b.disabled=true);$('report-status').textContent='';
 try{
  if(format==='json'){
   const data=await api('/api/reports?'+reportParams(format));const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody');
   if(data.type==='total'&&!data.includeBreaks){const groups=document.createElement('tr');for(const [label,span,css] of [['',2,''],['Jornada regular',3,'regular-group'],['Horas Extras',3,'extra-group'],['Horas regulares + extras',1,'']]){const th=element('th',label,css);th.colSpan=span;groups.append(th);}head.append(groups);}
   const labels=document.createElement('tr');for(const label of data.headers){const th=element('th',label.replace('*',''));if(data.note && label.includes('Salida'))th.title=data.note;labels.append(th);}head.append(labels);table.append(head,body);
   data.table.forEach((cells,index)=>{const tr=document.createElement('tr');for(const cell of cells)tr.append(element('td',cell));if(data.rows[index].issues.length){tr.className='report-issue';tr.title=data.rows[index].issues.join('; ');}body.append(tr);});$('report-preview').replaceChildren(table);
   const notes=data.rows.filter(row=>row.issues.length);if(notes.length){const details=document.createElement('details');details.append(element('summary',`Observaciones (${notes.length})`));for(const row of notes)details.append(element('p',`${row.date} · ${row.code}: ${row.issues.join('; ')}`));$('report-preview').append(details);}
   $('report-status').textContent='';
  }else{
   const response=await fetch('/api/reports?'+reportParams(format),{credentials:'same-origin'});if(!response.ok){const data=await response.json();if(response.status===401)visible(false);throw new Error(data.error||'No se pudo generar el archivo');}
   const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=`Marcaje-${$('report-type').value==='regular'?'Regular':'Total'}-${$('report-from').value}-${$('report-to').value}.${format}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('report-status').textContent='';
  }
 }catch(error){$('report-status').textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}
}
$('report-form').addEventListener('submit',event=>{event.preventDefault();runReport('json');});$('report-xls').addEventListener('click',()=>runReport('xls'));$('report-pdf').addEventListener('click',()=>runReport('pdf'));
for(const id of ['report-from','report-to','report-type','report-breaks'])$(id).addEventListener('change',()=>{$('report-preview').replaceChildren();$('report-status').textContent='';});

$('demo-seed').addEventListener('click',async()=>{
 if(!await confirmAction('Cargar 15 colaboradores DEMO inactivos y 75 jornadas del 28 de septiembre al 2 de octubre de 2026. Incluye 25 horas extras. No modifica personal real ni duplica una carga anterior.'))return;
 $('demo-seed').disabled=true;
 try{const data=await write('/api/demo-data',{confirmation:'DEMO-15'});$('report-from').value=data.from;$('report-to').value=data.to;await loadWorkers();await loadPunches();await runReport('json');$('report-status').textContent='';}
 catch(error){$('report-status').textContent=error.message;}finally{$('demo-seed').disabled=false;}
});

document.addEventListener('click',event=>{if(!$('settings-nav').contains(event.target))$('settings-nav').open=false;});
$('settings-nav').addEventListener('keydown',event=>{if(event.key==='Escape'){$('settings-nav').open=false;$('settings-nav').querySelector('summary').focus();}});

function workerEditor(record){
 const form=element('form','','profile-schedule');
 for(const [key,title] of [['name','Nombre'],['code','Código']]){const label=element('label',title),input=document.createElement('input');input.name=key;input.value=record[key];input.required=true;input.maxLength=key==='code'?20:100;label.append(input);form.append(label);}
 const save=element('button','Guardar colaborador'),message=element('p','');message.setAttribute('role','status');form.append(save,message);
 form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{await write('/api/workers/'+record.id,Object.fromEntries(new FormData(form)),'PATCH');await loadWorkers();$('profile').close();}catch(error){message.textContent=error.message;}finally{save.disabled=false;}});return form;
}

function isoWeek(date){
 const day=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
 day.setUTCDate(day.getUTCDate()+4-(day.getUTCDay()||7));
 return Math.ceil((((day-new Date(Date.UTC(day.getUTCFullYear(),0,1)))/86400000)+1)/7);
}
function updateHeaderClock(){
 const now=new Date();$('header-clock').textContent=new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(now);$('header-clock').dateTime=now.toISOString();
 $('header-date').textContent=new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);$('header-date').dateTime=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 $('header-week').textContent='Semana '+String(isoWeek(now)).padStart(2,'0');
}
updateHeaderClock();setInterval(()=>{if(!document.hidden)updateHeaderClock();},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateHeaderClock();});

async function loadSequence(){
 const value=await api('/api/sequences');
 for(const key of ['meal','rest']){$(key+'-enabled').checked=value[key].enabled;$(key+'-from').value=value[key].from/60;$(key+'-to').value=value[key].to/60;}
 $('sequence-error').textContent='';
}
$('sequence-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const value={};for(const key of ['meal','rest'])value[key]={enabled:$(key+'-enabled').checked,from:Math.round(Number($(key+'-from').value)*60),to:Math.round(Number($(key+'-to').value)*60)};await write('/api/sequences',value,'PUT');$('sequence-error').textContent='';}
 catch(error){$('sequence-error').textContent=error.message;}finally{button.disabled=false;}
});
