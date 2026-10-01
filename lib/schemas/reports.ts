import { z } from "zod";
import { isoDate, modeSchema, objectId, opt, type Mode } from "./common";

/** metrics.util.MetricsSummary — GET /reports/summary and backtest run summaries. */
/** metrics.util.SideMetrics — the same core metrics for one direction. */
export const sideMetricsSchema = z.object({
  tradeCount: z.number().int(),
  winCount: z.number().int(),
  winRate: z.number(),
  totalPnl: z.number(),
  profitFactor: z.number(),
  expectancy: z.number(),
  avgReturnPct: z.number(),
});
export type SideMetrics = z.infer<typeof sideMetricsSchema>;

const bucketsSchema = z.array(z.object({ bucket: z.string(), count: z.number().int() }));

/** metrics.util.RMultipleStats — results in multiples of the initial risk (R). */
export const rStatsSchema = z.object({
  tradeCount: z.number().int(),
  avgR: z.number(),
  medianR: z.number(),
  bestR: z.number(),
  worstR: z.number(),
  tradesAtLeast3R: z.number().int(),
  /** Buckets "< -1R", "-1R a 0R", … ">= 3R". */
  rHistogram: bucketsSchema,
  /** Share of the gross profit made by the best 10% of trades (0–1); null without winning trades. */
  topDecilePnlShare: z.number().nullable(),
  /** Implied Kelly fraction (diagnostic only); null without both wins and losses. */
  kellyFraction: z.number().nullable(),
});
export type RStats = z.infer<typeof rStatsSchema>;

export const metricsSummarySchema = z.object({
  tradeCount: z.number().int(),
  winCount: z.number().int(),
  lossCount: z.number().int(),
  /** Fraction (0.55 = 55%). */
  winRate: z.number(),
  totalPnl: z.number(),
  avgWin: z.number(),
  avgLoss: z.number(),
  payoffRatio: z.number(),
  profitFactor: z.number(),
  expectancy: z.number(),
  /** Mean pnlPct per trade, in percent. Absent in backtest runs saved before this field existed. */
  avgReturnPct: opt(z.number()),
  maxDrawdown: z.number(),
  /** Fraction. Relative to the running peak, which starts at 0 for /reports/summary. */
  maxDrawdownPct: z.number(),
  /** Per-trade (pnlPct series), not annualized. */
  sharpe: z.number(),
  sortino: z.number(),
  maxLosingStreak: z.number().int(),
  avgHoldTimeMs: z.number(),
  /** Missing on backtest runs with no trades saved before the backend's `minimize: false` fix. */
  exitReasonBreakdown: z.record(z.string(), z.number()).default({}),
  pnlHistogram: z.array(z.object({ bucket: z.string(), count: z.number().int() })),
  // Added with Long/Short support; absent on older backends and on backtest runs saved before it.
  lossRate: opt(z.number()),
  grossProfit: opt(z.number()),
  /** Absolute value of the summed losing trades. */
  grossLoss: opt(z.number()),
  totalFees: opt(z.number()),
  longCount: opt(z.number().int()),
  shortCount: opt(z.number().int()),
  bySide: opt(z.object({ LONG: sideMetricsSchema, SHORT: sideMetricsSchema })),
  /** Absent when no trade has entry/stop/qty (older data). */
  rStats: opt(rStatsSchema),
});
export type MetricsSummary = z.infer<typeof metricsSummarySchema>;

/** reports.interface.GroupedMetric. `key` is the group value stringified. */
export const groupedMetricSchema = z.object({
  key: z.string(),
  tradeCount: z.number().int(),
  totalPnl: z.number(),
  winRate: z.number(),
  profitFactor: z.number(),
});
export type GroupedMetric = z.infer<typeof groupedMetricSchema>;

/** GET /reports/by-strategy and /reports/by-symbol. */
export const groupedMetricPageSchema = z.object({
  items: z.array(groupedMetricSchema),
  total: z.number().int(),
});
export type GroupedMetricPage = z.infer<typeof groupedMetricPageSchema>;

/**
 * GET /reports/by-hour. Buckets by exit time in the `tz` sent (IANA, default UTC); day of week
 * is 1 = domingo … 7 = sábado. Keys come sorted numerically.
 */
export const byHourSchema = z.object({
  byHourOfDay: z.array(groupedMetricSchema),
  byDayOfWeek: z.array(groupedMetricSchema),
  /** IANA zone the buckets were computed in (the `tz` sent, default UTC). */
  timezone: z.string(),
});
export type ByHour = z.infer<typeof byHourSchema>;

/**
 * GET /reports/compare-modes — always the three modes, each with full metrics. BACKTEST covers
 * `runId` (null = all runs) over its own dates; from/to only apply to PAPER and LIVE.
 */
export const modeComparisonSchema = z.object({
  mode: modeSchema,
  runId: z.string().nullable(),
  summary: metricsSummarySchema,
});
export type ModeComparison = z.infer<typeof modeComparisonSchema>;
export const compareModesSchema = z.array(modeComparisonSchema);

/** equity_snapshots document — GET /reports/equity-curve. */
export const equitySnapshotSchema = z.object({
  _id: objectId,
  mode: modeSchema,
  runId: opt(z.string()),
  timestamp: isoDate,
  balance: z.number(),
  equity: z.number(),
  openPositions: z.number().int(),
});
export type EquitySnapshot = z.infer<typeof equitySnapshotSchema>;
export const equityCurveSchema = z.array(equitySnapshotSchema);

/** ReportsFilterQueryDto. */
export interface ReportsFilter {
  mode?: Mode;
  symbol?: string;
  strategy?: string;
  /** ISO, inclusive bounds on `dateField`. */
  from?: string;
  to?: string;
  /** Default entryTime. exitTime = "PnL realized in the period". */
  dateField?: "entryTime" | "exitTime";
  /** Backtest run id. */
  runId?: string;
}

/** EquityCurveQueryDto. */
export interface EquityCurveFilter {
  mode?: Mode;
  runId?: string;
  /** ISO, inclusive bounds on timestamp. */
  from?: string;
  to?: string;
}
