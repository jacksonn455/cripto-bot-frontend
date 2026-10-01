import { z } from "zod";
import { isoDate, opt } from "./common";

/** One entry rule as the strategy judged it (evaluation_snapshots in the backend). */
export const conditionResultSchema = z.object({
  key: z.enum(["cross", "regime", "rsi"]),
  ok: z.boolean(),
  value: z.number().nullable(),
  threshold: z.string(),
  message: z.string(),
});
export type ConditionResult = z.infer<typeof conditionResultSchema>;

/**
 * Backend SignalSnapshot: the latest persisted evaluation of a symbol (survives restarts).
 * `action` is HOLD | ENTER_LONG | ENTER_SHORT | EXIT | SKIP. Fields after `indicators` are absent
 * on older backends; the reason text is then the only source of the conditions.
 */
export const signalSnapshotSchema = z.object({
  action: z.string(),
  reason: z.string(),
  /** When the evaluation ran. */
  at: isoDate,
  /** Close time of the evaluated candle; absent when the strategy couldn't evaluate. */
  candleTime: opt(isoDate),
  price: opt(z.number()),
  /** The strategy's indicator snapshot: emaFast, emaSlow, rsi, atr, emaRegime. */
  indicators: opt(z.record(z.string(), z.number().nullable())),
  candleOpenTime: opt(isoDate),
  /** cycle = the loop's evaluation; reconciliation = informational re-run after a restart. */
  source: opt(z.enum(["cycle", "reconciliation"])),
  side: opt(z.enum(["LONG", "SHORT"])),
  conditions: opt(z.array(conditionResultSchema)),
  decision: opt(z.object({ outcome: z.string(), reason: z.string() })),
});
export type SignalSnapshot = z.infer<typeof signalSnapshotSchema>;

/** WorkerHeartbeatService.WorkerStatus — derived by the backend from the heartbeat the worker persists. */
export const workerStatusSchema = z.object({
  state: z.enum(["ONLINE", "OFFLINE", "STARTING", "DISABLED"]),
  /** Why it is not ONLINE, e.g. "worker heartbeat expired". */
  reason: z.string().nullable(),
  instanceId: z.string().nullable(),
  startedAt: isoDate.nullable(),
  uptimeSeconds: z.number().nullable(),
  lastHeartbeatAt: isoDate.nullable(),
  lastEvaluationAt: isoDate.nullable(),
  nextEvaluationAt: isoDate.nullable(),
  lastErrorAt: isoDate.nullable(),
  lastError: z.string().nullable(),
  stoppedAt: isoDate.nullable(),
  stopReason: z.string().nullable(),
  heartbeatTimeoutSeconds: z.number(),
  /** Latest gap the worker found when it started (it was not running in between). */
  lastDowntime: z
    .object({
      from: isoDate,
      to: isoDate,
      durationSeconds: z.number(),
      lastEvaluationAt: isoDate.nullable(),
      previousStopReason: z.string().nullable(),
    })
    .nullable(),
});
export type WorkerStatus = z.infer<typeof workerStatusSchema>;

/** ControlService.BotStatus — GET /bot/status. The bot itself only runs PAPER or LIVE. */
export const botStatusSchema = z.object({
  mode: z.enum(["PAPER", "LIVE"]),
  paused: z.boolean(),
  pauseReason: opt(z.string()),
  lastReconciliationAt: opt(isoDate),
  lastReconciliationOk: z.boolean(),
  /** Last new closed candle evaluated — moves once per strategy timeframe (e.g. hourly on 1h). */
  lastCycleAt: isoDate.nullable(),
  /** Heartbeat of the polling loop — moves every pollIntervalSeconds while the loop is alive. */
  lastPollAt: isoDate.nullable(),
  executionEnabled: z.boolean(),
  pollIntervalSeconds: z.number().int().positive(),
  lastSignalBySymbol: z.record(z.string(), signalSnapshotSchema),
  /** Symbols whose last market-data fetch failed (until one succeeds). Absent on older backends. */
  symbolErrors: opt(z.record(z.string(), z.object({ message: z.string(), at: isoDate }))),
  openTrades: z.number().int(),
  /** Free balance of the quote asset (USDT) — not mark-to-market equity. 0 when the balance call fails. */
  equity: z.number(),
  lastError: z.string().nullable(),
  /** Absent on backends older than the persisted worker heartbeat. */
  worker: opt(workerStatusSchema),
});
export type BotStatus = z.infer<typeof botStatusSchema>;

/** BotState document — returned by POST /bot/pause and /bot/resume. */
export const botStateSchema = z.object({
  isPaused: z.boolean(),
  pauseReason: opt(z.string()),
  lastReconciliationAt: opt(isoDate),
  lastReconciliationOk: z.boolean(),
  updatedAt: isoDate,
});
export type BotState = z.infer<typeof botStateSchema>;

/** GET /health — Mongo is required; Redis is a fail-open cache (the app works without it). */
export const healthSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  uptimeSeconds: z.number(),
  mongo: z.object({ ok: z.boolean(), latencyMs: z.number().nullable() }),
  redis: z.object({ ok: z.boolean(), latencyMs: z.number().nullable(), status: z.string() }),
});
export type Health = z.infer<typeof healthSchema>;

/** ControlService.KillSwitchResult — POST /bot/kill-switch. */
export const killSwitchResultSchema = z.object({
  canceledOrders: z.number().int(),
  closedPositions: z.number().int(),
});
export type KillSwitchResult = z.infer<typeof killSwitchResultSchema>;
