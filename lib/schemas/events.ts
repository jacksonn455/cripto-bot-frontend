import { z } from "zod";
import { modeSchema } from "./common";

/**
 * SSE payloads from EventsService (GET /events/stream). Nest sends each one as a named SSE
 * event (`event: trade.opened`), so the client must listen per type, not via `onmessage`.
 */
export const sseEventSchemas = {
  "trade.opened": z.object({
    symbol: z.string(),
    side: z.string(),
    qty: z.number(),
    entryPrice: z.number(),
    stopLoss: z.number().nullish(),
    mode: modeSchema,
  }),
  "trade.closed": z.object({
    symbol: z.string(),
    pnl: z.number(),
    reason: z.string(),
    mode: modeSchema,
  }),
  "bot.paused": z.object({ reason: z.string() }),
  "bot.resumed": z.object({}),
  "alert.critical": z.object({ message: z.string() }),
  /** Entry signal evaluated by risk (approved or vetoed). */
  "signal.recorded": z.object({
    symbol: z.string(),
    strategy: z.string(),
    signal: z.string(),
    reason: z.string().nullish(),
    price: z.number().nullish(),
    approved: z.boolean(),
    rejectReason: z.string().nullish(),
    mode: modeSchema,
    candleTime: z.iso.datetime({ offset: true }),
  }),
  /** Execution loop error (deduplicated by the backend). */
  "bot.error": z.object({ message: z.string(), at: z.iso.datetime({ offset: true }).nullish(), mode: modeSchema.nullish() }),
  /** New closed candle evaluated for a symbol: HOLD / ENTER_LONG / EXIT / SKIP (hourly on 1h). */
  "bot.cycle": z.object({
    symbol: z.string(),
    action: z.string(),
    reason: z.string(),
    at: z.iso.datetime({ offset: true }),
    mode: modeSchema.nullish(),
    /** Close time of the evaluated candle (absent on older events). */
    candleTime: z.iso.datetime({ offset: true }).nullish(),
    price: z.number().nullish(),
    indicators: z.record(z.string(), z.number().nullable()).nullish(),
    /** Same candle evaluated again after a backend restart. */
    reevaluation: z.boolean().nullish(),
  }),
  "backtest.completed": z.object({
    runId: z.string(),
    strategy: z.string(),
    symbols: z.array(z.string()),
    timeframe: z.string(),
    tradeCount: z.number().int(),
    totalPnl: z.number(),
  }),
} as const;

export type SseEventType = keyof typeof sseEventSchemas;
export const SSE_EVENT_TYPES = Object.keys(sseEventSchemas) as SseEventType[];

/** GET /events/recent — the same events (and ids) the stream sent, newest first, last 30 days. */
export const storedEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
  at: z.iso.datetime({ offset: true }),
});
export type StoredEvent = z.infer<typeof storedEventSchema>;
export const storedEventsSchema = z.array(storedEventSchema);
