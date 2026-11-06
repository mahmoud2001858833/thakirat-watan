import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, '..', 'migrations');

export async function freshDb() {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(readFileSync(join(here, '_supabase_stub.sql'), 'utf8'));
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  return db;
}

/** ينفّذ fn كدور Supabase محدد (anon | authenticated) ومستخدم محدد */
export async function as(db, uid, fn) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  await db.exec(uid ? 'set role authenticated' : 'set role anon');
  try { return await fn(); } finally { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub','',false)`); }
}

export async function newUser(db, email) {
  const id = crypto.randomUUID();
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  return id;
}
