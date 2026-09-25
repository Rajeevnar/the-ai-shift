import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "./db.server";
import { isAdmin, requireManager, requireMember } from "./auth.server";
import { createMemberRow, emailTaken, issueTempPassword } from "./users.server";
import { ROLES } from "./roles";

export interface Member {
  id: string; name: string; email: string | null; fn: string; roles: string[]; workspaceIds: string[] | null;
  status: string; mustChangePassword: boolean; lastLoginAt: string | null; loginCount: number;
}
type MemberRow = {
  id: string; name: string; email: string | null; role: string; roles: string[]; workspace_ids: string[] | null; status: string;
  must_change_password: boolean; last_login_at: string | null; login_count: number; data: { fn?: string };
};
const toMember = (r: MemberRow): Member => ({
  id: r.id, name: r.name, email: r.email, fn: r.data?.fn ?? "", roles: r.roles?.length ? r.roles : [r.role], workspaceIds: r.workspace_ids,
  status: r.status, mustChangePassword: r.must_change_password, lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null, loginCount: r.login_count,
});

const Roles = z.array(z.enum(ROLES)).min(1, "Pick at least one role.").max(ROLES.length);
const Access = z.array(z.string().max(100)).max(500).nullable();

/** Everyone can see the team; emails and sign-in details only go to managers. */
export const listTeam = createServerFn({ method: "GET" }).handler(async () => {
  const s = await requireMember();
  const rows = (await sql()`select id, name, email, role, roles, workspace_ids, status, must_change_password, last_login_at, login_count, data
    from app_users where merchant_id = ${s.merchantId} order by created_at, id`) as MemberRow[];
  const manager = s.user.roles.some((r) => r === "Admin" || r === "Marketing Lead");
  return rows.map(toMember).map((m) => (manager ? m : { ...m, email: null, lastLoginAt: null, loginCount: 0 }));
});

async function checkAccess(merchantId: string, workspaceIds: string[] | null) {
  if (!workspaceIds) return;
  const rows = (await sql()`select id from workspaces where merchant_id = ${merchantId}`) as { id: string }[];
  if (workspaceIds.some((id) => !rows.some((r) => r.id === id))) throw new Error("Unknown workspace.");
}

export const createMember = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string().trim().min(1, "Name is required.").max(100), email: z.string().trim().email("Enter a valid email.").max(200),
    fn: z.string().trim().max(100).default(""), roles: Roles, workspaceIds: Access,
  }))
  .handler(async ({ data }) => {
    const s = await requireManager();
    if (data.roles.includes("Admin") && !isAdmin(s.user.roles)) throw new Error("Only an Admin can give someone the Admin role.");
    await checkAccess(s.merchantId, data.workspaceIds);
    return createMemberRow({ merchantId: s.merchantId, ...data });
  });

export const updateMember = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().max(100), name: z.string().trim().min(1).max(100), email: z.string().trim().email("Enter a valid email.").max(200).nullable(),
    fn: z.string().trim().max(100), roles: Roles, workspaceIds: Access, status: z.enum(["active", "disabled"]),
  }))
  .handler(async ({ data }) => {
    const s = await requireManager();
    const [t] = (await sql()`select id, role, roles, email from app_users where id = ${data.id} and merchant_id = ${s.merchantId}`) as MemberRow[];
    if (!t) throw new Error("Member not found.");
    const theirRoles = t.roles?.length ? t.roles : [t.role];
    if (!isAdmin(s.user.roles) && (theirRoles.includes("Admin") || data.roles.includes("Admin"))) throw new Error("Only an Admin can change an Admin or give the Admin role.");
    const same = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
    if (t.id === s.user.id && (data.status !== "active" || !same(data.roles, theirRoles)))
      throw new Error("You can't change your own roles or disable yourself — ask another Admin.");
    const email = data.email?.toLowerCase() ?? t.email;
    if (!email && t.email) throw new Error("A member with a login must keep an email.");
    if (email && (await emailTaken(email, t.id))) throw new Error("That email is already used by another account.");
    await checkAccess(s.merchantId, data.workspaceIds);
    await sql()`update app_users set name = ${data.name}, email = ${email}, role = ${data.roles[0]}, roles = ${data.roles},
      workspace_ids = ${data.workspaceIds}, status = ${data.status},
      data = data || jsonb_build_object('name', ${data.name}::text, 'fn', ${data.fn}::text, 'role', ${data.roles[0]}::text), updated_at = now()
      where id = ${t.id} and merchant_id = ${s.merchantId}`;
    if (data.status === "disabled") await sql()`delete from sessions where user_id = ${t.id}`;
    return { ok: true };
  });

/** Gives a member (new) login credentials: returns a one-time temporary password to share with them. */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().max(100) }))
  .handler(async ({ data }) => {
    const s = await requireManager();
    const [t] = (await sql()`select id, role, roles, email from app_users where id = ${data.id} and merchant_id = ${s.merchantId}`) as MemberRow[];
    if (!t) throw new Error("Member not found.");
    if (!t.email) throw new Error("Add an email for this member first.");
    const theirRoles = t.roles?.length ? t.roles : [t.role];
    if (theirRoles.includes("Admin") && !isAdmin(s.user.roles)) throw new Error("Only an Admin can reset an Admin's password.");
    return { email: t.email, password: await issueTempPassword(t.id) };
  });
