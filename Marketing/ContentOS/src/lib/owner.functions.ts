import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "./db.server";
import { requireOwner } from "./auth.server";
import { createMemberRow, issueTempPassword, newId } from "./users.server";

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export interface MerchantSummary {
  id: string; name: string; status: string; createdAt: string;
  users: number; withLogin: number; active7d: number; signIns: number; lastLoginAt: string | null;
  workspaces: number; pieces: number; videos: number; lastActivityAt: string | null;
}

export const listMerchants = createServerFn({ method: "GET" }).handler(async (): Promise<MerchantSummary[]> => {
  await requireOwner();
  const rows = (await sql()`
    select m.id, m.name, m.status, m.created_at as "createdAt",
      (select count(*) from app_users u where u.merchant_id = m.id)::int as users,
      (select count(*) from app_users u where u.merchant_id = m.id and u.email is not null)::int as "withLogin",
      (select count(*) from app_users u where u.merchant_id = m.id and u.last_login_at > now() - interval '7 days')::int as "active7d",
      (select coalesce(sum(u.login_count), 0) from app_users u where u.merchant_id = m.id)::int as "signIns",
      (select max(u.last_login_at) from app_users u where u.merchant_id = m.id) as "lastLoginAt",
      (select count(*) from workspaces w where w.merchant_id = m.id)::int as workspaces,
      (select count(*) from pieces p where p.merchant_id = m.id)::int as pieces,
      (select count(*) from videos v where v.merchant_id = m.id)::int as videos,
      (select max(a.created_at) from activity a where a.merchant_id = m.id) as "lastActivityAt"
    from merchants m order by m.created_at, m.id`) as MerchantSummary[];
  return rows.map((r) => ({ ...r, createdAt: iso(r.createdAt)!, lastLoginAt: iso(r.lastLoginAt), lastActivityAt: iso(r.lastActivityAt) }));
});

export interface MerchantUser { id: string; name: string; email: string | null; roles: string[]; status: string; lastLoginAt: string | null; loginCount: number; mustChangePassword: boolean }

export const listMerchantUsers = createServerFn({ method: "GET" })
  .inputValidator(z.object({ merchantId: z.string().max(100) }))
  .handler(async ({ data }): Promise<MerchantUser[]> => {
    await requireOwner();
    const rows = (await sql()`select id, name, email, case when cardinality(roles) > 0 then roles else array[role] end as roles, status,
      last_login_at as "lastLoginAt", login_count as "loginCount", must_change_password as "mustChangePassword"
      from app_users where merchant_id = ${data.merchantId} order by created_at, id`) as MerchantUser[];
    return rows.map((r) => ({ ...r, lastLoginAt: iso(r.lastLoginAt) }));
  });

/** New merchant with one starter workspace and its first Admin. Returns that Admin's temporary password. */
export const createMerchant = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string().trim().min(1, "Merchant name is required.").max(100),
    adminName: z.string().trim().min(1, "Admin name is required.").max(100),
    adminEmail: z.string().trim().email("Enter a valid email.").max(200),
  }))
  .handler(async ({ data }) => {
    await requireOwner();
    const id = newId("m");
    await sql()`insert into merchants (id, name) values (${id}, ${data.name})`;
    const wid = newId("w");
    const ws = { id: wid, name: data.name, short: data.name.slice(0, 2).toUpperCase(), color: "var(--lime)", tagline: "Main workspace", clusters: ["General"] };
    await sql()`insert into workspaces (id, merchant_id, name, data) values (${wid}, ${id}, ${data.name}, ${JSON.stringify(ws)}::jsonb)`;
    try {
      const admin = await createMemberRow({ merchantId: id, name: data.adminName, email: data.adminEmail, fn: "Admin", roles: ["Admin"], workspaceIds: null });
      return { merchantId: id, ...admin };
    } catch (e) {
      await sql()`delete from workspaces where merchant_id = ${id}`;
      await sql()`delete from merchants where id = ${id}`;
      throw e;
    }
  });

/** Pause stops every member of the merchant from signing in or using the app, straight away. */
export const setMerchantStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().max(100), status: z.enum(["active", "paused"]) }))
  .handler(async ({ data }) => {
    await requireOwner();
    await sql()`update merchants set status = ${data.status}, updated_at = now() where id = ${data.id}`;
    if (data.status === "paused") await sql()`delete from sessions where user_id in (select id from app_users where merchant_id = ${data.id})`;
    return { ok: true };
  });

export const ownerResetPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().max(100) }))
  .handler(async ({ data }) => {
    await requireOwner();
    const [u] = (await sql()`select email from app_users where id = ${data.userId} and is_owner = false`) as { email: string | null }[];
    if (!u) throw new Error("User not found.");
    if (!u.email) throw new Error("This member has no login email yet. Open the merchant and add one from the Team page.");
    return { email: u.email, password: await issueTempPassword(data.userId) };
  });
