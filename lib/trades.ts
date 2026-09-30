import { CANDLE_INTERVALS, INTERVAL_MS, type CandleInterval } from "@/lib/schemas/market";
import type { Trade } from "@/lib/schemas/trade";

export const EXIT_REASON_LABELS: Record<string, string> = {
  TP: "Alvo (TP)",
  SL: "Stop loss",
  TRAILING: "Trailing stop",
  SIGNAL: "Sinal de saída",
  MANUAL: "Manual",
  KILL_SWITCH: "Kill switch",
};

export function exitReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "—";
  return EXIT_REASON_LABELS[reason] ?? reason;
}

/** Closed: exit − entry. Open: now − entry. */
export function tradeDurationMs(trade: Pick<Trade, "entryTime" | "exitTime">, now: number): number {
  const end = trade.exitTime ? new Date(trade.exitTime).getTime() : now;
  return end - new Date(trade.entryTime).getTime();
}

/** Prices shown with enough decimals for both BTC (60 000) and small caps (0,0001). */
export function priceDigits(v: number): number {
  const abs = Math.abs(v);
  return abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
}

// ---------------------------------------------------------------------------------------------
// Period filter (applies to entryTime on the backend)

export const PERIOD_PRESETS = [
  { key: "all", label: "Tudo" },
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "custom", label: "Personalizado" },
] as const;
export type PeriodKey = (typeof PERIOD_PRESETS)[number]["key"];

/**
 * Resolves a period to ISO bounds. Relative presets are rounded down to the minute so query
 * keys stay stable between renders; custom dates (yyyy-mm-dd) are whole local days.
 */
export function periodRange(
  period: PeriodKey,
  custom: { from?: string; to?: string },
  now = Date.now(),
): { from?: string; to?: string } {
  const minute = Math.floor(now / 60_000) * 60_000;
  const daysAgo = (d: number) => new Date(minute - d * 86_400_000).toISOString();
  switch (period) {
    case "all":
      return {};
    case "today": {
      const d = new Date(now);
      return { from: new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString() };
    }
    case "7d":
      return { from: daysAgo(7) };
    case "30d":
      return { from: daysAgo(30) };
    case "90d":
      return { from: daysAgo(90) };
    case "custom":
      return {
        from: custom.from ? localDayStart(custom.from).toISOString() : undefined,
        to: custom.to ? new Date(localDayStart(custom.to).getTime() + 86_400_000 - 1).toISOString() : undefined,
      };
  }
}

function localDayStart(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ---------------------------------------------------------------------------------------------
// Candle window around a trade

/** Backend/Binance cap per request. */
const MAX_CANDLES = 1000;
/** Auto interval aims for about this many candles on screen. */
const TARGET_CANDLES = 240;
/** Intervals offered for trade charts (1M is too coarse, and its length varies). */
export const TRADE_CHART_INTERVALS = CANDLE_INTERVALS.filter((i) => i !== "1M");

export function autoInterval(spanMs: number): CandleInterval {
  return TRADE_CHART_INTERVALS.find((i) => spanMs / INTERVAL_MS[i] <= TARGET_CANDLES) ?? "1w";
}

export interface CandleWindow {
  interval: CandleInterval;
  startTime: number;
  endTime: number;
  limit: number;
  /** True when the chosen interval can't cover the whole trade within MAX_CANDLES. */
  truncated: boolean;
}

/**
 * The trade's lifetime plus context on both sides (half the trade span, at least 30 candles),
 * never past `now`. Bounds are aligned to the interval so the query key is stable.
 */
export function tradeCandleWindow(
  trade: Pick<Trade, "entryTime" | "exitTime">,
  now: number,
  interval?: CandleInterval,
): CandleWindow {
  const entry = new Date(trade.entryTime).getTime();
  const exit = trade.exitTime ? new Date(trade.exitTime).getTime() : now;
  const span = Math.max(exit - entry, 60_000);
  const iv = interval ?? autoInterval(span * 2);
  const ivMs = INTERVAL_MS[iv];
  const pad = Math.max(span / 2, 30 * ivMs);

  const align = (t: number) => Math.floor(t / ivMs) * ivMs;
  const startTime = align(entry - pad);
  let endTime = align(Math.min(exit + pad, now));
  let truncated = false;
  if ((endTime - startTime) / ivMs + 1 > MAX_CANDLES) {
    endTime = startTime + (MAX_CANDLES - 1) * ivMs;
    truncated = true;
  }
  const limit = Math.min(MAX_CANDLES, Math.floor((endTime - startTime) / ivMs) + 1);
  return { interval: iv, startTime, endTime, limit, truncated };
}
