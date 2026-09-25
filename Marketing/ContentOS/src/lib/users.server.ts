// Server-only helpers for creating members and issuing temporary passwords.
import { sql } from "./db.server";
import { hashPassword, tempPassword } from "./password";

const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
export const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export class UserError extends Error {}

export async function emailTaken(email: string, exceptId?: string) {
  const rows = (await sql()`select id from app_users where lower(email) = ${email.toLowerCase()}`) as { id: string }[];
  return rows.some((r) => r.id !== exceptId);
}

export async function createMemberRow(o: { merchantId: string; name: string; email: string; fn: string; roles: string[]; workspaceIds: string[] | null }) {
  const email = o.email.trim().toLowerCase();
  if (await emailTaken(email)) throw new UserError("That email is already used by another account.");
  const id = newId("u");
  const password = tempPassword();
  const data = { id, name: o.name, initials: initials(o.name), role: o.roles[0], fn: o.fn, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  await sql()`insert into app_users (id, merchant_id, name, role, roles, workspace_ids, email, password_hash, must_change_password, data)
    values (${id}, ${o.merchantId}, ${o.name}, ${o.roles[0]}, ${o.roles}, ${o.workspaceIds}, ${email}, ${await hashPassword(password)}, true, ${JSON.stringify(data)}::jsonb)`;
  return { id, email, password };
}

/** New temporary password; the person must change it at next sign-in and is signed out everywhere. */
export async function issueTempPassword(userId: string) {
  const password = tempPassword();
  await sql()`update app_users set password_hash = ${await hashPassword(password)}, must_change_password = true where id = ${userId}`;
  await sql()`delete from sessions where user_id = ${userId}`;
  return password;
}
