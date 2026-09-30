import { z } from "zod";
import { isoDate, opt } from "./common";
import { metricsSummarySchema } from "./reports";

const walkForwardWindowSchema = z.object({
  from: isoDate,
  to: isoDate,
  summary: metricsSummarySchema,
  tradeCount: z.number().int(),
});

/** Trading costs charged in the simulation. The slippage/short-carry fields are absent on older runs. */
export const backtestCostsSchema = z.object({
  totalFees: z.number(),
  feesPctOfCapital: z.number(),
  totalSlippage: opt(z.number()),
  slippagePctOfCapital: opt(z.number()),
  /** Short borrow/funding cost, already included in totalFees. */
  totalShortCarry: opt(z.number()),
  shortBorrowPctPerDay: opt(z.number()),
});
export type BacktestCosts = z.infer<typeof backtestCostsSchema>;

/** BacktestService.BacktestRunResponse — POST /backtest/run. */
export const backtestRunResponseSchema = z.object({
  runId: z.string(),
  summary: metricsSummarySchema,
  tradeCount: z.number().int(),
  paramVariationsTestedForStrategy: z.number().int(),
  walkForwardWindows: opt(z.array(walkForwardWindowSchema)),
  costs: opt(backtestCostsSchema),
  exposurePct: opt(z.number()),
});
export type BacktestRunResponse = z.infer<typeof backtestRunResponseSchema>;

/** backtest_runs document — GET /backtest/runs and /backtest/runs/:runId. */
export const backtestRunSchema = z.object({
  runId: z.string(),
  strategy: z.string(),
  /** { strategy, symbol, timeframe, feesPct, slippagePct, initialBalance } as hashed by the backend. */
  params: z.record(z.string(), z.unknown()),
  paramsHash: z.string(),
  symbols: z.array(z.string()),
  timeframe: z.string(),
  from: isoDate,
  to: isoDate,
  feesPct: z.number(),
  slippagePct: z.number(),
  summary: metricsSummarySchema,
  walkForwardWindows: opt(z.array(walkForwardWindowSchema)),
  createdAt: isoDate,
  /** Distinct parameter combinations already tested for this strategy (overfitting warning). */
  paramVariationsTestedForStrategy: z.number().int(),
  /** Buy-and-hold over the same period (equal allocation, no fees). Absent on older runs. */
  benchmark: opt(
    z.object({
      bySymbol: z.record(z.string(), z.object({ startPrice: z.number(), endPrice: z.number(), returnPct: z.number() })),
      buyAndHoldPct: z.number(),
    }),
  ),
  /** Trading costs charged in the simulation. Absent on older runs. */
  costs: opt(backtestCostsSchema),
  /** Fraction (0–1) of the simulated candles with an open position. Absent on older runs. */
  exposurePct: opt(z.number()),
});
export type BacktestRun = z.infer<typeof backtestRunSchema>;
/** GET /backtest/runs — newest first. */
export const backtestRunsPageSchema = z.object({
  items: z.array(backtestRunSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type BacktestRunsPage = z.infer<typeof backtestRunsPageSchema>;

/** RunBacktestDto. Unknown fields are rejected by the backend. */
export interface RunBacktestInput {
  strategy: string;
  /** 1–10. Several symbols split the initial balance equally, each simulated on its own. */
  symbols: string[];
  timeframe: string;
  /** Regime filter candles; defaults to the live TREND_REGIME_TIMEFRAME. */
  regimeTimeframe?: string;
  from: string;
  to: string;
  initialBalance?: number;
  /** Fraction per side, 0–0.1 (0.001 = 0,1%). */
  feesPct?: number;
  /** Fraction, 0–0.1. */
  slippagePct?: number;
  /** Short carry per day held, fraction of the entry notional (0–0.05). Only matters with allowShort=1. */
  shortBorrowPctPerDay?: number;
  walkForward?: { testWindowDays: number };
  /** Overrides for GET /strategies params; only changed ones need to be sent. */
  strategyParams?: Record<string, number>;
}

/** GET /strategies. */
export const strategyParamSchema = z.object({
  key: z.string(),
  description: z.string(),
  min: z.number(),
  max: z.number(),
  integer: z.boolean(),
  /** Current (configured) value. */
  value: z.number(),
});
export type StrategyParam = z.infer<typeof strategyParamSchema>;
export const strategiesSchema = z.object({
  strategies: z.array(z.object({ name: z.string(), params: z.array(strategyParamSchema) })),
  /** What the paper/live loop runs. */
  live: z.object({
    strategy: z.string(),
    symbols: z.array(z.string()),
    timeframe: z.string(),
    regimeTimeframe: z.string(),
  }),
});
export type Strategies = z.infer<typeof strategiesSchema>;
