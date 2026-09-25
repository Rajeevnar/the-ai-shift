-- ContentOS schema (Neon / Postgres). Each record keeps its full shape in `data`.
-- Every statement is idempotent: run `node db/migrate.mjs` as often as you like.
CREATE TABLE IF NOT EXISTS merchants    (id text PRIMARY KEY, name text NOT NULL, status text NOT NULL DEFAULT 'active', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS app_users    (id text PRIMARY KEY, name text NOT NULL, role text NOT NULL, data jsonb NOT NULL, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS workspaces   (id text PRIMARY KEY, name text NOT NULL, data jsonb NOT NULL, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS pieces       (id text PRIMARY KEY, workspace_id text NOT NULL, title text, status text, publish_date text, data jsonb NOT NULL, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS client_cases (id text PRIMARY KEY, client text, data jsonb NOT NULL, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS videos       (id text PRIMARY KEY, workspace_id text NOT NULL, title text, status text, publish_date text, data jsonb NOT NULL, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS activity     (id text PRIMARY KEY, workspace_id text, data jsonb NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions     (token_hash text PRIMARY KEY, user_id text NOT NULL, acting_merchant_id text, created_at timestamptz DEFAULT now(), expires_at timestamptz NOT NULL);

-- Logins, multiple roles and workspace access. workspace_ids NULL = every workspace of the merchant.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS merchant_id text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS workspace_ids text[];
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_idx ON app_users (lower(email));
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Tenant isolation: every content row belongs to one merchant.
ALTER TABLE workspaces   ADD COLUMN IF NOT EXISTS merchant_id text;
ALTER TABLE pieces       ADD COLUMN IF NOT EXISTS merchant_id text;
ALTER TABLE client_cases ADD COLUMN IF NOT EXISTS merchant_id text;
ALTER TABLE videos       ADD COLUMN IF NOT EXISTS merchant_id text;
ALTER TABLE activity     ADD COLUMN IF NOT EXISTS merchant_id text;
CREATE INDEX IF NOT EXISTS workspaces_merchant_idx   ON workspaces (merchant_id);
CREATE INDEX IF NOT EXISTS pieces_merchant_idx       ON pieces (merchant_id);
CREATE INDEX IF NOT EXISTS client_cases_merchant_idx ON client_cases (merchant_id);
CREATE INDEX IF NOT EXISTS videos_merchant_idx       ON videos (merchant_id);
CREATE INDEX IF NOT EXISTS activity_merchant_idx     ON activity (merchant_id, created_at);

-- Existing single-tenant data becomes the first merchant.
INSERT INTO merchants (id, name) VALUES ('m1', 'RVS Media') ON CONFLICT (id) DO NOTHING;
UPDATE app_users    SET merchant_id = 'm1' WHERE merchant_id IS NULL AND is_owner = false;
UPDATE workspaces   SET merchant_id = 'm1' WHERE merchant_id IS NULL;
UPDATE pieces       SET merchant_id = 'm1' WHERE merchant_id IS NULL;
UPDATE client_cases SET merchant_id = 'm1' WHERE merchant_id IS NULL;
UPDATE videos       SET merchant_id = 'm1' WHERE merchant_id IS NULL;
UPDATE activity     SET merchant_id = 'm1' WHERE merchant_id IS NULL;
UPDATE app_users    SET roles = ARRAY[role] WHERE cardinality(roles) = 0 AND is_owner = false;
UPDATE app_users    SET roles = ARRAY['Admin', 'Approver'] WHERE id = 'u1' AND roles = ARRAY['Admin'];
UPDATE app_users    SET roles = ARRAY['Marketing Lead', 'Approver'] WHERE id = 'u2' AND roles = ARRAY['Marketing Lead'];
