// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadRoute(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  return import("./route");
}

function ctx(path: string) {
  return { params: Promise.resolve({ path: path.split("/") }) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("backend proxy", () => {
  it("forwards allowed GETs with the query string to API_URL", async () => {
    const { GET } = await loadRoute({ API_URL: "http://bot:9000/", API_KEY: "" });
    const res = await GET(new NextRequest("http://painel/api/backend/trades?mode=PAPER&page=2"), ctx("trades"));
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("http://bot:9000/trades?mode=PAPER&page=2");
  });

  it("adds the API key header server-side only when configured", async () => {
    const { POST } = await loadRoute({ API_URL: "http://bot:9000", API_KEY: "s3cret" });
    await POST(new NextRequest("http://painel/api/backend/bot/pause", { method: "POST", body: "{}" }), ctx("bot/pause"));
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("x-control-api-key")).toBe("s3cret");
  });

  it("does not send an API key header when none is configured", async () => {
    const { POST } = await loadRoute({ API_URL: "http://bot:9000", API_KEY: "" });
    await POST(new NextRequest("http://painel/api/backend/bot/resume", { method: "POST", body: "{}" }), ctx("bot/resume"));
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has("x-control-api-key")).toBe(false);
  });

  it("refuses paths outside the allowlist without calling the backend", async () => {
    const { GET, POST } = await loadRoute({ API_URL: "http://bot:9000" });
    expect((await GET(new NextRequest("http://painel/api/backend/docs"), ctx("docs"))).status).toBe(404);
    // Mutations must be POST.
    expect((await GET(new NextRequest("http://painel/api/backend/bot/kill-switch"), ctx("bot/kill-switch"))).status).toBe(404);
    expect((await POST(new NextRequest("http://painel/api/backend/trades", { method: "POST" }), ctx("trades"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies the AI endpoints (status + agent runs) but nothing else under /ai", async () => {
    const { GET, POST } = await loadRoute({ API_URL: "http://bot:9000", API_KEY: "s3cret" });
    expect((await GET(new NextRequest("http://painel/api/backend/ai/status"), ctx("ai/status"))).status).toBe(200);
    await POST(new NextRequest("http://painel/api/backend/ai/agents/risk-analyst/run", { method: "POST", body: "{}" }), ctx("ai/agents/risk-analyst/run"));
    expect(fetchMock.mock.calls[1][0]).toBe("http://bot:9000/ai/agents/risk-analyst/run");
    expect((fetchMock.mock.calls[1][1].headers as Headers).get("x-control-api-key")).toBe("s3cret");
    fetchMock.mockClear();
    expect((await GET(new NextRequest("http://painel/api/backend/ai/agents/risk-analyst/run"), ctx("ai/agents/risk-analyst/run"))).status).toBe(404);
    expect((await POST(new NextRequest("http://painel/api/backend/ai/other", { method: "POST" }), ctx("ai/other"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies the backtest research endpoints (window comparison and PBO) as GETs", async () => {
    const { GET } = await loadRoute({ API_URL: "http://bot:9000", API_KEY: "" });
    await GET(new NextRequest("http://painel/api/backend/backtest/compare?baseline=a&variant=b"), ctx("backtest/compare"));
    await GET(new NextRequest("http://painel/api/backend/backtest/pbo?runIds=a,b"), ctx("backtest/pbo"));
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "http://bot:9000/backtest/compare?baseline=a&variant=b",
      "http://bot:9000/backtest/pbo?runIds=a,b",
    ]);
  });

  it("answers 503 BACKEND_OFFLINE when the backend is unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const { GET } = await loadRoute({ API_URL: "http://bot:9000" });
    const res = await GET(new NextRequest("http://painel/api/backend/bot/status"), ctx("bot/status"));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "BACKEND_OFFLINE" });
  });

  it("passes backend error statuses through", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ statusCode: 404, message: "Trade x not found" }), { status: 404 }));
    const { GET } = await loadRoute({ API_URL: "http://bot:9000" });
    const res = await GET(new NextRequest("http://painel/api/backend/trades/abc"), ctx("trades/abc"));
    expect(res.status).toBe(404);
  });
});
