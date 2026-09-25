import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "./db.server";
import { allWorkspaces, canWrite, isAdmin, isManager, requireMember, type Session } from "./auth.server";

type Row = { data: any };
type UserRow = { id: string; name: string; role: string; roles: string[]; data: any };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
export const toClientUser = (r: UserRow) => {
  const roles = r.roles?.length ? r.roles : [r.role];
  return { color: "var(--c3)", fn: "", ...r.data, id: r.id, name: r.name, initials: r.data?.initials || initials(r.name), roles, role: roles[0] };
};

/** Workspace ids this session may read and write. */
async function accessibleWorkspaces(s: Session & { merchantId: string }) {
  const rows = (await sql()`select id from workspaces where merchant_id = ${s.merchantId}`) as { id: string }[];
  const ids = rows.map((r) => r.id);
  return allWorkspaces(s.user) ? ids : ids.filter((id) => s.user.workspaceIds!.includes(id));
}

export const loadAll = createServerFn({ method: "GET" }).handler(async () => {
  const s = await requireMember();
  const q = sql();
  const mid = s.merchantId;
  const ws = await accessibleWorkspaces(s);
  const [users, workspaces, pieces, cases, videos, activity] = await Promise.all([
    q`select id, name, role, roles, data from app_users where merchant_id = ${mid} order by created_at, id`,
    q`select data from workspaces where merchant_id = ${mid} and id = any(${ws}) order by id`,
    q`select data from pieces where merchant_id = ${mid} and workspace_id = any(${ws}) order by id`,
    q`select data from client_cases where merchant_id = ${mid} and (data->'workspaceIds') ?| ${ws}::text[] order by id`,
    q`select data from videos where merchant_id = ${mid} and workspace_id = any(${ws}) order by id`,
    q`select data from activity where merchant_id = ${mid} and workspace_id = any(${ws}) order by created_at desc limit 100`,
  ]);
  const d = (r: unknown) => (r as Row[]).map((x) => x.data);
  const list = (users as UserRow[]).map(toClientUser);
  // An owner who opened this merchant isn't one of its members; add them so their name resolves.
  if (!list.some((u) => u.id === s.user.id)) list.push(toClientUser({ id: s.user.id, name: s.user.name, role: "Admin", roles: ["Admin"], data: { ...s.user.data, fn: "Platform owner" } }));
  return { meId: s.user.id, users: list, workspaces: d(workspaces), pieces: d(pieces), cases: d(cases), videos: d(videos), activity: d(activity) };
});

const rec = z.object({ id: z.string().min(1).max(100) }).passthrough();
const recs = z.array(rec).max(5000).optional();
const ids = z.array(z.string().max(100)).max(5000).optional();
const Changes = z.object({
  upsert: z.object({ pieces: recs, videos: recs, workspaces: recs, cases: recs, activity: recs }).default({}),
  remove: z.object({ pieces: ids, videos: ids }).default({}),
});

/** Saves only what changed. Each row is checked against the caller's merchant, workspaces and roles. */
export const saveChanges = createServerFn({ method: "POST" })
  .inputValidator(Changes)
  .handler(async ({ data }) => {
    const s = await requireMember();
    const roles = s.user.roles;
    if (!canWrite(roles)) throw new Error("Your role is view-only.");
    const q = sql();
    const mid = s.merchantId;
    const ws = await accessibleWorkspaces(s);
    const inWs = (id: unknown) => typeof id === "string" && ws.includes(id);
    const { upsert: u, remove: rm } = data;
    const stmts: any[] = [];

    // Refuse, before writing anything, ids that already belong to another merchant or to a workspace
    // this person can't access. (The ON CONFLICT guards below would skip them silently anyway.)
    const idsOf = (rows?: { id: string }[]) => (rows ?? []).map((r) => r.id);
    const foreign = await Promise.all([
      q`select id from pieces where id = any(${idsOf(u.pieces)}) and not (merchant_id = ${mid} and workspace_id = any(${ws}))`,
      q`select id from videos where id = any(${idsOf(u.videos)}) and not (merchant_id = ${mid} and workspace_id = any(${ws}))`,
      q`select id from workspaces where id = any(${idsOf(u.workspaces)}) and merchant_id is distinct from ${mid}`,
      q`select id from client_cases where id = any(${idsOf(u.cases)}) and merchant_id is distinct from ${mid}`,
    ]);
    if (foreign.some((r) => r.length)) throw new Error("You don't have access to one of those items.");

    for (const r of u.pieces ?? []) {
      if (!inWs(r["workspaceId"])) throw new Error("You don't have access to that workspace.");
      const j = JSON.stringify(r);
      stmts.push(q`insert into pieces (id, merchant_id, workspace_id, title, status, publish_date, data) values (${r.id}, ${mid}, ${r["workspaceId"]}, ${r["title"]}, ${r["status"]}, ${r["publishDate"]}, ${j}::jsonb)
        on conflict (id) do update set workspace_id=excluded.workspace_id, title=excluded.title, status=excluded.status, publish_date=excluded.publish_date, data=excluded.data, updated_at=now()
        where pieces.merchant_id = ${mid} and pieces.workspace_id = any(${ws})`);
    }
    for (const r of u.videos ?? []) {
      if (!inWs(r["workspaceId"])) throw new Error("You don't have access to that workspace.");
      const j = JSON.stringify(r);
      stmts.push(q`insert into videos (id, merchant_id, workspace_id, title, status, publish_date, data) values (${r.id}, ${mid}, ${r["workspaceId"]}, ${r["title"]}, ${r["status"]}, ${r["publishDate"]}, ${j}::jsonb)
        on conflict (id) do update set workspace_id=excluded.workspace_id, title=excluded.title, status=excluded.status, publish_date=excluded.publish_date, data=excluded.data, updated_at=now()
        where videos.merchant_id = ${mid} and videos.workspace_id = any(${ws})`);
    }
    if (u.workspaces?.length) {
      if (!isAdmin(roles)) throw new Error("Only an Admin can create or edit workspaces.");
      for (const r of u.workspaces) {
        const { favourite: _f, ...rest } = r as Record<string, unknown>; // favourites are per person, kept in the browser
        stmts.push(q`insert into workspaces (id, merchant_id, name, data) values (${r.id}, ${mid}, ${r["name"]}, ${JSON.stringify(rest)}::jsonb)
          on conflict (id) do update set name=excluded.name, data=excluded.data, updated_at=now() where workspaces.merchant_id = ${mid}`);
      }
    }
    if (u.cases?.length) {
      if (!isManager(roles)) throw new Error("Only an Admin or Marketing Lead can manage the Case Book.");
      for (const r of u.cases) {
        const linked = Array.isArray(r["workspaceIds"]) ? (r["workspaceIds"] as unknown[]).filter(inWs) : [];
        const j = JSON.stringify({ ...r, workspaceIds: linked });
        stmts.push(q`insert into client_cases (id, merchant_id, client, data) values (${r.id}, ${mid}, ${r["client"]}, ${j}::jsonb)
          on conflict (id) do update set client=excluded.client, data=excluded.data, updated_at=now() where client_cases.merchant_id = ${mid}`);
      }
    }
    for (const r of u.activity ?? []) {
      if (!inWs(r["workspaceId"])) continue;
      const j = JSON.stringify({ ...r, actor: s.user.id });
      stmts.push(q`insert into activity (id, merchant_id, workspace_id, data, created_at) values (${r.id}, ${mid}, ${r["workspaceId"]}, ${j}::jsonb, ${r["at"] ?? new Date().toISOString()}) on conflict (id) do nothing`);
    }
    if (rm.pieces?.length) {
      if (!isManager(roles)) throw new Error("Only an Admin or Marketing Lead can delete pieces.");
      stmts.push(q`delete from pieces where id = any(${rm.pieces}) and merchant_id = ${mid} and workspace_id = any(${ws})`);
    }
    if (rm.videos?.length) stmts.push(q`delete from videos where id = any(${rm.videos}) and merchant_id = ${mid} and workspace_id = any(${ws})`);

    if (stmts.length) await q.transaction(stmts);
    return { ok: true };
  });
