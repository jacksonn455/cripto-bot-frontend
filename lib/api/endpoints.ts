import {
  agentRunResultSchema,
  aiStatusSchema,
  type AgentKey,
  type AgentRunInput,
  backtestRunResponseSchema,
  backtestRunSchema,
  backtestRunsPageSchema,
  balancesSchema,
  botStateSchema,
  botStatusSchema,
  candidateFunnelSchema,
  pauseImpactsSchema,
  type CandidateFilter,
  byHourSchema,
  candlesSchema,
  compareModesSchema,
  equityCurveSchema,
  fundingPageSchema,
  groupedMetricPageSchema,
  killSwitchResultSchema,
  metricsSummarySchema,
  pboSchema,
  runComparisonSchema,
  strategiesSchema,
  tradeSchema,
  tradesPageSchema,
  healthSchema,
  signalsPageSchema,
  storedEventsSchema,
  type CandlesQuery,
  type FundingQuery,
  type SignalsQuery,
  type EquityCurveFilter,
  type ReportsFilter,
  type RunBacktestInput,
  type TradesQuery,
} from "@/lib/schemas";
import { apiGet, apiPost, buildUrl, type QueryParams } from "./client";

type Paging = { page?: number; limit?: number };

/** One function per backend endpoint used by the dashboard. */
export const api = {
  bot: {
    status: (signal?: AbortSignal) => apiGet(botStatusSchema, "bot/status", undefined, signal),
    pause: (reason?: string) => apiPost(botStateSchema, "bot/pause", reason ? { reason } : {}),
    resume: () => apiPost(botStateSchema, "bot/resume"),
    killSwitch: () => apiPost(killSwitchResultSchema, "bot/kill-switch"),
  },
  /** Candidate ledger (observability only). Older backends: 404 → callers show "indisponível". */
  candidates: {
    funnel: (f: CandidateFilter, signal?: AbortSignal) =>
      apiGet(candidateFunnelSchema, "candidates/funnel", f as QueryParams, signal),
    /** Pause episodes with the entries each one blocked. */
    pauses: (signal?: AbortSignal) => apiGet(pauseImpactsSchema, "candidates/pauses", undefined, signal),
  },
  trades: {
    list: (query: TradesQuery, signal?: AbortSignal) => apiGet(tradesPageSchema, "trades", query as QueryParams, signal),
    get: (id: string, signal?: AbortSignal) => apiGet(tradeSchema, `trades/${encodeURIComponent(id)}`, undefined, signal),
    /** Plain link (download handled by the browser). */
    exportCsvUrl: (query: Omit<TradesQuery, "page" | "limit">) => buildUrl("trades/export.csv", query as QueryParams),
  },
  reports: {
    summary: (f: ReportsFilter, signal?: AbortSignal) => apiGet(metricsSummarySchema, "reports/summary", f as QueryParams, signal),
    equityCurve: (f: EquityCurveFilter, signal?: AbortSignal) =>
      apiGet(equityCurveSchema, "reports/equity-curve", f as QueryParams, signal),
    byStrategy: (f: ReportsFilter & Paging, signal?: AbortSignal) =>
      apiGet(groupedMetricPageSchema, "reports/by-strategy", f as QueryParams, signal),
    bySymbol: (f: ReportsFilter & Paging, signal?: AbortSignal) =>
      apiGet(groupedMetricPageSchema, "reports/by-symbol", f as QueryParams, signal),
    /** `tz`: IANA zone for the hour/day buckets (the browser's, normally). */
    byHour: (f: ReportsFilter & { tz?: string }, signal?: AbortSignal) =>
      apiGet(byHourSchema, "reports/by-hour", f as QueryParams, signal),
    /** Always BACKTEST, PAPER and LIVE; `runId` picks the backtest run, from/to apply to PAPER/LIVE. */
    compareModes: (f: Omit<ReportsFilter, "mode">, signal?: AbortSignal) =>
      apiGet(compareModesSchema, "reports/compare-modes", f as QueryParams, signal),
  },
  backtest: {
    run: (input: RunBacktestInput) => apiPost(backtestRunResponseSchema, "backtest/run", input),
    /** Newest first; limit 1–200. */
    runs: (q: { strategy?: string; page?: number; limit?: number } = {}, signal?: AbortSignal) =>
      apiGet(backtestRunsPageSchema, "backtest/runs", q, signal),
    getRun: (runId: string, signal?: AbortSignal) =>
      apiGet(backtestRunSchema, `backtest/runs/${encodeURIComponent(runId)}`, undefined, signal),
    /** Baseline vs variant, walk-forward window by window. */
    compare: (baseline: string, variant: string, signal?: AbortSignal) =>
      apiGet(runComparisonSchema, "backtest/compare", { baseline, variant }, signal),
    /** Probability of Backtest Overfitting over 2–20 runs with the same walk-forward windows. */
    pbo: (runIds: string[], signal?: AbortSignal) => apiGet(pboSchema, "backtest/pbo", { runIds: runIds.join(",") }, signal),
  },
  strategies: {
    list: (signal?: AbortSignal) => apiGet(strategiesSchema, "strategies", undefined, signal),
  },
  funding: {
    /** Latest scan; limit 1–200 (default 20 on the backend). */
    ranking: (q: FundingQuery, signal?: AbortSignal) => apiGet(fundingPageSchema, "funding/ranking", { ...q }, signal),
  },
  exchange: {
    balance: (signal?: AbortSignal) => apiGet(balancesSchema, "exchange/balance", undefined, signal),
    candles: (q: CandlesQuery, signal?: AbortSignal) => apiGet(candlesSchema, "exchange/candles", { ...q }, signal),
  },
  /** Older backends don't have this endpoint: callers show "indisponível" on 404. */
  signals: {
    list: (q: SignalsQuery, signal?: AbortSignal) => apiGet(signalsPageSchema, "signals", q as QueryParams, signal),
  },
  events: {
    streamUrl: () => buildUrl("events/stream"),
    /** limit 1–500; `before` = an event id, to page back. */
    recent: (q: { limit?: number; before?: string }, signal?: AbortSignal) =>
      apiGet(storedEventsSchema, "events/recent", q, signal),
  },
  health: (signal?: AbortSignal) => apiGet(healthSchema, "health", undefined, signal),
  /** Advisory OpenAI agents (read-only tools; the backend never acts on their answers). */
  ai: {
    status: (signal?: AbortSignal) => apiGet(aiStatusSchema, "ai/status", undefined, signal),
    run: (agent: AgentKey, input: AgentRunInput) => apiPost(agentRunResultSchema, `ai/agents/${encodeURIComponent(agent)}/run`, input),
  },
};
