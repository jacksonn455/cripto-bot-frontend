import { describe, expect, it } from "vitest";
import { emptyMetricsSummaryFixture, metricsSummaryFixture } from "@/test/fixtures";
import { metricsSummarySchema, type MetricsSummary } from "@/lib/schemas";
import { buildComparison, fillBuckets, formatRatio } from "./analytics";

const base = metricsSummarySchema.parse(metricsSummaryFixture);
const empty = metricsSummarySchema.parse(emptyMetricsSummaryFixture);
const withSummary = (patch: Partial<MetricsSummary>) => ({ ...base, ...patch });

describe("fillBuckets", () => {
  it("returns all 24 hours in order, zero-filling missing ones", () => {
    const hours = fillBuckets([{ key: "14", tradeCount: 3, totalPnl: -20, winRate: 0.33, profitFactor: 0.5 }], "hour");
    expect(hours).toHaveLength(24);
    expect(hours[0]).toMatchObject({ label: "00h", value: 0, tradeCount: 0 });
    expect(hours[14]).toMatchObject({ label: "14h", value: -20, tradeCount: 3 });
  });

  it("maps weekday 1..7 to domingo..sábado", () => {
    const days = fillBuckets([{ key: "1", tradeCount: 1, totalPnl: 5, winRate: 1, profitFactor: 0 }], "weekday");
    expect(days.map((d) => d.label)).toEqual(["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]);
    expect(days[0].value).toBe(5);
  });
});

describe("formatRatio", () => {
  it("shows ∞ when there are wins and no losses (backend sends 0)", () => {
    expect(formatRatio(0, { tradeCount: 3, winCount: 3, lossCount: 0 })).toBe("∞");
    expect(formatRatio(0, { tradeCount: 0, winCount: 0, lossCount: 0 })).toBe("—");
    expect(formatRatio(1.5, { tradeCount: 4, winCount: 2, lossCount: 2 })).toBe("1,50");
  });
});

describe("buildComparison", () => {
  const row = (c: ReturnType<typeof buildComparison>, key: string) => c.rows.find((r) => r.key === key)!;

  it("flags large divergences from the backtest and nothing when similar", () => {
    const c = buildComparison([
      { mode: "BACKTEST", summary: base },
      { mode: "PAPER", summary: withSummary({ winRate: 0.45, profitFactor: 1.2, avgReturnPct: -0.3 }) },
      { mode: "LIVE", summary: withSummary({}) },
    ]);
    expect(row(c, "winRate").cells[1].divergence).toBe("−15,0 p.p. vs backtest");
    expect(row(c, "profitFactor").cells[1].divergence).toBe("−51% vs backtest");
    expect(row(c, "avgReturnPct").cells[1].divergence).toBe("sinal oposto ao backtest");
    expect(row(c, "winRate").cells[2].divergence).toBeNull();
    expect(row(c, "winRate").cells[0].divergence).toBeNull(); // backtest column is the reference
    expect(c.flags).toBe(3);
  });

  it("does not compare against an empty backtest or an empty mode", () => {
    const c = buildComparison([
      { mode: "BACKTEST", summary: empty },
      { mode: "PAPER", summary: withSummary({ winRate: 0.1 }) },
      { mode: "LIVE", summary: empty },
    ]);
    expect(c.flags).toBe(0);
    expect(row(c, "winRate").cells[2].text).toBe("—");
  });

  it("marks small samples", () => {
    const c = buildComparison([
      { mode: "BACKTEST", summary: withSummary({ tradeCount: 120 }) },
      { mode: "PAPER", summary: withSummary({ tradeCount: 12 }) },
      { mode: "LIVE", summary: empty },
    ]);
    expect(c.smallSample).toEqual([false, true, false]);
  });
});
