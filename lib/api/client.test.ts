import { afterEach, describe, expect, it, vi } from "vitest";
import { botStatusFixture } from "@/test/fixtures";
import { ApiError, buildUrl } from "./client";
import { api } from "./endpoints";

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("builds proxy URLs and drops empty params", () => {
    expect(buildUrl("trades", { mode: "PAPER", symbol: "", page: 2, strategy: undefined })).toBe(
      "/api/backend/trades?mode=PAPER&page=2",
    );
  });

  it("returns parsed data on success", async () => {
    mockFetch(200, botStatusFixture);
    await expect(api.bot.status()).resolves.toMatchObject({ mode: "PAPER", paused: true });
  });

  it("maps the proxy's BACKEND_OFFLINE to kind=offline", async () => {
    mockFetch(503, { statusCode: 503, error: "BACKEND_OFFLINE", message: "Não foi possível conectar ao backend." });
    await expect(api.bot.status()).rejects.toMatchObject({ kind: "offline", status: 503 });
  });

  it("maps Nest errors to kind=http with the joined message", async () => {
    mockFetch(400, { statusCode: 400, error: "Bad Request", message: ["limit must not be greater than 200", "page must be an integer"] });
    const err = await api.trades.list({ limit: 999 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ kind: "http", status: 400, message: "limit must not be greater than 200; page must be an integer" });
    expect((err as ApiError).isClientError).toBe(true);
  });

  it("flags schema mismatches as kind=validation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(200, { ...botStatusFixture, equity: "muito" });
    await expect(api.bot.status()).rejects.toMatchObject({ kind: "validation" });
  });

  it("maps a failed fetch to kind=network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(api.bot.status()).rejects.toMatchObject({ kind: "network" });
  });
});
