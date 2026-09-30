import { z } from "zod";
import { isoDate, modeSchema, objectId, opt } from "./common";

export const TRADE_SIDES = ["LONG", "SHORT"] as const;
export const TRADE_STATUSES = ["OPEN", "CLOSED"] as const;
export const EXIT_REASONS = ["TP", "SL", "TRAILING", "SIGNAL", "MANUAL", "KILL_SWITCH"] as const;
export const TRADE_SORT_FIELDS = ["entryTime", "exitTime", "pnl", "pnlPct"] as const;

/** trades collection (Trade schema, timestamps: true). */
export const tradeSchema = z.object({
  _id: objectId,
  symbol: z.string(),
  side: z.enum(TRADE_SIDES),
  strategy: z.string(),
  mode: modeSchema,
  runId: opt(z.string()),
  entryPrice: z.number(),
  exitPrice: opt(z.number()),
  qty: z.number(),
  entryTime: isoDate,
  exitTime: opt(isoDate),
  fees: z.number(),
  pnl: opt(z.number()),
  /** Percent, already multiplied by 100 (2.5 = +2,5%). */
  pnlPct: opt(z.number()),
  stopLoss: z.number(),
  takeProfit: opt(z.number()),
  status: z.enum(TRADE_STATUSES),
  exitReason: opt(z.enum(EXIT_REASONS)),
  /** Candle timeframe the strategy traded on; absent on older trades. */
  timeframe: opt(z.string()),
  /** Strategy's explanation of the entry (paper/live, newer backends). */
  entryReason: opt(z.string()),
  maxAdverseExcursion: opt(z.number()),
  maxFavorableExcursion: opt(z.number()),
  /** true only on trades created by the backend's dev seed script (fake data). */
  isSeed: opt(z.boolean()),
  createdAt: opt(isoDate),
  updatedAt: opt(isoDate),
});
export type Trade = z.infer<typeof tradeSchema>;

/** TradesService.PaginatedResult<Trade> — GET /trades. */
export const tradesPageSchema = z.object({
  items: z.array(tradeSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type TradesPage = z.infer<typeof tradesPageSchema>;

/** GetTradesQueryDto. The backend rejects unknown query params (forbidNonWhitelisted). */
export interface TradesQuery {
  mode?: z.infer<typeof modeSchema>;
  symbol?: string;
  strategy?: string;
  side?: (typeof TRADE_SIDES)[number];
  status?: (typeof TRADE_STATUSES)[number];
  /** Backtest execution id. */
  runId?: string;
  /** true = only seed trades, false = only real ones. */
  isSeed?: boolean;
  /** ISO, inclusive bound on entryTime. */
  from?: string;
  to?: string;
  page?: number;
  /** 1–200. */
  limit?: number;
  sortBy?: (typeof TRADE_SORT_FIELDS)[number];
  sortOrder?: "asc" | "desc";
}
