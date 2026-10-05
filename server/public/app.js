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
    } $('devices').append(card);
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
