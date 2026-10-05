import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createApplication, migrate, bootstrapAdmin, workerFields } from '../app.mjs';

test('Fundación web con PostgreSQL embebido', async t => {
  const db = new PGlite();
  const pool = {
    query: async (sql, args) => sql.includes('CREATE TABLE') ? (await db.exec(sql)).at(-1) : db.query(sql, args),
    connect: async () => ({ query: pool.query, release() {} })
  };
  await db.exec(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  await db.query("INSERT INTO b0d_sessions VALUES($1,now()+interval '30 minutes')", ['a'.repeat(64)]);
  await migrate(pool); await migrate(pool);
  assert.equal((await db.query('SELECT count(*) AS total FROM b0d_sessions')).rows[0].total, 0);
  await bootstrapAdmin(pool, 'test-admin', 'test-password-only-123');
  await bootstrapAdmin(pool, 'another-admin', 'test-password-only-456');
  const origin = 'http://127.0.0.1:3000';
  const server = createApplication(pool, { origin, adminUser: 'test-admin', adminPassword: 'test-password-only-123' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = (path, method = 'GET', data, override = {}) => fetch(base + path, {
    method, headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', ...override },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  });
  try {
    await t.test('migración repetible y salud', async () => assert.equal((await request('/healthz')).status, 200));
    await t.test('sin sesión no expone personal', async () => assert.equal((await request('/api/workers')).status, 401));
    await t.test('rechaza origen externo', async () => assert.equal((await request('/api/login', 'POST', {}, { Origin: 'https://other.example' })).status, 403));
    await t.test('rechaza contraseña incorrecta', async () => assert.equal((await request('/api/login', 'POST', { user: 'test-admin', password: 'incorrect' })).status, 401));
    await t.test('cookie protegida sin contraseña en respuesta', async () => {
      const res = await request('/api/login', 'POST', { user: 'test-admin', password: 'test-password-only-123' });
      assert.equal(res.status, 200); assert.match(res.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
      cookie = res.headers.get('set-cookie').split(';')[0]; assert.deepEqual(await res.json(), { ok: true });
    });
    await t.test('alta validada y persistente', async () => {
      const res = await request('/api/workers', 'POST', { code: ' emp-1 ', name: '  María   Pérez ' });
      assert.equal(res.status, 201); assert.equal((await res.json()).name, 'María Pérez');
      const rows = await (await request('/api/workers')).json(); assert.equal(rows.length, 1); assert.equal(rows[0].code, 'EMP-1');
      assert.equal((await db.query('SELECT count(*) FROM b0d_audit')).rows[0].count, 1);
    });
    await t.test('duplicado sin duplicar auditoría', async () => {
      assert.equal((await request('/api/workers', 'POST', { code: 'emp-1', name: 'Other' })).status, 409);
      assert.equal((await db.query('SELECT count(*) FROM b0d_audit')).rows[0].count, 1);
    });
    await t.test('rechaza campos y código SQL', async () => {
      assert.throws(() => workerFields({ code: "a';DROP", name: 'Name' }));
      assert.equal((await request('/api/workers', 'POST', { code: 'OK', name: '' })).status, 400);
    });
    await t.test('usuarios, permisos, revocación y protección del último Admin', async () => {
      const adminCookie = cookie;
      const me = await (await request('/api/me')).json(); assert.equal(me.role, 'Admin');
      assert.equal((await (await request('/api/users')).json()).length, 1);
      assert.equal((await request('/api/users', 'POST', { username: 'short', password: 'abc12', role: 'User' })).status, 400);
      const created = await request('/api/users', 'POST', { username: 'reader', password: 'abc123', role: 'User' });
      assert.equal(created.status, 201); const user = await created.json(); assert.ok(!('password_hash' in user));
      assert.equal((await request(`/api/users/${user.id}`, 'PATCH', { password: 'abc12' })).status, 400);
      assert.equal((await request('/api/users', 'POST', { username: 'READER', password: 'abc123', role: 'User' })).status, 409);
      assert.equal((await request(`/api/users/${me.id}`, 'PATCH', { role: 'User', active: true })).status, 409);
      assert.equal((await request(`/api/users/${me.id}`, 'PATCH', { role: 'Admin', active: false })).status, 409);
      const login = await request('/api/login', 'POST', { user: 'reader', password: 'abc123' });
      assert.equal(login.status, 200); cookie = login.headers.get('set-cookie').split(';')[0]; const userCookie = cookie;
      assert.equal((await request('/api/workers')).status, 200);
      assert.equal((await request('/api/users')).status, 403);
      assert.equal((await request('/api/workers', 'POST', { code: 'NO', name: 'No' })).status, 403);
      assert.equal((await request('/api/users', 'POST', { username: 'escalation', password: 'abc123', role: 'Admin' })).status, 403);
      assert.equal((await request('/api/users', 'POST', { username: 'another-user', password: 'abc123', role: 'User' })).status, 201);
      assert.equal((await request(`/api/users/${user.id}`, 'PATCH', { role: 'Admin', active: true })).status, 403);
      cookie = adminCookie;
      assert.equal((await request(`/api/users/${user.id}`, 'PATCH', { role: 'User', active: false })).status, 200);
      cookie = userCookie; assert.equal((await request('/api/workers')).status, 401);
      assert.equal((await request('/api/login', 'POST', { user: 'reader', password: 'abc123' })).status, 401);
      cookie = adminCookie;
      assert.equal((await request(`/api/users/${user.id}`, 'PATCH', { role: 'User', active: true, password: 'new-password-only-123' })).status, 200);
      assert.equal((await request('/api/login', 'POST', { user: 'reader', password: 'abc123' })).status, 401);
      assert.equal((await request('/api/login', 'POST', { user: 'reader', password: 'new-password-only-123' })).status, 200);
      assert.equal((await request(`/api/users/${user.id}`, 'PATCH', { password: 'xyz789' })).status, 200);
      const preserved = (await db.query('SELECT role,active FROM b0d_users WHERE id=$1',[user.id])).rows[0];
      assert.equal(preserved.role,'User'); assert.equal(preserved.active,true);
      assert.equal((await request('/api/login','POST',{user:'reader',password:'xyz789'})).status,200);
      await migrate(pool); await bootstrapAdmin(pool, 'replacement', 'replacement-password-123');
      assert.equal((await request('/api/me')).status, 200);
      assert.equal((await db.query("SELECT count(*) AS total FROM b0d_users WHERE role='Admin'")).rows[0].total, 1);
    });
    await t.test('logout revoca sesión', async () => {
      assert.equal((await request('/api/logout', 'POST', {})).status, 200);
      assert.equal((await request('/api/workers')).status, 401);
    });
    await t.test('bloqueo después de cinco fallos', async () => {
      for (let i=0;i<5;i++) assert.equal((await request('/api/login', 'POST', { user: 'test-admin', password: 'bad' })).status, 401);
      assert.equal((await request('/api/login', 'POST', { user: 'test-admin', password: 'test-password-only-123' })).status, 429);
    });
    await t.test('interfaz sin scripts inline ni datos personales públicos', async () => {
      const response = await request('/'); assert.equal(response.status, 200);
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      const html = await response.text(); assert.ok(!html.includes('María')); assert.ok(!html.includes('onclick='));
    });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close(); }
});
