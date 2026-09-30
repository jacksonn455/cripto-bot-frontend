import type { Trade } from "@/lib/schemas";

/**
 * Display-only estimate of an open position's PnL at the last known price, before fees.
 * Not used for any decision; the backend computes the real PnL when the trade closes.
 */
export function unrealizedPnl(trade: Pick<Trade, "side" | "entryPrice" | "qty">, lastPrice: number) {
  const direction = trade.side === "LONG" ? 1 : -1;
  const pnl = (lastPrice - trade.entryPrice) * trade.qty * direction;
  const pnlPct = ((lastPrice - trade.entryPrice) / trade.entryPrice) * 100 * direction;
  return { pnl, pnlPct };
}

export function startOfLocalDay(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
