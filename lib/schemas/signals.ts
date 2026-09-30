import { z } from "zod";
import { isoDate, modeSchema, objectId, opt, type Mode } from "./common";

/** risk.interface RejectReason. */
export const REJECT_REASON_LABELS: Record<string, string> = {
  BOT_PAUSED: "Operações pausadas",
  RECONCILIATION_FAILED: "Reconciliação com a corretora falhou",
  SHORT_NOT_SUPPORTED: "Short não suportado (Binance Spot não vende a descoberto)",
  DAILY_LOSS_LIMIT: "Limite de perda diária",
  CONSECUTIVE_STOPS_LIMIT: "Limite de stops consecutivos",
  MAX_OPEN_POSITIONS: "Máximo de posições abertas",
  MISSING_STOP_LOSS: "Sinal sem stop loss",
  INVALID_STOP_DISTANCE: "Stop inválido (distância ou lado errado da entrada)",
  INVALID_TAKE_PROFIT: "Take profit do lado errado da entrada",
  MAX_EXPOSURE_EXCEEDED: "Exposição máxima excedida",
  RR_TOO_LOW: "Risco/retorno abaixo do mínimo",
  LOW_LIQUIDITY: "Liquidez baixa",
  SPREAD_TOO_WIDE: "Spread largo demais",
  LOT_SIZE_TOO_SMALL: "Quantidade abaixo do lote mínimo",
  MIN_NOTIONAL_NOT_MET: "Valor abaixo do mínimo da corretora",
};

/** signals collection — GET /signals. One row per entry signal evaluated by risk. */
export const signalRecordSchema = z.object({
  _id: objectId,
  strategy: z.string(),
  symbol: z.string(),
  /** ENTER_LONG | ENTER_SHORT (entries are what risk evaluates). */
  signal: z.string(),
  /** Strategy explanation; paper/live only, absent on older rows and backtests. */
  reason: opt(z.string()),
  price: opt(z.number()),
  indicators: z.record(z.string(), z.number().nullable()).default({}),
  candleTime: isoDate,
  approved: z.boolean(),
  rejectReason: opt(z.string()),
  mode: modeSchema,
  runId: opt(z.string()),
});
export type SignalRecord = z.infer<typeof signalRecordSchema>;

export const signalsPageSchema = z.object({
  items: z.array(signalRecordSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type SignalsPage = z.infer<typeof signalsPageSchema>;

/** GetSignalsQueryDto. */
export interface SignalsQuery {
  mode?: Mode;
  symbol?: string;
  strategy?: string;
  approved?: boolean;
  runId?: string;
  from?: string;
  to?: string;
  page?: number;
  /** 1–200. */
  limit?: number;
}
