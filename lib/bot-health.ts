import type { BotStatus } from "@/lib/schemas";

export type LoopHealth =
  | { state: "disabled" }
  | { state: "starting" }
  | { state: "ok"; lagMs: number }
  | { state: "stale"; lagMs: number; limitMs: number };

/** Never alarm below this, so a slow tick (network) on a short poll interval isn't flagged. */
const MIN_STALE_MS = 2 * 60_000;
/** Ticks allowed to be missed before the loop is considered stopped. */
const MISSED_TICKS = 3;

/**
 * Whether the polling loop is alive. The backend's verdict (`worker`, derived from the heartbeat
 * the worker persists) wins when present; older backends fall back to the in-memory lastPollAt.
 * lastCycleAt is never used: it only moves when a new candle closes (once per timeframe).
 */
export function loopHealth(
  status: Pick<BotStatus, "executionEnabled" | "lastPollAt" | "pollIntervalSeconds"> & Partial<Pick<BotStatus, "worker">>,
  now: number,
): LoopHealth {
  const w = status.worker;
  if (w) {
    if (w.state === "DISABLED") return { state: "disabled" };
    if (w.state === "STARTING") return { state: "starting" };
    const lagMs = w.lastHeartbeatAt ? now - new Date(w.lastHeartbeatAt).getTime() : Number.POSITIVE_INFINITY;
    if (w.state === "OFFLINE") return { state: "stale", lagMs, limitMs: w.heartbeatTimeoutSeconds * 1000 };
    return { state: "ok", lagMs: Math.max(0, lagMs) };
  }
  if (!status.executionEnabled) return { state: "disabled" };
  if (!status.lastPollAt) return { state: "starting" };
  const lagMs = now - new Date(status.lastPollAt).getTime();
  const limitMs = Math.max(MISSED_TICKS * status.pollIntervalSeconds * 1000, MIN_STALE_MS);
  return lagMs > limitMs ? { state: "stale", lagMs, limitMs } : { state: "ok", lagMs };
}

export const PAUSE_REASON_LABELS: Record<string, string> = {
  MANUAL: "Pausa manual",
  KILL_SWITCH: "Kill switch acionado",
  DAILY_LOSS_LIMIT: "Limite de perda diária atingido",
  CONSECUTIVE_STOPS_LIMIT: "Limite de stops consecutivos atingido",
};

export function pauseReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Motivo não informado";
  return PAUSE_REASON_LABELS[reason] ?? reason;
}

/** Labels for RuntimeStatusService actions (HOLD | ENTER_LONG | ENTER_SHORT | EXIT | SKIP). */
export const SIGNAL_ACTION_LABELS: Record<string, string> = {
  HOLD: "Sem entrada",
  ENTER_LONG: "Entrada long",
  ENTER_SHORT: "Entrada short",
  EXIT: "Saída",
  SKIP: "Sem avaliação",
};
