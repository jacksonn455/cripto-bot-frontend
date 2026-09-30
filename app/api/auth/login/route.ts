import { NextRequest, NextResponse } from "next/server";
import { authEnabled, checkPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth";
import { BASE_PATH } from "@/lib/base-path";

export const dynamic = "force-dynamic";

/**
 * Brute-force brake: 5 failed attempts per minute. X-Forwarded-For is client-controlled, so it is
 * only used (per-IP limit) behind a trusted reverse proxy (TRUST_PROXY=true); otherwise the limit
 * is global — fine for a single-user panel. In memory, single instance.
 */
const WINDOW_MS = 60_000;
const MAX_FAILURES = 5;
/** Slows down each wrong guess a little more. */
const FAILURE_DELAY_MS = 400;
const failures = new Map<string, number[]>();

function clientKey(request: NextRequest): string {
  if (process.env.TRUST_PROXY !== "true") return "global";
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.json({ ok: true, authEnabled: false });
  }
  const key = clientKey(request);
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_FAILURES) {
    return NextResponse.json({ error: "TOO_MANY_ATTEMPTS", message: "Muitas tentativas. Espere um minuto." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (!(await checkPassword(password))) {
    failures.set(key, [...recent, now]);
    await new Promise((r) => setTimeout(r, FAILURE_DELAY_MS));
    return NextResponse.json({ error: "INVALID_PASSWORD", message: "Senha incorreta." }, { status: 401 });
  }

  failures.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(now), {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: BASE_PATH || "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return response;
}
