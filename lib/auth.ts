/**
 * Optional dashboard login. Enabled only when DASHBOARD_PASSWORD is set (server env); otherwise
 * the panel stays open, as before. The session is a signed cookie "<expiresAtMs>.<hmac>" — no
 * server-side store. Uses Web Crypto so it runs in the proxy and in route handlers alike.
 * Server-only: never import from a client component.
 */
export const SESSION_COOKIE = "painel-session";
export const SESSION_TTL_MS = 7 * 86_400_000;

export function authEnabled(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

const encoder = new TextEncoder();

/** SESSION_SECRET if set; otherwise derived from the password (changing it logs everyone out). */
function secret(): string {
  return process.env.SESSION_SECRET || `painel:${process.env.DASHBOARD_PASSWORD ?? ""}`;
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two hex/ASCII strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const expiresAt = now + SESSION_TTL_MS;
  return `${expiresAt}.${await hmac(`v1.${expiresAt}`)}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  const expiresAt = Number(expires);
  if (!sig || !Number.isFinite(expiresAt) || expiresAt <= now) return false;
  return safeEqual(sig, await hmac(`v1.${expiresAt}`));
}

/** Compares HMACs of both values, so timing doesn't leak the password length or content. */
export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return false;
  return safeEqual(await hmac(`pw.${input}`), await hmac(`pw.${expected}`));
}

/** True when auth is off, or the request carries a valid session. */
export async function isAuthorized(cookieValue: string | undefined): Promise<boolean> {
  return !authEnabled() || verifySessionToken(cookieValue);
}
