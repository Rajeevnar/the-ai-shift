import { neon } from "@neondatabase/serverless";

/** Collection key in app state -> table name in Neon. */
export const TABLES = {
  customers: "customers",
  plans: "plans",
  subscriptions: "subscriptions",
  orders: "orders",
  routes: "routes",
  ledger: "ledger_entries",
  pauses: "pauses",
  overrides: "overrides",
  notifications: "notifications",
  jobRuns: "job_runs",
  activity: "activity",
} as const;

export type CollectionKey = keyof typeof TABLES;

export const SCHEMA_SQL = [
  ...Object.values(TABLES).map(
    (t) => `CREATE TABLE IF NOT EXISTS ${t} (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  ),
  `CREATE TABLE IF NOT EXISTS app_meta (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
];

export function getSql(url = process.env["DATABASE_URL"]) {
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

type Sql = ReturnType<typeof getSql>;

export async function ensureSchema(sql: Sql) {
  for (const stmt of SCHEMA_SQL) await sql.query(stmt);
}

export async function upsertRows(sql: Sql, key: CollectionKey, rows: { id: string }[]) {
  const table = TABLES[key];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await sql.query(
      `INSERT INTO ${table} (id, data)
       SELECT e->>'id', e FROM jsonb_array_elements($1::jsonb) e
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [JSON.stringify(chunk)],
    );
  }
}

export async function upsertMeta(sql: Sql, meta: Record<string, unknown>) {
  for (const [k, v] of Object.entries(meta)) {
    await sql.query(
      `INSERT INTO app_meta (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [k, JSON.stringify(v ?? null)],
    );
  }
}

export async function loadAll(sql: Sql) {
  const out: Record<string, unknown[]> = {};
  for (const [key, table] of Object.entries(TABLES)) {
    const rows = (await sql.query(`SELECT data FROM ${table} ORDER BY id`)) as { data: unknown }[];
    out[key] = rows.map((r) => r.data);
  }
  const metaRows = (await sql.query(`SELECT key, value FROM app_meta`)) as { key: string; value: unknown }[];
  const meta = Object.fromEntries(metaRows.map((r) => [r.key, r.value]));
  return { collections: out, meta };
}
