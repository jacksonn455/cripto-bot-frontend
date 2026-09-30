// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authEnabled, checkPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_MS, verifySessionToken } from "./auth";

beforeEach(() => vi.stubEnv("DASHBOARD_PASSWORD", "s3nha-forte"));
afterEach(() => vi.unstubAllEnvs());

describe("session tokens", () => {
  it("accepts a fresh token and rejects expired or tampered ones", async () => {
    const now = Date.parse("2026-09-29T12:00:00.000Z");
    const token = await createSessionToken(now);
    expect(await verifySessionToken(token, now + 1000)).toBe(true);
    expect(await verifySessionToken(token, now + SESSION_TTL_MS + 1)).toBe(false);

    const [exp, sig] = token.split(".");
    expect(await verifySessionToken(`${Number(exp) + 86_400_000}.${sig}`, now)).toBe(false); // extended expiry
    expect(await verifySessionToken(`${exp}.${sig.slice(0, -1)}0`, now)).toBe(false);
    expect(await verifySessionToken(undefined, now)).toBe(false);
    expect(await verifySessionToken("lixo", now)).toBe(false);
  });

  it("invalidates every session when the password changes", async () => {
    const token = await createSessionToken();
    vi.stubEnv("DASHBOARD_PASSWORD", "outra");
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("checks the password", async () => {
    expect(await checkPassword("s3nha-forte")).toBe(true);
    expect(await checkPassword("s3nha")).toBe(false);
    expect(await checkPassword("")).toBe(false);
  });

  it("is off without DASHBOARD_PASSWORD", () => {
    vi.stubEnv("DASHBOARD_PASSWORD", "");
    expect(authEnabled()).toBe(false);
  });
});

describe("login route", () => {
  // Fresh module per test: the attempt counters live in module memory.
  beforeEach(() => vi.resetModules());
  const post = async (password: string, ip = "10.0.0.1") => {
    const { POST } = await import("@/app/api/auth/login/route");
    return POST(new NextRequest("http://painel/api/auth/login", { method: "POST", body: JSON.stringify({ password }), headers: { "x-forwarded-for": ip } }));
  };

  it("sets an httpOnly session cookie for the right password", async () => {
    const res = await post("s3nha-forte");
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
    const token = decodeURIComponent(cookie.split(";")[0].split("=")[1]);
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("throttles repeated failures, and a spoofed X-Forwarded-For does not reset the limit", async () => {
    for (let i = 0; i < 5; i++) expect((await post("errada", `10.0.0.${i}`)).status).toBe(401);
    expect((await post("s3nha-forte", "10.9.9.9")).status).toBe(429);
  });

  it("limits per client only behind a trusted reverse proxy (TRUST_PROXY=true)", async () => {
    vi.stubEnv("TRUST_PROXY", "true");
    for (let i = 0; i < 5; i++) expect((await post("errada", "10.0.0.9")).status).toBe(401);
    expect((await post("s3nha-forte", "10.0.0.9")).status).toBe(429);
    expect((await post("s3nha-forte", "10.0.0.10")).status).toBe(200);
  });
});

describe("proxy.ts", () => {
  const run = async (path: string, cookie?: string) => {
    const { proxy } = await import("@/proxy");
    const req = new NextRequest(`http://painel${path}`, { headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} });
    return proxy(req);
  };

  it("redirects pages to /login (keeping where to go back) and answers 401 on the API", async () => {
    const page = await run("/trades?symbol=BTCUSDT");
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe("http://painel/login?next=%2Ftrades%3Fsymbol%3DBTCUSDT");
    const apiRes = await run("/api/backend/bot/status");
    expect(apiRes.status).toBe(401);
  });

  it("lets a valid session through", async () => {
    const res = await run("/api/backend/bot/status", await createSessionToken());
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("does nothing when login is off", async () => {
    vi.stubEnv("DASHBOARD_PASSWORD", "");
    expect((await run("/trades")).headers.get("x-middleware-next")).toBe("1");
  });
});

describe("backend proxy route with login on", () => {
  it("refuses commands without a session even if proxy.ts is bypassed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/backend/[...path]/route");
    const res = await POST(new NextRequest("http://painel/api/backend/bot/kill-switch", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ path: ["bot", "kill-switch"] }),
    });
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
