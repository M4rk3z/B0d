const $ = id => document.getElementById(id);
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) visible(false);
    throw new Error(data.error || 'No se pudo completar la operación');
  }
  return data;
}
const post = (path, data) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
function visible(logged) { $('login').hidden = logged; $('workspace').hidden = !logged; $('logout').hidden = !logged; if (!logged) $('workers').replaceChildren(); }
async function loadWorkers() {
  const workers = await api('/api/workers'); visible(true); $('workers').replaceChildren();
  if (!workers.length) { const empty = document.createElement('p'); empty.textContent = 'Sin colaboradores registrados'; $('workers').append(empty); }
  for (const worker of workers) {
    const card = document.createElement('article'); card.className = 'card';
    const name = document.createElement('h3'); name.textContent = worker.name;
    const code = document.createElement('p'); code.className = 'muted'; code.textContent = worker.code;
    const state = document.createElement('span'); state.className = 'pill'; state.textContent = worker.active ? 'Activo' : 'Inactivo';
    card.append(name, code, state); $('workers').append(card);
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
submit('login', async data => { try { await post('/api/login', data); await loadWorkers(); } finally { $('login').elements.password.value = ''; } });
submit('worker', async data => { await post('/api/workers', data); $('worker').reset(); await loadWorkers(); });
$('logout').addEventListener('click', async () => { try { await post('/api/logout', {}); visible(false); } catch (error) { $('status').textContent = error.message; } });
loadWorkers().catch(() => visible(false));
