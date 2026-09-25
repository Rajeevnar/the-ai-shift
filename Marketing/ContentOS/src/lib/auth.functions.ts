import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "./db.server";
import { createSession, destroySession, getSession, requireSession } from "./auth.server";
import { hashPassword, verifyPassword } from "./password";

export interface Me {
  id: string; name: string; email: string; roles: string[]; isOwner: boolean; mustChangePassword: boolean;
  merchant: { id: string; name: string; status: string } | null; actingAsOwner: boolean;
}

export const getMe = createServerFn({ method: "GET" }).handler(async (): Promise<Me | null> => {
  const s = await getSession();
  if (!s) return null;
  return {
    id: s.user.id, name: s.user.name, email: s.user.email, roles: s.user.roles, isOwner: s.user.isOwner,
    mustChangePassword: s.user.mustChangePassword, actingAsOwner: s.actingAsOwner,
    merchant: s.merchantId ? { id: s.merchantId, name: s.merchantName ?? "", status: s.merchantStatus ?? "active" } : null,
  };
});

let dummyHash: string | undefined;
type LoginRow ={ id: string; password_hash: string | null; status: string; is_owner: boolean; must_change_password: boolean; m_status: string | null };

export const login = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const rows = (await sql()`
      select u.id, u.password_hash, u.status, u.is_owner, u.must_change_password, m.status as m_status
      from app_users u left join merchants m on m.id = u.merchant_id
      where lower(u.email) = ${data.email.toLowerCase()}`) as LoginRow[];
    const u = rows[0];
    // Same message (and same hashing work) for unknown email and wrong password, so emails can't be probed.
    dummyHash ??= await hashPassword("not-a-real-password");
    const valid = await verifyPassword(data.password, u?.password_hash ?? dummyHash);
    if (!u || !u.password_hash || !valid) return { ok: false as const, error: "Email or password is incorrect." };
    if (u.status !== "active") return { ok: false as const, error: "Your account has been disabled. Ask your admin to re-enable it." };
    if (!u.is_owner && u.m_status !== "active") return { ok: false as const, error: "Your organisation's account is paused. Please contact the platform administrator." };
    await sql()`update app_users set last_login_at = now(), login_count = login_count + 1 where id = ${u.id}`;
    await createSession(u.id);
    return { ok: true as const, mustChangePassword: u.must_change_password, isOwner: u.is_owner };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ current: z.string().min(1).max(200), next: z.string().min(8, "Use at least 8 characters.").max(200) }))
  .handler(async ({ data }) => {
    // Allowed while must_change_password is set, so requireSession() isn't used here.
    const s = await getSession();
    if (!s) return { ok: false as const, error: "Please sign in again." };
    const [row] = (await sql()`select password_hash from app_users where id = ${s.user.id}`) as { password_hash: string | null }[];
    if (!(await verifyPassword(data.current, row?.password_hash ?? null))) return { ok: false as const, error: "Current password is incorrect." };
    if (data.current === data.next) return { ok: false as const, error: "Choose a password different from the current one." };
    await sql()`update app_users set password_hash = ${await hashPassword(data.next)}, must_change_password = false where id = ${s.user.id}`;
    // Sign out every other device.
    await sql()`delete from sessions where user_id = ${s.user.id} and token_hash <> ${s.tokenHash}`;
    return { ok: true as const };
  });

/** Owner only: work inside a merchant as its Admin, or go back to the console (merchantId null). */
export const openMerchant = createServerFn({ method: "POST" })
  .inputValidator(z.object({ merchantId: z.string().nullable() }))
  .handler(async ({ data }) => {
    const s = await requireSession();
    if (!s.user.isOwner) return { ok: false as const, error: "Only the platform owner can do that." };
    await sql()`update sessions set acting_merchant_id = ${data.merchantId} where token_hash = ${s.tokenHash}`;
    return { ok: true as const };
  });
