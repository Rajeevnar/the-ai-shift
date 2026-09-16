-- Row-Level Security for tenant-scoped tables.
-- Run AFTER `prisma migrate dev` has created the tables (via `npm run db:secure`).
--
-- Tenant boundary = tenant_id. Every query executed as `app_user` automatically
-- has app.current_tenant_id set via `SET LOCAL` (see PrismaService), and Postgres
-- will silently exclude rows belonging to any other tenant — even if application
-- code has a bug and forgets a WHERE clause.

-- NOTE: Prisma's `String @id @default(uuid())` stores ids as plain `text`
-- columns (not Postgres's native `uuid` type — that only happens with an
-- explicit `@db.Uuid`). So we compare against current_setting() as text,
-- with no ::uuid cast, since both sides are text.

-- ---------- store_connectors ----------
ALTER TABLE store_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_connectors FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON store_connectors;
CREATE POLICY tenant_isolation ON store_connectors
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- ---------- connector_products ----------
-- No tenant_id column directly; scoped via its parent store_connector.
ALTER TABLE connector_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON connector_products;
CREATE POLICY tenant_isolation ON connector_products
  USING (
    store_connector_id IN (
      SELECT id FROM store_connectors
      WHERE tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- ---------- item_library_items ----------
ALTER TABLE item_library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_library_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON item_library_items;
CREATE POLICY tenant_isolation ON item_library_items
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- ---------- clients ----------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON clients;
CREATE POLICY tenant_isolation ON clients
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- ---------- quotes ----------
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON quotes;
CREATE POLICY tenant_isolation ON quotes
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- ---------- quote_sections ----------
-- No tenant_id column directly; scoped via its parent quote.
ALTER TABLE quote_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_sections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON quote_sections;
CREATE POLICY tenant_isolation ON quote_sections
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- ---------- quote_line_items ----------
-- No tenant_id column directly; scoped via section -> quote.
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON quote_line_items;
CREATE POLICY tenant_isolation ON quote_line_items
  USING (
    quote_section_id IN (
      SELECT qs.id FROM quote_sections qs
      JOIN quotes q ON q.id = qs.quote_id
      WHERE q.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- ---------- quote_activities ----------
-- No tenant_id column directly; scoped via its parent quote.
ALTER TABLE quote_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_activities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON quote_activities;
CREATE POLICY tenant_isolation ON quote_activities
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- ---------- quote_templates ----------
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON quote_templates;
CREATE POLICY tenant_isolation ON quote_templates
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- ---------- quote_template_sections ----------
-- No tenant_id column directly; scoped via its parent template.
ALTER TABLE quote_template_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_template_sections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON quote_template_sections;
CREATE POLICY tenant_isolation ON quote_template_sections
  USING (
    quote_template_id IN (
      SELECT id FROM quote_templates
      WHERE tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- ---------- quote_template_line_items ----------
-- No tenant_id column directly; scoped via section -> template.
ALTER TABLE quote_template_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_template_line_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON quote_template_line_items;
CREATE POLICY tenant_isolation ON quote_template_line_items
  USING (
    quote_template_section_id IN (
      SELECT qts.id FROM quote_template_sections qts
      JOIN quote_templates qt ON qt.id = qts.quote_template_id
      WHERE qt.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- ---------- email_connectors ----------
ALTER TABLE email_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_connectors FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON email_connectors;
CREATE POLICY tenant_isolation ON email_connectors
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- NOTE: `tenants` and `admin_users` are intentionally NOT tenant-scoped by
-- RLS — they're scoped by tenant_id at the application layer instead. Login
-- (looking up an AdminUser by email) happens BEFORE any tenant context is
-- established, so RLS on admin_users would block the lookup entirely.

-- ---------- grants for the restricted app_user role ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants, admin_users, store_connectors, connector_products,
  item_library_items, clients, quotes, quote_sections, quote_line_items,
  quote_activities, quote_templates, quote_template_sections,
  quote_template_line_items, email_connectors
  TO app_user;

-- Sequences/UUID defaults don't need sequence grants (we use uuid defaults),
-- but future serial columns would need: GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
