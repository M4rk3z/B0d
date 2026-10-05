import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { createApplication, migrate, workerFields } from '../app.mjs';

test('Fundación web con PostgreSQL embebido', async t => {
  const db = new PGlite();
  const pool = {
    query: async (sql, args) => sql.includes('CREATE TABLE') ? (await db.exec(sql)).at(-1) : db.query(sql, args),
    connect: async () => ({ query: pool.query, release() {} })
  };
  await migrate(pool); await migrate(pool);
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
