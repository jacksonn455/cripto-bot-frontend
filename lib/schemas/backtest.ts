import { z } from "zod";
import { isoDate, opt } from "./common";
import { metricsSummarySchema } from "./reports";

const walkForwardWindowSchema = z.object({
  from: isoDate,
  to: isoDate,
  summary: metricsSummarySchema,
  tradeCount: z.number().int(),
  /** Balance at the window start and the window's PnL as a fraction of it. Absent on older runs. */
  startBalance: opt(z.number()),
  returnPct: opt(z.number()),
});

/**
 * risk-adjusted.util.RiskAdjustedMetrics — from the DAILY equity curve, annualized with 365 days.
 * Fractions (0.12 = 12%).
 */
export const riskAdjustedSchema = z.object({
  days: z.number().int(),
  totalReturn: z.number(),
  cagr: z.number(),
  annualVolatility: z.number(),
  /** Not annualized: the unit of PSR/DSR. */
  sharpeDaily: z.number(),
  sharpeAnnualized: z.number(),
  sortinoAnnualized: z.number(),
  maxDrawdown: z.number(),
  calmar: z.number(),
  skewness: z.number(),
  /** Not excess (normal = 3). */
  kurtosis: z.number(),
  /** P(true Sharpe > 0). */
  probabilisticSharpe: z.number(),
});
export type RiskAdjusted = z.infer<typeof riskAdjustedSchema>;

/** BacktestService.RunOverfitting — computed when the run is read (the number of tries keeps growing). */
export const runOverfittingSchema = z.object({
  trials: z.number().int(),
  trialsWithSharpe: z.number().int(),
  sharpeVariance: z.number().nullable(),
  expectedMaxSharpeAnnualized: z.number().nullable(),
  /** Accept a variant only at >= 0.95. null = can't be estimated yet. */
  deflatedSharpe: z.number().nullable(),
  haircutSharpe: z.number(),
  /** Fraction of the Sharpe discounted by the multiple-testing haircut. */
  haircut: z.number(),
});
export type RunOverfitting = z.infer<typeof runOverfittingSchema>;

/** DSR at or above this = the Sharpe very likely isn't luck given the variations tried. */
export const DSR_THRESHOLD = 0.95;

/** Trading costs charged in the simulation. The slippage/short-carry fields are absent on older runs. */
export const backtestCostsSchema = z.object({
  totalFees: z.number(),
  feesPctOfCapital: z.number(),
  totalSlippage: opt(z.number()),
  slippagePctOfCapital: opt(z.number()),
  /** Short borrow/funding cost, already included in totalFees. */
  totalShortCarry: opt(z.number()),
  shortBorrowPctPerDay: opt(z.number()),
  /** Extra loss from stops filled at the open of a candle that gapped through them. */
  totalGapCost: opt(z.number()),
  gappedStops: opt(z.number().int()),
  /** Stop-exit slippage, when different from slippagePct. */
  stopSlippagePct: opt(z.number()),
  shortCarryModel: opt(z.enum(["fixed", "funding"])),
  /** With the funding model: symbols without funding history (charged the fixed rate). */
  fundingFallbackSymbols: opt(z.array(z.string())),
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
  riskAdjusted: opt(riskAdjustedSchema),
  engineVersion: opt(z.number().int()),
  /** Candidate-ledger rows stored for the run (only when it ran with recordCandidates). */
  candidatesRecorded: opt(z.number().int()),
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
  /** Daily/annualized metrics. Absent on older runs and on runs shorter than 3 days. */
  riskAdjusted: opt(riskAdjustedSchema),
  /** DSR and haircut given the variations tested. Absent when riskAdjusted is. */
  overfitting: opt(runOverfittingSchema),
  /** Simulation rules version (2 = stops gapped through fill at the open). Absent = 1. */
  engineVersion: opt(z.number().int()),
  /** Consecutive-stops pauses, each lifted at the next UTC day. Absent on older runs. */
  stopPauses: opt(z.number().int()),
});
export type BacktestRun = z.infer<typeof backtestRunSchema>;

const windowSideSchema = z.object({
  tradeCount: z.number().int(),
  winCount: z.number().int(),
  lossCount: z.number().int(),
  totalPnl: z.number(),
  returnPct: z.number(),
  profitFactor: z.number(),
  expectancy: z.number(),
  avgReturnPct: z.number(),
});
export type WindowSide = z.infer<typeof windowSideSchema>;
const nullableShare = z.number().nullable();

/** GET /backtest/compare — baseline vs variant, walk-forward window by window. */
export const runComparisonSchema = z.object({
  baselineRunId: z.string(),
  variantRunId: z.string(),
  comparable: z.boolean(),
  warnings: z.array(z.string()),
  windows: z.array(
    z.object({
      from: isoDate,
      to: isoDate,
      baseline: windowSideSchema,
      variant: windowSideSchema,
      variantBetter: z.object({ pnl: z.boolean(), profitFactor: z.boolean().nullable(), expectancy: z.boolean().nullable() }),
    }),
  ),
  variantWinShare: z.object({
    windows: z.number().int(),
    pnl: nullableShare,
    profitFactor: nullableShare,
    expectancy: nullableShare,
    profitFactorAndExpectancy: nullableShare,
  }),
  sample: z.object({
    baseline: z.object({ LONG: z.number().int(), SHORT: z.number().int() }),
    variant: z.object({ LONG: z.number().int(), SHORT: z.number().int() }),
    inconclusive: z.boolean(),
    minTradesPerSide: z.number().int(),
  }),
});
export type RunComparison = z.infer<typeof runComparisonSchema>;

/** GET /backtest/pbo — Probability of Backtest Overfitting (CSCV) over several variants. */
export const pboSchema = z.object({
  runIds: z.array(z.string()),
  windows: z.number().int(),
  blocks: z.number().int(),
  combinations: z.number().int(),
  pbo: z.number(),
  probOosLoss: z.number(),
  meanInSampleReturn: z.number(),
  meanOutOfSampleReturn: z.number(),
  logitHistogram: z.array(z.object({ bucket: z.string(), count: z.number().int() })),
  selected: z.array(z.object({ runId: z.string(), count: z.number().int() })),
  approximated: z.boolean(),
  warnings: z.array(z.string()),
});
export type Pbo = z.infer<typeof pboSchema>;
/** Max runs per PBO request (backend MAX_PBO_RUNS). */
export const MAX_PBO_RUNS = 20;
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
  /** Slippage for stop exits only (0–0.1); omitted = slippagePct. */
  stopSlippagePct?: number;
  /** fixed = shortBorrowPctPerDay; funding = the perpetual's real funding history. */
  shortCarryModel?: "fixed" | "funding";
  /** All symbols on one shared balance, like the live loop (default: equal slice each). */
  portfolioMode?: boolean;
  /** Portfolio mode only: cap on the same-side open risk, fraction of the balance (0.015 = 1.5%). */
  maxSameSideRiskPct?: number;
  /** Regime candles per step (10–5000); omitted = the live window. Research variant V1 uses 1000. */
  regimeLookback?: number;
  walkForward?: { testWindowDays: number };
  /** Overrides for GET /strategies params; only changed ones need to be sent. */
  strategyParams?: Record<string, number>;
  /**
   * Also store the run's candidate ledger (every triggered setup, accepted or rejected, with its
   * shadow outcome). Observability only: trades and metrics are identical either way.
   */
  recordCandidates?: boolean;
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
