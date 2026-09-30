import { describe, expect, it } from "vitest";
import { backtestRunFixture, metricsSummaryFixture } from "@/test/fixtures";
import { backtestRunSchema, type BacktestRun } from "@/lib/schemas";
import { breakEvenWinRate, readRun } from "./backtest-explain";

const base = backtestRunSchema.parse(backtestRunFixture);
const run = (patch: Omit<Partial<BacktestRun>, "summary"> & { summary?: Partial<BacktestRun["summary"]> }): BacktestRun => ({
  ...base,
  ...patch,
  summary: { ...base.summary, ...(patch.summary ?? {}) },
});
const finding = (r: BacktestRun, key: string) => readRun(r).findings.find((f) => f.key === key);

describe("breakEvenWinRate", () => {
  it("is 50% with payoff 1 and lower with bigger wins", () => {
    expect(breakEvenWinRate(1)).toBeCloseTo(0.5);
    expect(breakEvenWinRate(2)).toBeCloseTo(1 / 3);
  });
});

describe("readRun", () => {
  it("reads the result over the initial balance and the period", () => {
    const r = readRun(run({ summary: { totalPnl: 321.5 } }));
    expect(r.returnPct).toBeCloseTo(3.215);
    expect(r.days).toBe(151); // 01/01 → 01/06
    expect(finding(run({ summary: { totalPnl: 321.5 } }), "result")!.text).toContain("+3,22% sobre o saldo inicial");
  });

  it("compares with buy-and-hold when available", () => {
    const withBench = run({ summary: { totalPnl: 321.5 }, benchmark: { bySymbol: {}, buyAndHoldPct: 10 } });
    expect(finding(withBench, "hold")).toMatchObject({ tone: "bad", title: "Pior que só comprar e segurar" });
    expect(readRun(withBench).verdict.kind).toBe("inconclusive"); // only 10 trades in the fixture
    expect(finding(run({}), "hold")!.title).toBe("Sem comparação com comprar e segurar");
  });

  it("flags a small sample and explains win rate against payoff", () => {
    expect(finding(run({}), "sample")!.tone).toBe("warn");
    const edge = finding(run({}), "edge")!; // 60% wins, payoff 1,65 → needs > 38%
    expect(edge.tone).toBe("good");
    expect(edge.text).toContain("mais de 38%");
  });

  it("tells when fees turned a profit into a loss", () => {
    const r = run({ summary: { totalPnl: -20 }, costs: { totalFees: 50, feesPctOfCapital: 0.005 } });
    expect(finding(r, "costs")!.text).toContain("as taxas transformaram lucro em prejuízo");
  });

  it("gives a verdict from sample, result, benchmark and consistency", () => {
    const big = { tradeCount: 40, winCount: 24, lossCount: 16 };
    expect(readRun(run({ summary: { ...big, totalPnl: -100 } })).verdict.kind).toBe("loss");
    expect(readRun(run({ summary: { ...big, totalPnl: 500 }, benchmark: { bySymbol: {}, buyAndHoldPct: 20 } })).verdict.kind).toBe("below-hold");
    const windows = [
      { from: base.from, to: base.to, summary: { ...metricsSummaryFixture, totalPnl: 900 }, tradeCount: 20 },
      { from: base.from, to: base.to, summary: { ...metricsSummaryFixture, totalPnl: -100 }, tradeCount: 10 },
      { from: base.from, to: base.to, summary: { ...metricsSummaryFixture, totalPnl: -100 }, tradeCount: 10 },
    ];
    expect(readRun(run({ summary: { ...big, totalPnl: 700 }, walkForwardWindows: windows })).verdict.kind).toBe("unstable");
    expect(readRun(run({ summary: { ...big, totalPnl: 700 }, benchmark: { bySymbol: {}, buyAndHoldPct: 2 }, walkForwardWindows: [] })).verdict.kind).toBe("promising");
    expect(readRun(run({ summary: { tradeCount: 0, winCount: 0, lossCount: 0, totalPnl: 0 } })).verdict.kind).toBe("no-trades");
  });
});
