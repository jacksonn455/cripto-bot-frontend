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
 * Whether the polling loop is alive, based on its heartbeat (lastPollAt). lastCycleAt is not
 * used: it only moves when a new candle closes, i.e. once per strategy timeframe.
 */
export function loopHealth(
  status: Pick<BotStatus, "executionEnabled" | "lastPollAt" | "pollIntervalSeconds">,
  now: number,
): LoopHealth {
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
