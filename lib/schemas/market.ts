import { z } from "zod";
import { isoDate } from "./common";

/** FundingService.FundingRanking — GET /funding/ranking (read-only). */
export const fundingRankingItemSchema = z.object({
  symbol: z.string(),
  /** Fraction per 8h funding interval. */
  rate: z.number(),
  annualizedRatePct: z.number(),
  nextFundingTime: isoDate,
  timestamp: isoDate,
});
export type FundingRankingItem = z.infer<typeof fundingRankingItemSchema>;

/** GET /funding/ranking — one page of the latest scan + whole-scan stats + the bot's symbols. */
export const fundingPageSchema = z.object({
  items: z.array(fundingRankingItemSchema),
  /** Matches after `search`, before paging. */
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  scannedAt: isoDate.nullable(),
  stats: z
    .object({
      count: z.number().int(),
      positive: z.number().int(),
      negative: z.number().int(),
      zero: z.number().int(),
      medianAnnualizedPct: z.number(),
      averageAnnualizedPct: z.number(),
      extremeCount: z.number().int(),
      extremeThresholdPct: z.number(),
      baselineRate: z.number(),
    })
    .nullable(),
  watch: z.array(fundingRankingItemSchema),
});
export type FundingPage = z.infer<typeof fundingPageSchema>;

export const FUNDING_ORDERS = ["desc", "asc", "abs"] as const;
export type FundingOrder = (typeof FUNDING_ORDERS)[number];
/** GET /funding/ranking query. Always the latest scan. */
export interface FundingQuery {
  page?: number;
  /** 1–200. */
  limit?: number;
  /** Symbol substring, letters/digits only. */
  search?: string;
  /** desc = highest, asc = lowest/negative, abs = largest magnitude. */
  order?: FundingOrder;
}

/** exchange Balance — GET /exchange/balance. */
export const balanceSchema = z.object({
  asset: z.string(),
  free: z.number(),
  locked: z.number(),
});
export type Balance = z.infer<typeof balanceSchema>;
export const balancesSchema = z.array(balanceSchema);

export const CANDLE_INTERVALS = [
  "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M",
] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

/** exchange Candle — GET /exchange/candles. Times are epoch ms. */
export const candleSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  openTime: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  closeTime: z.number(),
  quoteVolume: z.number(),
  trades: z.number(),
  isClosed: z.boolean(),
});
export type Candle = z.infer<typeof candleSchema>;
export const candlesSchema = z.array(candleSchema);

/** GetCandlesQueryDto. At most `limit` (1–1000) candles; without start/end, the most recent ones. */
export interface CandlesQuery {
  symbol: string;
  interval: CandleInterval;
  limit?: number;
  /** Epoch ms, inclusive (candle openTime). */
  startTime?: number;
  endTime?: number;
}

/** Interval lengths in ms (1M approximated as 30 days, only used to size ranges). */
export const INTERVAL_MS: Record<CandleInterval, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "6h": 21_600_000,
  "8h": 28_800_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
  "3d": 259_200_000,
  "1w": 604_800_000,
  "1M": 2_592_000_000,
};
