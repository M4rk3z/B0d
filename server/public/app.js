const $ = id => document.getElementById(id);
let current;
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
  $('login').hidden = logged; $('workspace').hidden = !logged; $('logout').hidden = !logged;
  if (!logged) { current = null; $('workers').replaceChildren(); $('users').replaceChildren(); $('identity').textContent = ''; $('account').reset(); }
}
function element(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
async function load() {
  current = await api('/api/me'); visible(true);
  const admin = current.role === 'Admin';
  $('identity').textContent = `${current.username} · ${current.role}`;
  $('worker').hidden = !admin; $('user-list').hidden = !admin;
  $('role').replaceChildren(...(admin ? ['User', 'Admin'] : ['User']).map(role => { const option = element('option', role); option.value = role; return option; }));
  await loadWorkers(); if (admin) await loadUsers();
}
async function loadWorkers() {
  const workers = await api('/api/workers'); $('workers').replaceChildren();
  if (!workers.length) $('workers').append(element('p', 'Sin colaboradores registrados'));
  for (const worker of workers) {
    const card = element('article', '', 'card');
    card.append(element('h3', worker.name), element('p', worker.code, 'muted'), element('span', worker.active ? 'Activo' : 'Inactivo', 'pill')); $('workers').append(card);
  }
}
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
  try {
    const rows = await api('/api/workers');
    const cell = value => { let text = String(value); if (/^[\s]*[=+@-]/u.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
    const csv = '\ufeff' + [['Código', 'Nombre', 'Estado'], ...rows.map(row => [row.code, row.name, row.active ? 'Activo' : 'Inactivo'])].map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'B0d-colaboradores.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { $('status').textContent = error.message; }
});
load().catch(error => { visible(false); if (error.message !== 'Inicia sesión' && error.message !== 'La sesión terminó') $('status').textContent = error.message; });
