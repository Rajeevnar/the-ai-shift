-- One-time setup for running Quotation Platform inside a Postgres database
-- that ALREADY belongs to a different, unrelated project (e.g. sharing one
-- free-tier Render Postgres instance rather than paying for a second one).
--
-- Everything below is scoped to a dedicated schema and a dedicated role, and
-- grants access to NOTHING outside that schema — the other project's own
-- tables, roles, and data are never read, altered, or granted to anything
-- created here. If you have a database entirely of your own, use
-- native-setup.sql instead; this file only exists for the shared case.
--
-- Run this ONCE, as the database's superuser/owner connection, BEFORE the
-- first `prisma migrate deploy`. Replace CHANGE_ME_DB_NAME and the role
-- password below with real values first.
--
-- How to run it:
--   psql "<superuser DATABASE_URL>" -f shared-db-setup.sql

-- Purely additive — creates a new, empty namespace. Does not touch any
-- existing schema (e.g. "public") or anything inside it.
CREATE SCHEMA IF NOT EXISTS quotation_platform;

-- A role name distinct from the other project's own app role is deliberate,
-- not cosmetic: reusing an existing role name (e.g. a generic "app_user"
-- that the other project may already have) would silently grant THAT
-- project's role access to Quotation Platform's tables too, the moment
-- db:secure runs its GRANTs. A fresh, uniquely-named role avoids that
-- entirely.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'qp_app_user') THEN
    CREATE ROLE qp_app_user LOGIN PASSWORD 'CHANGE_ME';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE CHANGE_ME_DB_NAME TO qp_app_user;
GRANT USAGE ON SCHEMA quotation_platform TO qp_app_user;
-- Deliberately no GRANT on the "public" schema (or any other existing
-- schema) to qp_app_user — it has no reason to see anything there, and
-- granting only USAGE on quotation_platform keeps it that way.

-- Table-level grants happen later, via:
--   APP_ROLE_NAME=qp_app_user APP_SCHEMA=quotation_platform npm run db:secure
-- (after `prisma migrate deploy` has created the tables inside
-- quotation_platform — see rls-policies.sql).
