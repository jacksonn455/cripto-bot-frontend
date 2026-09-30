import { describe, expect, it } from "vitest";
import type { LiveEvent } from "@/components/live/live-events-provider";
import { buildTimeline, describeEvent, findGaps, markReevaluations } from "./live-feed";

const H = 3_600_000;
const T0 = Date.parse("2026-09-29T10:00:00.000Z");

function cycle(symbol: string, at: number, opts: { reason?: string; candle?: number; reevaluation?: boolean; rsi?: number } = {}) {
  const e: LiveEvent = {
    type: "bot.cycle",
    receivedAt: at,
    data: {
      symbol,
      action: "HOLD",
      reason: opts.reason ?? "sem cruzamento EMA rapida/lenta",
      at: new Date(at).toISOString(),
      mode: "PAPER",
      candleTime: opts.candle !== undefined ? new Date(opts.candle).toISOString() : undefined,
      indicators: opts.rsi !== undefined ? { emaFast: 100, emaSlow: 101, rsi: opts.rsi } : undefined,
      reevaluation: opts.reevaluation,
    },
  };
  return describeEvent(e);
}

describe("describeEvent for evaluations", () => {
  it("speaks plain Portuguese and shows the numbers", () => {
    const item = cycle("ETHUSDT", T0, { rsi: 57.34 });
    expect(item.title).toBe("ETHUSDT: sem entrada");
    expect(item.detail).toBe("Média rápida ainda não cruzou a lenta");
    expect(item.metrics).toBe("EMA20 100,00 · EMA50 101,00 · RSI 57,3");
    expect(item.hint).toMatch(/Isso é normal/);
  });
});

describe("markReevaluations", () => {
  it("uses the backend flag, a repeated candle, or (old events) a quick repeat of the same decision", () => {
    const first = cycle("BTCUSDT", T0, { candle: T0 - 1 });
    const sameCandle = cycle("BTCUSDT", T0 + 60_000, { candle: T0 - 1 });
    const flagged = cycle("BTCUSDT", T0 + H, { candle: T0 + H - 1, reevaluation: true });
    const oldA = cycle("ETHUSDT", T0);
    const oldQuickRepeat = cycle("ETHUSDT", T0 + 3 * 60_000);
    const oldNextHour = cycle("ETHUSDT", T0 + H);
    const marked = markReevaluations([first, sameCandle, flagged, oldA, oldQuickRepeat, oldNextHour]);
    expect([...marked]).toEqual(expect.arrayContaining([sameCandle, flagged, oldQuickRepeat]));
    expect(marked.has(first)).toBe(false);
    expect(marked.has(oldNextHour)).toBe(false);
  });
});

describe("findGaps", () => {
  it("flags more than 1h10 without an evaluation of a symbol", () => {
    const items = [cycle("BTCUSDT", T0), cycle("BTCUSDT", T0 + H), cycle("BTCUSDT", T0 + 5 * H), cycle("ETHUSDT", T0 + H)];
    expect(findGaps(items)).toEqual([{ symbol: "BTCUSDT", from: T0 + H, to: T0 + 5 * H }]);
  });
});

describe("buildTimeline", () => {
  it("groups consecutive 'sem entrada' of the same symbol and reason, even interleaved with other symbols", () => {
    const newestFirst = [
      cycle("ETHUSDT", T0 + 2 * H + 1, { candle: T0 + 2 * H }),
      cycle("BTCUSDT", T0 + 2 * H, { candle: T0 + 2 * H }),
      cycle("ETHUSDT", T0 + H + 1, { candle: T0 + H }),
      cycle("BTCUSDT", T0 + H, { candle: T0 + H }),
    ];
    const { rows } = buildTimeline(newestFirst, { showReevaluations: false });
    expect(rows.map((r) => r.type)).toEqual(["group", "group"]);
    expect(rows[0].type === "group" && rows[0].items.map((i) => i.cycle!.symbol)).toEqual(["ETHUSDT", "ETHUSDT"]);
  });

  it("splits groups at other events and at a different reason", () => {
    const trade = describeEvent({ type: "trade.opened", receivedAt: T0 + 1.5 * H, data: { symbol: "BTCUSDT", side: "LONG", qty: 1, entryPrice: 1, mode: "PAPER" } });
    const newestFirst = [
      cycle("BTCUSDT", T0 + 2 * H, { candle: T0 + 2 * H }),
      trade,
      cycle("BTCUSDT", T0 + H, { candle: T0 + H, reason: "regime nao esta em alta" }),
      cycle("BTCUSDT", T0 + 0.5 * H, { candle: T0 + 0.5 * H }),
    ];
    const { rows } = buildTimeline(newestFirst, { showReevaluations: false });
    expect(rows.map((r) => r.type)).toEqual(["item", "item", "item", "item"]);
  });

  it("hides restart re-evaluations by default and counts them", () => {
    const newestFirst = [
      cycle("BTCUSDT", T0 + 2 * 60_000, { candle: T0 - 1, reevaluation: true }),
      cycle("BTCUSDT", T0, { candle: T0 - 1 }),
    ];
    const hidden = buildTimeline(newestFirst, { showReevaluations: false });
    expect(hidden.hiddenReevaluations).toBe(1);
    expect(hidden.rows).toHaveLength(1);
    const shown = buildTimeline(newestFirst, { showReevaluations: true });
    expect(shown.rows[0].type === "group" && shown.rows[0].reevaluations).toBe(1);
  });

  it("puts a gap warning between the evaluations around it", () => {
    const newestFirst = [cycle("BTCUSDT", T0 + 6 * H, { candle: T0 + 6 * H }), cycle("BTCUSDT", T0, { candle: T0 })];
    const { rows } = buildTimeline(newestFirst, { showReevaluations: false });
    expect(rows.map((r) => r.type)).toEqual(["item", "gap", "item"]);
    expect(rows[1]).toMatchObject({ type: "gap", symbol: "BTCUSDT", from: T0, to: T0 + 6 * H });
  });
});
