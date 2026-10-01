import { describe, expect, it } from "vitest";
import { buildTimeline, describeEvent } from "./live-feed";

const at = Date.UTC(2026, 8, 30, 12);

describe("describeEvent (Long/Short payloads)", () => {
  it("titles a closed trade with its side, pnl and %, and shows prices and the detail", () => {
    const item = describeEvent({
      type: "trade.closed",
      receivedAt: at,
      data: {
        symbol: "BTCUSDT",
        side: "SHORT",
        pnl: 15,
        pnlPct: 1.6,
        reason: "SIGNAL",
        mode: "PAPER",
        entryPrice: 62000,
        exitPrice: 61000,
        reasonDetail: "EMA20 cruzou acima da EMA50",
      },
    } as never);
    expect(item.title).toMatch(/^SHORT fechado em BTCUSDT: \+15,00 USDT \(\+1,60\s?%\)$/);
    expect(item.detail).toContain("62.000,00 → 61.000,00");
    expect(item.detail).toContain("EMA20 cruzou acima da EMA50");
    expect(item.tone).toBe("profit");
  });

  it("keeps working with the older, minimal payload", () => {
    const item = describeEvent({ type: "trade.closed", receivedAt: at, data: { symbol: "ETHUSDT", pnl: -3, reason: "SL", mode: "PAPER" } } as never);
    expect(item.title).toMatch(/^Saída em ETHUSDT: /);
    expect(item.detail).toBe("Stop loss");
  });

  it("adds timeframe and signal reason to an entry", () => {
    const item = describeEvent({
      type: "trade.opened",
      receivedAt: at,
      data: { symbol: "BTCUSDT", side: "SHORT", qty: 0.01, entryPrice: 62000, stopLoss: 63000, mode: "PAPER", timeframe: "1h", signalReason: "cruzou abaixo" },
    } as never);
    expect(item.title).toBe("Entrada SHORT em BTCUSDT");
    expect(item.detail).toContain("1h");
    expect(item.detail).toContain("cruzou abaixo");
  });
});

describe("worker lifecycle in the feed", () => {
  const H = 3_600_000;
  const t0 = Date.parse("2026-10-01T01:00:00.000Z");
  const cycle = (symbol: string, ts: number) =>
    describeEvent({
      type: "bot.cycle",
      receivedAt: ts,
      data: { symbol, action: "HOLD", reason: "r", at: new Date(ts).toISOString(), candleTime: new Date(ts).toISOString() },
    } as never);

  it("a start after an outage is a warning with the offline duration", () => {
    const item = describeEvent({
      type: "worker.started",
      receivedAt: t0 + 11 * H,
      data: {
        instanceId: "x",
        startedAt: new Date(t0 + 11 * H).toISOString(),
        downtime: { from: new Date(t0 + 0.75 * H).toISOString(), to: new Date(t0 + 11 * H).toISOString(), durationSeconds: 36_900, previousStopReason: null },
      },
    } as never);
    expect(item).toMatchObject({ kind: "worker", tone: "warning" });
    expect(item.title).toMatch(/voltou após 10 h 15 min offline/);
    expect(item.downtime).toEqual({ from: t0 + 0.75 * H, to: t0 + 11 * H });
  });

  it("a gap the backend confirmed is labeled as a real outage; an unconfirmed one is not", () => {
    const outage = describeEvent({
      type: "worker.started",
      receivedAt: t0 + 11 * H,
      data: {
        instanceId: "x",
        startedAt: new Date(t0 + 11 * H).toISOString(),
        downtime: { from: new Date(t0 + 0.75 * H).toISOString(), to: new Date(t0 + 11 * H).toISOString(), durationSeconds: 36_900 },
      },
    } as never);
    const items = [cycle("BTCUSDT", t0 + 11 * H + 60_000), outage, cycle("BTCUSDT", t0)];
    const gap = buildTimeline(items, { showReevaluations: false }).rows.find((r) => r.type === "gap");
    expect(gap).toMatchObject({ type: "gap", symbol: "BTCUSDT", downtime: { from: t0 + 0.75 * H, to: t0 + 11 * H } });

    const unconfirmed = buildTimeline([cycle("ETHUSDT", t0 + 5 * H), cycle("ETHUSDT", t0)], { showReevaluations: false }).rows.find(
      (r) => r.type === "gap",
    );
    expect(unconfirmed).toMatchObject({ type: "gap", downtime: undefined });
  });
});
