// @vitest-environment node
/**
 * Opt-in contract test against a running backend: validates real responses with the Zod schemas.
 * GET-only — never calls pause/resume/kill-switch/backtest run.
 *
 *   CONTRACT_API_URL=http://localhost:8000 pnpm test:contract
 */
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  backtestRunSchema,
  backtestRunsPageSchema,
  balancesSchema,
  botStatusSchema,
  byHourSchema,
  candlesSchema,
  compareModesSchema,
  equityCurveSchema,
  fundingPageSchema,
  groupedMetricPageSchema,
  healthSchema,
  metricsSummarySchema,
  signalsPageSchema,
  SSE_EVENT_TYPES,
  sseEventSchemas,
  storedEventsSchema,
  strategiesSchema,
  tradeSchema,
  tradesPageSchema,
} from "@/lib/schemas";

const BASE = process.env.CONTRACT_API_URL?.replace(/\/+$/, "");

async function check<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  const res = await fetch(`${BASE}/${path}`);
  expect(res.status, `${path} status`).toBe(200);
  const body: unknown = await res.json();
  const parsed = schema.safeParse(body);
  expect(parsed.error?.issues, `${path} schema`).toBeUndefined();
  return parsed.data as z.infer<T>;
}

describe.skipIf(!BASE)("backend contract (live)", () => {
  it("GET /bot/status", () => check("bot/status", botStatusSchema));

  it("GET /trades and /trades/:id", async () => {
    for (const mode of ["PAPER", "LIVE", "BACKTEST"]) {
      const page = await check(`trades?mode=${mode}&limit=50`, tradesPageSchema);
      if (page.items[0]) await check(`trades/${page.items[0]._id}`, tradeSchema);
    }
  });

  it("GET /reports/*", async () => {
    for (const mode of ["PAPER", "LIVE", "BACKTEST"]) {
      await check(`reports/summary?mode=${mode}`, metricsSummarySchema);
      await check(`reports/equity-curve?mode=${mode}`, equityCurveSchema);
      await check(`reports/by-strategy?mode=${mode}`, groupedMetricPageSchema);
      await check(`reports/by-symbol?mode=${mode}`, groupedMetricPageSchema);
      await check(`reports/by-hour?mode=${mode}`, byHourSchema);
    }
    const cmp = await check("reports/compare-modes", compareModesSchema);
    expect(cmp.map((c) => c.mode)).toEqual(["BACKTEST", "PAPER", "LIVE"]);
    await check("reports/compare-modes?runId=nao-existe&dateField=exitTime&from=2026-01-01T00:00:00.000Z", compareModesSchema);
    const hour = await check("reports/by-hour?tz=America/Sao_Paulo", byHourSchema);
    expect(hour.timezone).toBe("America/Sao_Paulo");
    expect((await fetch(`${BASE}/reports/by-hour?tz=Mars/Olympus`)).status).toBe(400);
  });

  it("GET /backtest/runs and /backtest/runs/:runId", async () => {
    const page = await check("backtest/runs?limit=5", backtestRunsPageSchema);
    expect(page.items.length).toBeLessThanOrEqual(5);
    if (page.items[0]) await check(`backtest/runs/${page.items[0].runId}`, backtestRunSchema);
  });

  it("GET /strategies", () => check("strategies", strategiesSchema));

  it("GET /health reports Mongo and Redis", async () => {
    const health = await check("health", healthSchema);
    expect(health.mongo.ok).toBe(true);
    expect(health.redis.ok).toBe(true);
  });

  it("GET /events/recent returns the stream history with known event types", async () => {
    const events = await check("events/recent?limit=50", storedEventsSchema);
    for (const e of events) {
      if ((SSE_EVENT_TYPES as string[]).includes(e.type)) {
        const parsed = sseEventSchemas[e.type as keyof typeof sseEventSchemas].safeParse(e.data);
        expect(parsed.error?.issues, `${e.type} payload`).toBeUndefined();
      }
    }
  });
  it("GET /funding/ranking", async () => {
    const page = await check("funding/ranking?limit=10&page=2", fundingPageSchema);
    expect(page.page).toBe(2);
    expect(page.items.length).toBeLessThanOrEqual(10);
  });
  it("GET /exchange/balance", () => check("exchange/balance", balancesSchema));
  it("GET /exchange/candles", () => check("exchange/candles?symbol=BTCUSDT&interval=1h&limit=5", candlesSchema));

  it("GET /exchange/candles with a time range", async () => {
    const start = Math.floor((Date.now() - 6 * 3_600_000) / 3_600_000) * 3_600_000;
    const candles = await check(
      `exchange/candles?symbol=BTCUSDT&interval=1h&startTime=${start}&endTime=${start + 2 * 3_600_000}&limit=1000`,
      candlesSchema,
    );
    expect(candles.map((c) => c.openTime)).toEqual([start, start + 3_600_000, start + 2 * 3_600_000]);
  });

  it("GET /trades accepts runId and isSeed filters", async () => {
    await check("trades?runId=nao-existe", tradesPageSchema);
    await check("trades?isSeed=false&limit=1", tradesPageSchema);
  });

  it("GET /signals", async () => {
    for (const mode of ["PAPER", "LIVE", "BACKTEST"]) await check(`signals?mode=${mode}&limit=50`, signalsPageSchema);
    await check("signals?approved=false&limit=5", signalsPageSchema);
  });

  it("GET /funding/ranking with search and order", async () => {
    const asc = (await check("funding/ranking?limit=5&order=asc", fundingPageSchema)).items;
    expect(asc.map((r) => r.annualizedRatePct)).toEqual([...asc.map((r) => r.annualizedRatePct)].sort((a, b) => a - b));
    const btc = (await check("funding/ranking?limit=50&search=btc", fundingPageSchema)).items;
    expect(btc.every((r) => r.symbol.includes("BTC"))).toBe(true);
  });
});
