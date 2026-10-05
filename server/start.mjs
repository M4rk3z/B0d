import pg from 'pg';
import { createApplication, migrate, bootstrapAdmin } from './app.mjs';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL requerida');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
pool.on('error', () => console.error('Database connection unavailable'));
const app = createApplication(pool, {
  origin: process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL,
  adminUser: process.env.ADMIN_USER, adminPassword: process.env.ADMIN_PASSWORD
});
await migrate(pool);
await bootstrapAdmin(pool, process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('B0d cloud foundation ready'));
process.on('SIGTERM', () => app.close(() => pool.end().finally(() => process.exit(0))));
