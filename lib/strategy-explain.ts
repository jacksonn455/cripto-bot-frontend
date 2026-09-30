/**
 * Plain-language view of the TrendRegimeStrategy decisions, for people who don't read EMAs.
 * Display only: it reads what the strategy already reported (its reason text and indicator
 * snapshot) and never decides anything. The reason fragments below mirror
 * TrendRegimeStrategy.explainNoEntry() in the backend; if they change there, update them here.
 */

export interface StrategyRanges {
  emaFast: number;
  emaSlow: number;
  emaRegime: number;
  rsiMin: number;
  rsiMax: number;
}

export const DEFAULT_RANGES: StrategyRanges = { emaFast: 20, emaSlow: 50, emaRegime: 200, rsiMin: 45, rsiMax: 70 };

/** Builds the ranges from GET /strategies params (falls back to the defaults). */
export function rangesFromParams(params: Array<{ key: string; value: number }> | undefined): StrategyRanges {
  const value = (k: keyof StrategyRanges) => params?.find((p) => p.key === k)?.value ?? DEFAULT_RANGES[k];
  return { emaFast: value("emaFast"), emaSlow: value("emaSlow"), emaRegime: value("emaRegime"), rsiMin: value("rsiMin"), rsiMax: value("rsiMax") };
}

const NO_CROSS = /sem cruzamento/i;
const NO_REGIME = /regime n[aã]o est[aá] em alta/i;
const RSI_OUT = /RSI fora da faixa/i;
const NO_HISTORY = /not enough candle history|evaluation failed/i;
const OPEN_POSITION = /Posi[cç][aã]o aberta/i;

export const NO_ENTRY_TOOLTIP = "O bot avaliou e não encontrou motivo para comprar. Isso é normal.";

/** Translates the strategy's technical reason into plain Portuguese. Unknown text passes through. */
export function translateReason(reason: string, ranges: StrategyRanges = DEFAULT_RANGES): string {
  if (NO_HISTORY.test(reason)) return "Ainda sem histórico suficiente de candles para calcular os indicadores";
  if (/^sem condicao de entrada$/i.test(reason.trim())) return "Nenhuma condição de entrada";
  const parts = reason.split(";").map((p) => p.trim()).filter(Boolean);
  const translated = parts.map((p) => {
    if (NO_CROSS.test(p)) return "Média rápida ainda não cruzou a lenta";
    if (NO_REGIME.test(p)) return "Tendência maior não está de alta";
    if (RSI_OUT.test(p)) return `RSI fora da faixa de ${ranges.rsiMin} a ${ranges.rsiMax}`;
    return p;
  });
  return translated.join(" · ");
}

export type DecisionKind = "waiting" | "entry" | "exit" | "position" | "no-data" | "unknown";

export interface Conditions {
  kind: DecisionKind;
  /** null = unknown (e.g. no evaluation yet, or a position is open). */
  cross: boolean | null;
  regime: boolean | null;
  rsi: boolean | null;
}

/** Which entry conditions passed, from the action + reason of the last evaluation. */
export function conditionsFrom(action: string | undefined, reason: string | undefined): Conditions {
  if (!action || reason === undefined) return { kind: "unknown", cross: null, regime: null, rsi: null };
  if (action === "ENTER_LONG" || action === "ENTER_SHORT") return { kind: "entry", cross: true, regime: true, rsi: true };
  if (action === "EXIT") return { kind: "exit", cross: null, regime: null, rsi: null };
  if (action === "SKIP" || NO_HISTORY.test(reason)) return { kind: "no-data", cross: null, regime: null, rsi: null };
  if (OPEN_POSITION.test(reason)) return { kind: "position", cross: null, regime: null, rsi: null };
  return { kind: "waiting", cross: !NO_CROSS.test(reason), regime: !NO_REGIME.test(reason), rsi: !RSI_OUT.test(reason) };
}

const LABEL = { cross: "o cruzamento das médias", regime: "a tendência maior de alta", rsi: "o RSI entrar na faixa" } as const;
const OK_LABEL = { cross: "Cruzamento", regime: "Tendência", rsi: "RSI" } as const;

/** One-line summary, e.g. "O bot está funcionando e esperando o cruzamento. Tendência e RSI estão ok." */
export function summarize(c: Conditions): string {
  switch (c.kind) {
    case "unknown":
      return "Ainda não há avaliação deste símbolo desde que o backend iniciou.";
    case "no-data":
      return "O bot está funcionando, mas ainda não tem candles suficientes para avaliar este símbolo.";
    case "position":
      return "Há uma posição aberta: agora o bot espera o sinal de saída, não de entrada.";
    case "exit":
      return "O último candle deu sinal de saída da posição.";
    case "entry":
      return "Todas as condições foram atendidas no último candle: sinal de compra enviado ao gerenciador de risco.";
    case "waiting": {
      const keys = ["cross", "regime", "rsi"] as const;
      const missing = keys.filter((k) => c[k] === false);
      const ok = keys.filter((k) => c[k] === true).map((k) => OK_LABEL[k]);
      const wait = missing.map((k) => LABEL[k]);
      const waitText = wait.length > 1 ? `${wait.slice(0, -1).join(", ")} e ${wait.at(-1)}` : wait[0];
      const okText = ok.length === 0 ? "" : ok.length === 1 ? ` ${ok[0]} está ok.` : ` ${ok.slice(0, -1).join(", ")} e ${ok.at(-1)} estão ok.`;
      return `O bot está funcionando e esperando ${waitText ?? "uma condição de entrada"}.${okText}`;
    }
  }
}

const hhmm = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const ddmm = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/** Candle close times end in :59:59.999; people read the round boundary ("22:00"). */
export function candleEnd(closeTimeMs: number): number {
  return Math.round(closeTimeMs / 60_000) * 60_000;
}

/** "22:00" today, otherwise "29/09 às 22:00". */
export function formatWhen(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date(now).toDateString();
  return sameDay ? hhmm.format(d) : `${ddmm.format(d)} às ${hhmm.format(d)}`;
}

/** "de 21:00 a 22:00" for the candle that closed at closeTime. */
export function formatCandleRange(closeTimeMs: number, timeframeMs: number, now = Date.now()): string {
  const end = candleEnd(closeTimeMs);
  return `de ${formatWhen(end - timeframeMs, now)} a ${hhmm.format(end)}`;
}

/** Epoch ms of the next candle close for a timeframe (candles align to UTC multiples). */
export function nextCandleClose(now: number, timeframeMs: number): number {
  return Math.floor(now / timeframeMs) * timeframeMs + timeframeMs;
}

/** "MM:SS" (or "H:MM:SS" beyond an hour). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
