/**
 * Pushes the full demo dataset into Neon.
 * Usage: DATABASE_URL=... bun scripts/seed-neon.ts
 */
import { buildSeed, businessToday } from "../src/lib/seed";
import { ensureSchema, getSql, TABLES, upsertMeta, upsertRows, type CollectionKey } from "../src/lib/db.server";

const sql = getSql();
await ensureSchema(sql);
const seed = buildSeed(businessToday());
for (const key of Object.keys(TABLES) as CollectionKey[]) {
  const rows = seed[key] as unknown as { id: string }[];
  await upsertRows(sql, key, rows);
  console.log(`${key}: ${rows.length}`);
}
await upsertMeta(sql, {
  today: seed.today,
  lastFetchedRoutes: null,
  channelToggles: {
    delivery_scheduled: { sms: true, email: true },
    delivery_completed: { sms: true, email: false },
    delivery_reminder: { sms: true, email: false },
    low_meal_balance: { sms: true, email: true },
    subscription_expiring: { sms: false, email: true },
  },
});
console.log("done");
