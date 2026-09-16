/**
 * Applies Row-Level Security policies and grants to the restricted app role.
 * Must be run with the superuser (DATABASE_URL) connection, since only the table
 * owner can enable/force RLS and manage policies.
 *
 * Usage: npm run db:secure   (from apps/api)
 *
 * Role name and schema are configurable via APP_ROLE_NAME / APP_SCHEMA so the
 * same rls-policies.sql works both for a dedicated local/dev database (role
 * `app_user` in the default `public` schema — the default when these aren't
 * set) and for deployments that share one Postgres instance with a
 * completely different project, where a distinct role name and a dedicated
 * non-public schema keep the two projects from ever touching each other's
 * roles, grants, or tables.
 */
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '../../.env') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
  }

  const roleName = process.env.APP_ROLE_NAME || 'app_user';
  const schema = process.env.APP_SCHEMA || 'public';

  const sqlPath = join(__dirname, '../rls-policies.sql');
  const rawSql = readFileSync(sqlPath, 'utf-8');
  const sql = rawSql.replace(/\bapp_user\b/g, roleName);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (schema !== 'public') {
      // Every unqualified table name in rls-policies.sql (e.g. "quotes", not
      // "public.quotes") resolves against whatever schema is first on the
      // search_path — this is what actually redirects the whole script at
      // the intended schema instead of touching `public`.
      await client.query(`SET search_path TO "${schema}"`);
    }
    console.log(`Applying RLS policies and ${roleName} grants (schema: ${schema})...`);
    await client.query(sql);
    console.log('Done. Tenant isolation is now enforced at the database level.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed to apply RLS policies:', err);
  process.exit(1);
});
