import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import type { CandlesQuery, EquityCurveFilter, ReportsFilter, TradesQuery } from "@/lib/schemas";

/** Polling intervals. TanStack Query already pauses refetchInterval while the tab is hidden. */
export const POLL_MS = {
  botStatus: 10_000,
  openPositions: 10_000,
  prices: 15_000,
  default: 30_000,
} as const;

/**
 * Hierarchical keys: invalidating a prefix (e.g. ["trades"]) refreshes every query below it.
 * The live-events provider relies on these prefixes.
 */
export const queryKeys = {
  botStatus: ["bot", "status"] as const,
  trades: (q: TradesQuery) => ["trades", q] as const,
  summary: (f: ReportsFilter) => ["reports", "summary", f] as const,
  equityCurve: (f: EquityCurveFilter) => ["equity", f] as const,
  lastPrice: (symbol: string) => ["prices", symbol] as const,
  trade: (id: string) => ["trades", "detail", id] as const,
  candles: (q: CandlesQuery) => ["candles", q] as const,
};

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        refetchIntervalInBackground: false,
        // 4xx and schema mismatches won't fix themselves; offline gets one quick retry.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && (error.isClientError || error.kind === "validation")) return false;
          return failureCount < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}
