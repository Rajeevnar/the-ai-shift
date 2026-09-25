// Usage: run `node db/migrate.mjs` first, then DATABASE_URL=... bun db/seed.ts
// Loads the demo team, workspaces, content, cases and videos into merchant m1 ("RVS Media").
// Demo members have no login; give them one from the Team page.
import { neon } from "@neondatabase/serverless";
import { seed } from "../src/lib/store";
import { SEED } from "../src/components/contentos/VideoSchedule";
const q = neon(process.env.DATABASE_URL!);
const m = "m1";
await q`insert into merchants (id, name) values (${m}, 'RVS Media') on conflict (id) do nothing`;
const s = seed();
for (const u of s.users) await q`insert into app_users (id,merchant_id,name,role,roles,data) values (${u.id},${m},${u.name},${u.role},${u.roles},${JSON.stringify(u)}::jsonb) on conflict (id) do update set data=excluded.data`;
for (const w of s.workspaces) await q`insert into workspaces (id,merchant_id,name,data) values (${w.id},${m},${w.name},${JSON.stringify(w)}::jsonb) on conflict (id) do update set data=excluded.data`;
for (const p of s.pieces) await q`insert into pieces (id,merchant_id,workspace_id,title,status,publish_date,data) values (${p.id},${m},${p.workspaceId},${p.title},${p.status},${p.publishDate},${JSON.stringify(p)}::jsonb) on conflict (id) do update set data=excluded.data`;
for (const c of s.cases) await q`insert into client_cases (id,merchant_id,client,data) values (${c.id},${m},${c.client},${JSON.stringify(c)}::jsonb) on conflict (id) do update set data=excluded.data`;
for (const v of SEED) await q`insert into videos (id,merchant_id,workspace_id,title,status,publish_date,data) values (${v.id},${m},${v.workspaceId},${v.title},${v.status},${v.publishDate},${JSON.stringify(v)}::jsonb) on conflict (id) do update set data=excluded.data`;
console.log("seeded", s.users.length, "users", s.workspaces.length, "workspaces", s.pieces.length, "pieces", s.cases.length, "cases", SEED.length, "videos");
