// Server-only session handling. Every server function that touches data goes
// through requireSession()/requireMember() so permissions are enforced here,
// not just in the UI.
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { sql } from "./db.server";
import { randomToken, sha256 } from "./password";

export const COOKIE = "cos_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const MANAGER_ROLES = ["Admin", "Marketing Lead"];

export interface SessionUser {
  id: string; name: string; email: string; isOwner: boolean; roles: string[];
  workspaceIds: string[] | null; mustChangePassword: boolean; data: Record<string, unknown>;
}
export interface Session {
  tokenHash: string; user: SessionUser;
  /** Merchant whose data this session works on: the user's own, or the one an owner opened. */
  merchantId: string | null; merchantName: string | null; merchantStatus: string | null;
  actingAsOwner: boolean;
}

export class AuthError extends Error {}

export async function createSession(userId: string) {
  const token = randomToken();
  await sql()`insert into sessions (token_hash, user_id, expires_at) values (${await sha256(token)}, ${userId}, now() + make_interval(secs => ${MAX_AGE}))`;
  setCookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env['NODE_ENV'] === "production", path: "/", maxAge: MAX_AGE });
}

export async function destroySession() {
  const token = getCookie(COOKIE);
  if (token) await sql()`delete from sessions where token_hash = ${await sha256(token)}`;
  deleteCookie(COOKIE, { path: "/" });
}

type Row = {
  token_hash: string; acting_merchant_id: string | null; id: string; name: string; email: string; is_owner: boolean;
  roles: string[]; workspace_ids: string[] | null; must_change_password: boolean; status: string; merchant_id: string | null;
  data: Record<string, unknown>; m_name: string | null; m_status: string | null;
};

/** The signed-in session, or null. Disabled users and paused merchants get null. */
export async function getSession(): Promise<Session | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const rows = (await sql()`
    select s.token_hash, s.acting_merchant_id, u.id, u.name, u.email, u.is_owner, u.roles, u.workspace_ids,
           u.must_change_password, u.status, u.merchant_id, u.data, m.name as m_name, m.status as m_status
    from sessions s join app_users u on u.id = s.user_id
    left join merchants m on m.id = coalesce(s.acting_merchant_id, u.merchant_id)
    where s.token_hash = ${await sha256(token)} and s.expires_at > now()`) as Row[];
  const r = rows[0];
  if (!r || r.status !== "active") return null;
  if (!r.is_owner && r.m_status !== "active") return null;
  const acting = r.is_owner && !!r.acting_merchant_id && !!r.m_name;
  return {
    tokenHash: r.token_hash,
    user: {
      id: r.id, name: r.name, email: r.email, isOwner: r.is_owner, mustChangePassword: r.must_change_password, data: r.data,
      // An owner working inside a merchant acts as that merchant's Admin.
      roles: acting ? ["Admin"] : r.roles, workspaceIds: acting ? null : r.workspace_ids,
    },
    merchantId: r.is_owner ? (acting ? r.acting_merchant_id : null) : r.merchant_id,
    merchantName: r.m_name, merchantStatus: r.m_status, actingAsOwner: acting,
  };
}

export async function requireSession() {
  const s = await getSession();
  if (!s) throw new AuthError("Please sign in again.");
  if (s.user.mustChangePassword) throw new AuthError("Please set a new password first.");
  return s;
}

export async function requireOwner() {
  const s = await requireSession();
  if (!s.user.isOwner) throw new AuthError("Only the platform owner can do that.");
  return s;
}

/** A session working inside a merchant (a member, or an owner who opened one). */
export async function requireMember() {
  const s = await requireSession();
  if (!s.merchantId) throw new AuthError("Open a merchant first.");
  return s as Session & { merchantId: string };
}

export async function requireManager() {
  const s = await requireMember();
  if (!isManager(s.user.roles)) throw new AuthError("Only an Admin or Marketing Lead can manage the team.");
  return s;
}

export const isManager = (roles: string[]) => roles.some((r) => MANAGER_ROLES.includes(r));
export const isAdmin = (roles: string[]) => roles.includes("Admin");
/** Viewer-only accounts are read-only. */
export const canWrite = (roles: string[]) => roles.some((r) => r !== "Viewer");
/** Managers always see every workspace; everyone else sees their assigned list (null = all). */
export const allWorkspaces = (u: SessionUser) => isManager(u.roles) || u.workspaceIds === null;
