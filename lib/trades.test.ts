import { describe, expect, it } from "vitest";
import { INTERVAL_MS } from "@/lib/schemas/market";
import { autoInterval, exitReasonLabel, periodRange, tradeCandleWindow, tradeDurationMs } from "./trades";

const NOW = Date.parse("2026-09-29T12:00:00.000Z");
const H = 3_600_000;

describe("trade helpers", () => {
  it("labels exit reasons, keeping unknown values", () => {
    expect(exitReasonLabel("SL")).toBe("Stop loss");
    expect(exitReasonLabel("FOO")).toBe("FOO");
    expect(exitReasonLabel(undefined)).toBe("—");
  });

  it("measures duration of closed and open trades", () => {
    const entryTime = new Date(NOW - 5 * H).toISOString();
    expect(tradeDurationMs({ entryTime, exitTime: new Date(NOW - H).toISOString() }, NOW)).toBe(4 * H);
    expect(tradeDurationMs({ entryTime, exitTime: null }, NOW)).toBe(5 * H);
  });
});

describe("periodRange", () => {
  it("returns no bounds for 'all' and a lower bound for relative presets", () => {
    expect(periodRange("all", {}, NOW)).toEqual({});
    expect(periodRange("7d", {}, NOW)).toEqual({ from: new Date(NOW - 7 * 86_400_000).toISOString() });
  });

  it("uses whole local days for custom ranges", () => {
    const { from, to } = periodRange("custom", { from: "2026-09-01", to: "2026-09-02" }, NOW);
    expect(new Date(from!).getHours()).toBe(0);
    expect(new Date(to!).getTime() - new Date(from!).getTime()).toBe(2 * 86_400_000 - 1);
  });
});

describe("tradeCandleWindow", () => {
  const trade = { entryTime: new Date(NOW - 48 * H).toISOString(), exitTime: new Date(NOW - 24 * H).toISOString() };

  it("picks an interval that keeps the chart readable", () => {
    expect(autoInterval(2 * H)).toBe("1m");
    expect(autoInterval(48 * H)).toBe("15m");
    expect(autoInterval(400 * 86_400_000)).toBe("3d");
  });

  it("covers the whole trade with context on both sides, never past now", () => {
    const w = tradeCandleWindow(trade, NOW);
    expect(w.startTime).toBeLessThan(Date.parse(trade.entryTime));
    expect(w.endTime).toBeGreaterThanOrEqual(Date.parse(trade.exitTime) - INTERVAL_MS[w.interval]);
    expect(w.endTime).toBeLessThanOrEqual(NOW);
    expect(w.limit).toBeLessThanOrEqual(1000);
    expect(w.truncated).toBe(false);
    expect(w.startTime % INTERVAL_MS[w.interval]).toBe(0);
  });

  it("extends open trades up to now", () => {
    const w = tradeCandleWindow({ entryTime: trade.entryTime, exitTime: undefined }, NOW, "1h");
    expect(w.endTime).toBe(NOW);
  });

  it("flags when a forced small interval can't cover the trade", () => {
    const w = tradeCandleWindow(trade, NOW, "1m");
    expect(w.truncated).toBe(true);
    expect(w.limit).toBe(1000);
  });
});
