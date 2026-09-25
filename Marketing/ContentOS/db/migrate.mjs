// Usage: DATABASE_URL=... node db/migrate.mjs
// Applies db/schema.sql (idempotent). With OWNER_EMAIL set and no user on that
// email yet, also creates the platform owner and prints a temporary password
// (or uses OWNER_PASSWORD). The owner must change it on first sign-in.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const q = neon(process.env.DATABASE_URL);
const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) await q.query(stmt);
console.log("schema up to date");

// Same format as src/lib/password.ts.
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  const b64 = (b) => Buffer.from(b).toString("base64");
  return `pbkdf2$100000$${b64(salt)}$${b64(bits)}`;
}
function tempPassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const s = Array.from(crypto.getRandomValues(new Uint8Array(12)), (n) => chars[n % chars.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
if (email) {
  const existing = await q`select id from app_users where lower(email) = ${email}`;
  if (existing.length) console.log(`owner ${email} already exists — left unchanged`);
  else {
    const password = process.env.OWNER_PASSWORD || tempPassword();
    const name = process.env.OWNER_NAME || "Platform Owner";
    const data = { id: "owner1", name, initials: name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(), role: "Admin", fn: "Platform owner", color: "var(--c3)" };
    await q`insert into app_users (id, name, role, data, email, password_hash, is_owner, roles, must_change_password)
      values ('owner1', ${name}, 'Owner', ${JSON.stringify(data)}::jsonb, ${email}, ${await hashPassword(password)}, true, '{}', true)`;
    console.log(`owner created: ${email}  temporary password: ${password}`);
  }
}
