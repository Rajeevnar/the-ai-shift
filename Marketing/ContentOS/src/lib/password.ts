// Password hashing with Web Crypto PBKDF2, so it runs on Node (Vercel) and on
// Workers-style runtimes alike. Format: pbkdf2$<iterations>$<salt b64>$<hash b64>.
// db/migrate.mjs keeps a copy of hashPassword — keep the two in step.
const ITERATIONS = 100_000;
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [kind, iter, salt, hash] = stored.split("$");
  if (kind !== "pbkdf2" || !iter || !salt || !hash) return false;
  const got = new Uint8Array(await derive(password, unb64(salt), Number(iter)));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i]! ^ want[i]!;
  return diff === 0;
}

/** Readable temporary password, e.g. "Kp7q-Rm4x-Zt9w" — no look-alike characters. */
export function tempPassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint8Array(12));
  const s = Array.from(r, (n) => chars[n % chars.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, "0")).join("");
}

export async function sha256(s: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))), (n) => n.toString(16).padStart(2, "0")).join("");
}
