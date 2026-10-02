import { z } from "zod";
import { isoDate, type Mode } from "./common";

/** Backend CandidateStage, in funnel order: strategy gates, then risk (the pause is its first check), then execution. */
export const CANDIDATE_STAGE_LABELS: Record<string, { label: string; hint: string }> = {
  SIDE: { label: "Lado habilitado", hint: "Short desligado (TREND_ALLOW_SHORT) — o candidato short é só registrado." },
  REGIME: { label: "Regime (EMA200 4h)", hint: "Preço do lado errado da EMA200 no timeframe de regime." },
  RSI: { label: "RSI na faixa", hint: "RSI fora da faixa de entrada." },
  ADX: { label: "ADX mínimo", hint: "Tendência fraca (filtro ADX ligado)." },
  INDICATORS: { label: "Indicadores", hint: "Sem ATR para calcular o stop." },
  PAUSE: { label: "Bot pausado", hint: "Vetado com BOT_PAUSED: o bot estava pausado até um POST /bot/resume." },
  RISK: { label: "Gerenciador de risco", hint: "Demais vetos do risco (stops seguidos, perda diária, exposição…)." },
  EXECUTION: { label: "Execução", hint: "Aprovado, mas a ordem de entrada falhou." },
};

/** Shadow outcomes of a group of candidates: what they would have done if traded (backend ShadowStats). */
export const shadowStatsSchema = z.object({
  measured: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  /** Still running at the end of the data, or not computed yet. */
  pending: z.number().int(),
  avgR: z.number().nullable(),
  sumR: z.number(),
});
export type ShadowStats = z.infer<typeof shadowStatsSchema>;

export const funnelStepSchema = z.object({
  step: z.string(),
  entering: z.number().int(),
  rejected: z.number().int(),
  remaining: z.number().int(),
  rejectedShadow: shadowStatsSchema,
});
export type FunnelStep = z.infer<typeof funnelStepSchema>;

/** GET /candidates/funnel. */
export const candidateFunnelSchema = z.object({
  total: z.number().int(),
  bySide: z.object({ LONG: z.number().int(), SHORT: z.number().int() }),
  bySetup: z.record(z.string(), z.number().int()),
  strategyAccepted: z.number().int(),
  steps: z.array(funnelStepSchema),
  entered: z.number().int(),
  riskRejectReasons: z.record(z.string(), z.number().int()),
  paused: z.object({
    candidatesWhileBotPaused: z.number().int(),
    blockedByPause: z.number().int(),
    wouldTradeIfResumed: z.number().int(),
    blockedShadow: shadowStatsSchema,
  }),
  shadow: z.object({
    entered: shadowStatsSchema,
    rejected: shadowStatsSchema,
    rejectedWinners: z.number().int(),
    rejectedLosers: z.number().int(),
  }),
});
export type CandidateFunnel = z.infer<typeof candidateFunnelSchema>;

/** GET /candidates/pauses — one row per pause episode, newest first. */
export const pauseImpactSchema = z.object({
  pausedAt: isoDate,
  resumedAt: isoDate.nullable(),
  durationMs: z.number(),
  reason: z.string(),
  additionalReasons: z.array(z.object({ reason: z.string(), at: isoDate })).default([]),
  candidates: z.number().int(),
  blockedByPause: z.number().int(),
  wouldTradeIfResumed: z.number().int(),
  blockedShadow: shadowStatsSchema,
});
export type PauseImpact = z.infer<typeof pauseImpactSchema>;
export const pauseImpactsSchema = z.array(pauseImpactSchema);

/** CandidateFilterQueryDto. */
export interface CandidateFilter {
  mode?: Mode;
  runId?: string;
  symbol?: string;
  side?: "LONG" | "SHORT";
  setupType?: "EMA_CROSS" | "PULLBACK";
  from?: string;
  to?: string;
}
