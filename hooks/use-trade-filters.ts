"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useDataMode } from "@/hooks/use-data-mode";
import { TRADE_SORT_FIELDS, type TradesQuery } from "@/lib/schemas";
import { PERIOD_PRESETS, periodRange, type PeriodKey } from "@/lib/trades";

export const PAGE_SIZES = [20, 50, 100] as const;

export interface TradeFilters {
  symbol: string;
  strategy: string;
  side: "" | "LONG" | "SHORT";
  status: "" | "OPEN" | "CLOSED";
  period: PeriodKey;
  /** yyyy-mm-dd, only for period=custom. */
  customFrom: string;
  customTo: string;
  page: number;
  limit: number;
  sortBy: (typeof TRADE_SORT_FIELDS)[number];
  sortOrder: "asc" | "desc";
}

const DEFAULTS: TradeFilters = {
  symbol: "",
  strategy: "",
  side: "",
  status: "",
  period: "all",
  customFrom: "",
  customTo: "",
  page: 1,
  limit: 20,
  sortBy: "entryTime",
  sortOrder: "desc",
};

const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Table filters live in the URL, so a filtered view can be reloaded, shared or navigated back to. */
export function useTradeFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { mode } = useDataMode();

  const filters = useMemo<TradeFilters>(() => {
    const page = Number(params.get("page"));
    const limit = Number(params.get("limit"));
    return {
      symbol: params.get("symbol") ?? "",
      strategy: params.get("strategy") ?? "",
      side: oneOf(params.get("side"), ["", "LONG", "SHORT"] as const, ""),
      status: oneOf(params.get("status"), ["", "OPEN", "CLOSED"] as const, ""),
      period: oneOf(params.get("period"), PERIOD_PRESETS.map((p) => p.key), "all"),
      customFrom: params.get("from") ?? "",
      customTo: params.get("to") ?? "",
      page: Number.isInteger(page) && page > 0 ? page : 1,
      limit: (PAGE_SIZES as readonly number[]).includes(limit) ? limit : DEFAULTS.limit,
      sortBy: oneOf(params.get("sortBy"), TRADE_SORT_FIELDS, "entryTime"),
      sortOrder: oneOf(params.get("sortOrder"), ["asc", "desc"] as const, "desc"),
    };
  }, [params]);

  /** Any change other than page/limit/sort jumps back to page 1. */
  const update = useCallback(
    (patch: Partial<TradeFilters>) => {
      const next = { ...filters, ...patch };
      if (!("page" in patch)) next.page = 1;
      const search = new URLSearchParams();
      const set = (key: string, value: string | number, def: string | number) => {
        if (value !== def && value !== "") search.set(key, String(value));
      };
      set("symbol", next.symbol.trim().toUpperCase(), "");
      set("strategy", next.strategy.trim(), "");
      set("side", next.side, "");
      set("status", next.status, "");
      set("period", next.period, "all");
      if (next.period === "custom") {
        set("from", next.customFrom, "");
        set("to", next.customTo, "");
      }
      set("page", next.page, 1);
      set("limit", next.limit, DEFAULTS.limit);
      set("sortBy", next.sortBy, DEFAULTS.sortBy);
      set("sortOrder", next.sortOrder, DEFAULTS.sortOrder);
      const qs = search.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  const hasFilters = Boolean(filters.symbol || filters.strategy || filters.side || filters.status || filters.period !== "all");

  /** The backend query (without page/limit/sort for the CSV export). */
  const query: TradesQuery = useMemo(() => {
    const range = periodRange(filters.period, { from: filters.customFrom, to: filters.customTo });
    return {
      mode,
      symbol: filters.symbol || undefined,
      strategy: filters.strategy || undefined,
      side: filters.side || undefined,
      status: filters.status || undefined,
      ...range,
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };
    // periodRange depends on "now" only at minute resolution; recomputed whenever filters change.
  }, [filters, mode]);

  return { filters, update, reset, hasFilters, query };
}
