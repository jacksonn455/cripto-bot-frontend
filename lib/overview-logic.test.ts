import { describe, expect, it } from "vitest";
import { loopHealth, pauseReasonLabel } from "./bot-health";
import { downsample, equityStats, withDrawdown } from "./equity";
import { unrealizedPnl } from "./positions";

const NOW = Date.parse("2026-09-29T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("loopHealth", () => {
  const base = { executionEnabled: true, pollIntervalSeconds: 60 };

  it("is disabled when execution is off, regardless of heartbeat", () => {
    expect(loopHealth({ ...base, executionEnabled: false, lastPollAt: ago(0) }, NOW).state).toBe("disabled");
  });

  it("is starting before the first tick", () => {
    expect(loopHealth({ ...base, lastPollAt: null }, NOW).state).toBe("starting");
  });

  it("is ok within 3 poll intervals", () => {
    expect(loopHealth({ ...base, lastPollAt: ago(170_000) }, NOW)).toMatchObject({ state: "ok" });
  });

  it("is stale after 3 missed ticks", () => {
    expect(loopHealth({ ...base, lastPollAt: ago(181_000) }, NOW)).toMatchObject({ state: "stale", limitMs: 180_000 });
  });

  it("never flags before 2 minutes, even with a short interval", () => {
    expect(loopHealth({ ...base, pollIntervalSeconds: 5, lastPollAt: ago(100_000) }, NOW).state).toBe("ok");
    expect(loopHealth({ ...base, pollIntervalSeconds: 5, lastPollAt: ago(121_000) }, NOW).state).toBe("stale");
  });
});

describe("pauseReasonLabel", () => {
  it("translates known reasons and keeps unknown ones", () => {
    expect(pauseReasonLabel("KILL_SWITCH")).toBe("Kill switch acionado");
    expect(pauseReasonLabel("vou viajar")).toBe("vou viajar");
    expect(pauseReasonLabel(undefined)).toBe("Motivo não informado");
  });
});

describe("equity", () => {
  const series = [100, 120, 90, 110, 130].map((equity, i) => ({ timestamp: ago((10 - i) * 60_000), equity }));

  it("computes drawdown from the running peak", () => {
    const pts = withDrawdown(series);
    expect(pts.map((p) => Number(p.drawdown.toFixed(4)))).toEqual([0, 0, -0.25, -0.0833, 0]);
  });

  it("summarizes the series", () => {
    const stats = equityStats(withDrawdown(series))!;
    expect(stats.max.equity).toBe(130);
    expect(stats.min.equity).toBe(90);
    expect(stats.worstDrawdown.equity).toBe(90);
    expect(equityStats([])).toBeNull();
  });

  it("downsamples while keeping the worst drawdown and the last point", () => {
    const long = Array.from({ length: 5000 }, (_, i) => ({ timestamp: ago((5000 - i) * 1000), equity: i === 2345 ? 1 : 1000 + i }));
    const pts = withDrawdown(long);
    const small = downsample(pts, 100);
    expect(small.length).toBeLessThanOrEqual(200);
    expect(small).toContainEqual(pts[2345]);
    expect(small[small.length - 1]).toEqual(pts[pts.length - 1]);
    expect(small.every((p, i) => i === 0 || p.t > small[i - 1].t)).toBe(true);
  });
});

describe("unrealizedPnl", () => {
  it("is positive for a long above entry and a short below entry", () => {
    expect(unrealizedPnl({ side: "LONG", entryPrice: 100, qty: 2 }, 110)).toEqual({ pnl: 20, pnlPct: 10 });
    expect(unrealizedPnl({ side: "SHORT", entryPrice: 100, qty: 2 }, 90)).toEqual({ pnl: 20, pnlPct: 10 });
    expect(unrealizedPnl({ side: "LONG", entryPrice: 100, qty: 2 }, 95).pnl).toBe(-10);
  });
});

describe("loopHealth with the backend worker status", () => {
  const base = { executionEnabled: true, pollIntervalSeconds: 60, lastPollAt: ago(0) };
  const worker = (state: "ONLINE" | "OFFLINE" | "STARTING" | "DISABLED", heartbeatAgoMs: number) =>
    ({ state, lastHeartbeatAt: ago(heartbeatAgoMs), heartbeatTimeoutSeconds: 300 }) as never;

  it("trusts the backend verdict over the in-memory lastPollAt", () => {
    // lastPollAt looks fresh, but the persisted heartbeat says the worker is down.
    expect(loopHealth({ ...base, worker: worker("OFFLINE", 2 * 3_600_000) }, NOW)).toMatchObject({ state: "stale", lagMs: 2 * 3_600_000 });
    expect(loopHealth({ ...base, worker: worker("ONLINE", 8_000) }, NOW)).toMatchObject({ state: "ok", lagMs: 8_000 });
    expect(loopHealth({ ...base, worker: worker("STARTING", 0) }, NOW).state).toBe("starting");
    expect(loopHealth({ ...base, worker: worker("DISABLED", 0) }, NOW).state).toBe("disabled");
  });
});
