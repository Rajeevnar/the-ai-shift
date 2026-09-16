-- Run this ONCE against your Postgres install, as the postgres superuser,
-- after you've created the `quotation_builder` database.
--
-- How to run it (pick one):
--   A) pgAdmin: open a Query Tool on the `quotation_builder` database, paste
--      this file's contents, click Execute.
--   B) psql: psql -U postgres -d quotation_builder -f native-setup.sql

-- Restricted role used by the running application at runtime.
-- This role is NOT a superuser, so Postgres Row-Level Security policies
-- actually apply to it (superusers always bypass RLS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'CHANGE_ME';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE quotation_builder TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Table-level grants happen later, via `npm run db:secure`, after Prisma
-- migrations have created the tables (see prisma/rls-policies.sql).
