"use client";

import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/endpoints";
import { POLL_MS, queryKeys } from "@/lib/query";
import type {
  CandlesQuery,
  EquityCurveFilter,
  FundingQuery,
  Mode,
  ReportsFilter,
  SignalsQuery,
  TradesQuery,
} from "@/lib/schemas";

export function useTrades(query: TradesQuery, options: { refetchInterval?: number; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.trades(query),
    queryFn: ({ signal }) => api.trades.list(query, signal),
    placeholderData: keepPreviousData,
    refetchInterval: options.refetchInterval ?? POLL_MS.default,
    enabled: options.enabled,
  });
}

export function useSummary(filter: ReportsFilter, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.summary(filter),
    queryFn: ({ signal }) => api.reports.summary(filter, signal),
    refetchInterval: POLL_MS.default,
    enabled: options.enabled,
  });
}

export function useEquityCurve(filter: EquityCurveFilter, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.equityCurve(filter),
    queryFn: ({ signal }) => api.reports.equityCurve(filter, signal),
    refetchInterval: POLL_MS.default,
    placeholderData: keepPreviousData,
    enabled: options.enabled,
  });
}

export function useTrade(id: string) {
  return useQuery({
    queryKey: queryKeys.trade(id),
    queryFn: ({ signal }) => api.trades.get(id, signal),
    // Open trades change (exit, stop); closed ones never do.
    refetchInterval: (q) => (q.state.data?.status === "OPEN" ? POLL_MS.openPositions : false),
  });
}

export function useCandles(query: CandlesQuery, options: { enabled?: boolean; refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: queryKeys.candles(query),
    queryFn: ({ signal }) => api.exchange.candles(query, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: options.enabled,
    refetchInterval: options.refetchInterval ?? false,
  });
}

/**
 * Symbols and strategies that have closed trades in a mode, for filter suggestions. There is
 * no "distinct values" endpoint; the grouped reports are the closest existing source.
 */
export function useFilterSuggestions(mode: Mode) {
  const symbols = useQuery({
    queryKey: ["reports", "bySymbol", { mode, limit: 200 }],
    queryFn: ({ signal }) => api.reports.bySymbol({ mode, limit: 200 }, signal),
    staleTime: 5 * 60_000,
  });
  const strategies = useQuery({
    queryKey: ["reports", "byStrategy", { mode, limit: 200 }],
    queryFn: ({ signal }) => api.reports.byStrategy({ mode, limit: 200 }, signal),
    staleTime: 5 * 60_000,
  });
  return {
    symbols: symbols.data?.items.map((i) => i.key).sort() ?? [],
    strategies: strategies.data?.items.map((i) => i.key).sort() ?? [],
  };
}

const BROWSER_TZ = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

export function useGroupedReport(by: "strategy" | "symbol", filter: ReportsFilter) {
  const f = { ...filter, limit: 200 };
  return useQuery({
    queryKey: ["reports", by === "strategy" ? "byStrategy" : "bySymbol", f],
    queryFn: ({ signal }) => (by === "strategy" ? api.reports.byStrategy(f, signal) : api.reports.bySymbol(f, signal)),
    refetchInterval: POLL_MS.default,
    placeholderData: keepPreviousData,
  });
}

/** Buckets in the browser's time zone, so "14h" is 14h on the viewer's clock. */
export function useByHour(filter: ReportsFilter) {
  const f = { ...filter, tz: BROWSER_TZ };
  return useQuery({
    queryKey: ["reports", "byHour", f],
    queryFn: ({ signal }) => api.reports.byHour(f, signal),
    refetchInterval: POLL_MS.default,
    placeholderData: keepPreviousData,
  });
}

export function useCompareModes(filter: Omit<ReportsFilter, "mode">) {
  return useQuery({
    queryKey: ["reports", "compareModes", filter],
    queryFn: ({ signal }) => api.reports.compareModes(filter, signal),
    refetchInterval: POLL_MS.default,
    placeholderData: keepPreviousData,
  });
}

/** The backend scans funding hourly; a 5-min poll is plenty. */
export function useFundingRanking(q: FundingQuery) {
  return useQuery({
    queryKey: ["funding", q],
    queryFn: ({ signal }) => api.funding.ranking(q, signal),
    refetchInterval: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useSignals(q: SignalsQuery) {
  return useQuery({
    queryKey: ["signals", q],
    queryFn: ({ signal }) => api.signals.list(q, signal),
    refetchInterval: POLL_MS.default,
    placeholderData: keepPreviousData,
  });
}

/** Backend dependencies (Mongo required, Redis fail-open cache). */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => api.health(signal),
    refetchInterval: POLL_MS.default,
  });
}

/** Strategy parameters and what the live loop runs; changes only on backend restart. */
export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: ({ signal }) => api.strategies.list(signal),
    staleTime: 10 * 60_000,
  });
}

export function useBacktestRun(runId: string) {
  return useQuery({
    queryKey: ["backtest", "run", runId],
    queryFn: ({ signal }) => api.backtest.getRun(runId, signal),
    staleTime: 60_000,
  });
}

/** The latest runs (up to 200) as a plain list, for run pickers and overfitting banners. */
export function useBacktestRuns() {
  return useQuery({
    queryKey: ["backtest", "runs", "all"],
    queryFn: ({ signal }) => api.backtest.runs({ page: 1, limit: 200 }, signal),
    select: (page) => page.items,
    staleTime: 60_000,
  });
}

/** One page of runs, for the run list. */
export function useBacktestRunsPage(q: { page: number; limit: number }) {
  return useQuery({
    queryKey: ["backtest", "runs", "page", q],
    queryFn: ({ signal }) => api.backtest.runs(q, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** Last 1m close per symbol, for display-only estimates (unrealized PnL). */
export function useLastPrices(symbols: string[]) {
  const unique = [...new Set(symbols)].sort();
  const results = useQueries({
    queries: unique.map((symbol) => ({
      queryKey: queryKeys.lastPrice(symbol),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.exchange.candles({ symbol, interval: "1m", limit: 1 }, signal),
      refetchInterval: POLL_MS.prices,
    })),
  });
  const prices = new Map<string, { price: number; at: number }>();
  results.forEach((r, i) => {
    const candle = r.data?.[r.data.length - 1];
    if (candle) prices.set(unique[i], { price: candle.close, at: candle.closeTime });
  });
  return prices;
}
