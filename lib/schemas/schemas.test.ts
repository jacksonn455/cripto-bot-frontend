import { describe, expect, it } from "vitest";
import * as f from "@/test/fixtures";
import {
  backtestRunResponseSchema,
  backtestRunSchema,
  balancesSchema,
  botStateSchema,
  botStatusSchema,
  byHourSchema,
  candlesSchema,
  compareModesSchema,
  equityCurveSchema,
  fundingPageSchema,
  groupedMetricPageSchema,
  killSwitchResultSchema,
  metricsSummarySchema,
  signalsPageSchema,
  sseEventSchemas,
  strategiesSchema,
  tradeSchema,
  tradesPageSchema,
} from "./index";

describe("schemas accept backend example responses", () => {
  it.each([
    ["GET /bot/status", botStatusSchema, f.botStatusFixture],
    ["GET /bot/status (boot)", botStatusSchema, f.botStatusBootFixture],
    ["POST /bot/pause", botStateSchema, f.botStateFixture],
    ["POST /bot/kill-switch", killSwitchResultSchema, f.killSwitchFixture],
    ["GET /trades", tradesPageSchema, f.tradesPageFixture],
    ["GET /trades/:id (open)", tradeSchema, f.openTradeFixture],
    ["GET /reports/summary", metricsSummarySchema, f.metricsSummaryFixture],
    ["GET /reports/summary (empty)", metricsSummarySchema, f.emptyMetricsSummaryFixture],
    ["GET /reports/by-strategy", groupedMetricPageSchema, f.groupedMetricPageFixture],
    ["GET /reports/by-hour", byHourSchema, f.byHourFixture],
    ["GET /reports/compare-modes", compareModesSchema, f.compareModesFixture],
    ["GET /reports/equity-curve", equityCurveSchema, f.equityCurveFixture],
    ["POST /backtest/run", backtestRunResponseSchema, f.backtestRunResponseFixture],
    ["GET /backtest/runs/:id", backtestRunSchema, f.backtestRunFixture],
    ["GET /funding/ranking", fundingPageSchema, f.fundingPageFixture],
    ["GET /strategies", strategiesSchema, f.strategiesFixture],
    ["GET /signals", signalsPageSchema, f.signalsPageFixture],
    ["GET /exchange/balance", balancesSchema, f.balancesFixture],
    ["GET /exchange/candles", candlesSchema, f.candlesFixture],
  ] as const)("%s", (_name, schema, fixture) => {
    const result = schema.safeParse(fixture);
    expect(result.error?.issues).toBeUndefined();
  });

  it("parses every SSE event payload the backend emits", () => {
    expect(sseEventSchemas["trade.opened"].safeParse({ symbol: "BTCUSDT", side: "LONG", qty: 0.1, entryPrice: 60000, stopLoss: 58000, mode: "PAPER" }).success).toBe(true);
    expect(sseEventSchemas["trade.closed"].safeParse({ symbol: "BTCUSDT", pnl: -12.5, reason: "SL", mode: "LIVE" }).success).toBe(true);
    expect(sseEventSchemas["bot.paused"].safeParse({ reason: "KILL_SWITCH" }).success).toBe(true);
    expect(sseEventSchemas["bot.resumed"].safeParse({}).success).toBe(true);
    expect(sseEventSchemas["alert.critical"].safeParse({ message: "boom" }).success).toBe(true);
    expect(
      sseEventSchemas["signal.recorded"].safeParse({
        symbol: "BTCUSDT", strategy: "TrendRegimeStrategy", signal: "ENTER_LONG", reason: "x", price: 1,
        approved: false, rejectReason: "RR_TOO_LOW", mode: "PAPER", candleTime: "2026-09-29T13:59:59.999Z",
      }).success,
    ).toBe(true);
    expect(sseEventSchemas["bot.error"].safeParse({ message: "timeout", at: "2026-09-29T13:59:59.999Z" }).success).toBe(true);
  });
});

describe("schemas reject malformed responses", () => {
  it("rejects an unknown bot mode", () => {
    expect(botStatusSchema.safeParse({ ...f.botStatusFixture, mode: "BACKTEST" }).success).toBe(false);
  });

  it("rejects a trade with a non-numeric pnl", () => {
    expect(tradeSchema.safeParse({ ...f.closedTradeFixture, pnl: "54" }).success).toBe(false);
  });

  it("rejects an unknown exit reason", () => {
    expect(tradeSchema.safeParse({ ...f.closedTradeFixture, exitReason: "LIQUIDATED" }).success).toBe(false);
  });

  it("rejects a non-ISO date", () => {
    expect(botStatusSchema.safeParse({ ...f.botStatusFixture, lastCycleAt: "ontem" }).success).toBe(false);
  });

  it("accepts a stored zero-trade backtest summary that lost its empty exitReasonBreakdown", () => {
    const summary: Record<string, unknown> = { ...f.emptyMetricsSummaryFixture };
    delete summary.exitReasonBreakdown;
    const parsed = backtestRunSchema.parse({ ...f.backtestRunFixture, summary });
    expect(parsed.summary.exitReasonBreakdown).toEqual({});
  });

  it("strips fields the dashboard doesn't know (e.g. __v)", () => {
    const parsed = tradeSchema.parse(f.closedTradeFixture);
    expect(parsed).not.toHaveProperty("__v");
  });
});
