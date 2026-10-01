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
    // Richer payload (tradeId, strategy, timeframe, signal reason) from newer backends.
    tradeId: z.string().nullish(),
    strategy: z.string().nullish(),
    timeframe: z.string().nullish(),
    signalReason: z.string().nullish(),
  }),
  "trade.closed": z.object({
    symbol: z.string(),
    pnl: z.number(),
    reason: z.string(),
    mode: modeSchema,
    tradeId: z.string().nullish(),
    side: z.string().nullish(),
    strategy: z.string().nullish(),
    timeframe: z.string().nullish(),
    qty: z.number().nullish(),
    entryPrice: z.number().nullish(),
    exitPrice: z.number().nullish(),
    pnlPct: z.number().nullish(),
    reasonDetail: z.string().nullish(),
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
  /** Worker process started; `downtime` = the gap since the previous run's last heartbeat (an outage). */
  "worker.started": z.object({
    instanceId: z.string(),
    startedAt: z.iso.datetime({ offset: true }),
    previousHeartbeatAt: z.iso.datetime({ offset: true }).nullish(),
    mode: modeSchema.nullish(),
    downtime: z
      .object({
        from: z.iso.datetime({ offset: true }),
        to: z.iso.datetime({ offset: true }),
        durationSeconds: z.number(),
        lastEvaluationAt: z.iso.datetime({ offset: true }).nullish(),
        previousStopReason: z.string().nullish(),
      })
      .nullish(),
  }),
  /** Candles that closed while the worker was down; only the latest one was evaluated (no retroactive trades). */
  "worker.gap": z.object({
    symbol: z.string(),
    mode: modeSchema.nullish(),
    timeframe: z.string(),
    missedCandles: z.number().int(),
    lastEvaluatedCandleClose: z.iso.datetime({ offset: true }),
    firstMissedCandleClose: z.iso.datetime({ offset: true }),
    lastMissedCandleClose: z.iso.datetime({ offset: true }),
    evaluatedCandleClose: z.iso.datetime({ offset: true }),
  }),
  /** The process is up but its execution loop stopped ticking. */
  "worker.stalled": z.object({ lastTickAt: z.iso.datetime({ offset: true }), detectedAt: z.iso.datetime({ offset: true }), mode: modeSchema.nullish() }),
  "worker.resumed": z.object({ stalledSince: z.iso.datetime({ offset: true }), resumedAt: z.iso.datetime({ offset: true }), mode: modeSchema.nullish() }),
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
