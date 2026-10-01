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
  /** Whether the strategy also opens shorts (param allowShort = 1). */
  allowShort: boolean;
}

export const DEFAULT_RANGES: StrategyRanges = { emaFast: 20, emaSlow: 50, emaRegime: 200, rsiMin: 45, rsiMax: 70, allowShort: false };

/** The long RSI band reflected around 50, as the backend does for shorts ([45,70] -> [30,55]). */
export function shortRsiBand(r: Pick<StrategyRanges, "rsiMin" | "rsiMax">): [number, number] {
  return [100 - r.rsiMax, 100 - r.rsiMin];
}

/** Builds the ranges from GET /strategies params (falls back to the defaults). */
export function rangesFromParams(params: Array<{ key: string; value: number }> | undefined): StrategyRanges {
  const value = (k: Exclude<keyof StrategyRanges, "allowShort">) => params?.find((p) => p.key === k)?.value ?? DEFAULT_RANGES[k];
  return {
    emaFast: value("emaFast"),
    emaSlow: value("emaSlow"),
    emaRegime: value("emaRegime"),
    rsiMin: value("rsiMin"),
    rsiMax: value("rsiMax"),
    allowShort: params?.find((p) => p.key === "allowShort")?.value === 1,
  };
}

const NO_CROSS = /sem cruzamento/i;
const NO_REGIME = /regime n[aã]o est[aá] em alta/i;
const RSI_OUT = /RSI fora da faixa/i;
const NO_HISTORY = /not enough candle history|evaluation failed/i;
const OPEN_POSITION = /Posi[cç][aã]o aberta/i;
// Short-side fragments (TrendRegimeStrategy.explainNoShortEntry), used when allowShort=1 and the regime isn't up.
const SHORT_CONTEXT = /(^|;)\s*short:/i;
const SHORT_NO_CROSS = /short:\s*sem cruzamento/i;
const SHORT_RSI_OUT = /short:\s*RSI fora da faixa/i;
const REGIME_UNDEFINED = /regime indefinido/i;

export const NO_ENTRY_TOOLTIP = "O Krypto avaliou e não encontrou motivo para entrar (comprar ou vender). Isso é normal.";

/** Translates the strategy's technical reason into plain Portuguese. Unknown text passes through. */
export function translateReason(reason: string, ranges: StrategyRanges = DEFAULT_RANGES): string {
  if (NO_HISTORY.test(reason)) return "Ainda sem histórico suficiente de candles para calcular os indicadores";
  if (/^sem condicao de entrada$/i.test(reason.trim())) return "Nenhuma condição de entrada";
  const parts = reason.split(";").map((p) => p.trim()).filter(Boolean);
  const translated = parts.map((p) => {
    if (SHORT_NO_CROSS.test(p)) return "Short: média rápida ainda não cruzou para baixo da lenta";
    if (SHORT_RSI_OUT.test(p)) {
      const [min, max] = shortRsiBand(ranges);
      return `Short: RSI fora da faixa de ${min} a ${max}`;
    }
    if (REGIME_UNDEFINED.test(p)) return "Tendência maior indefinida (preço colado na média de regime)";
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
  /** Which side the conditions refer to: short when the backend evaluated the short rules. */
  side: "long" | "short";
  /** null = unknown (e.g. no evaluation yet, or a position is open). */
  cross: boolean | null;
  regime: boolean | null;
  rsi: boolean | null;
}

/** The strategy's own verdicts, when the backend sends them (evaluation_snapshots). */
export interface StructuredConditions {
  side?: "LONG" | "SHORT" | null;
  conditions?: Array<{ key: "cross" | "regime" | "rsi"; ok: boolean }> | null;
}

/**
 * Which entry conditions passed in the last evaluation. Uses the strategy's structured verdicts
 * when present; older snapshots only have the reason text, parsed with the fragments above.
 */
export function conditionsFrom(action: string | undefined, reason: string | undefined, structured?: StructuredConditions): Conditions {
  const isShort =
    structured?.side != null
      ? structured.side === "SHORT"
      : action === "ENTER_SHORT" || (reason !== undefined && (SHORT_CONTEXT.test(reason) || REGIME_UNDEFINED.test(reason)));
  const side = isShort ? "short" : "long";
  const none = { cross: null, regime: null, rsi: null };
  if (!action || reason === undefined) return { kind: "unknown", side, ...none };
  if (action === "ENTER_LONG" || action === "ENTER_SHORT") return { kind: "entry", side, cross: true, regime: true, rsi: true };
  if (action === "EXIT") return { kind: "exit", side, ...none };
  if (action === "SKIP" || NO_HISTORY.test(reason)) return { kind: "no-data", side, ...none };
  if (OPEN_POSITION.test(reason)) return { kind: "position", side, ...none };
  const verdict = (key: "cross" | "regime" | "rsi") => structured?.conditions?.find((c) => c.key === key)?.ok;
  if (structured?.conditions?.length) {
    return { kind: "waiting", side, cross: verdict("cross") ?? null, regime: verdict("regime") ?? null, rsi: verdict("rsi") ?? null };
  }
  return {
    kind: "waiting",
    side,
    cross: !NO_CROSS.test(reason),
    regime: !NO_REGIME.test(reason) && !REGIME_UNDEFINED.test(reason),
    rsi: !RSI_OUT.test(reason),
  };
}

const LABEL = { cross: "o cruzamento das médias", regime: "a tendência maior de alta", rsi: "o RSI entrar na faixa" } as const;
const SHORT_LABEL = { cross: "o cruzamento das médias para baixo", regime: "uma tendência maior definida", rsi: "o RSI entrar na faixa do short" } as const;
const OK_LABEL = { cross: "Cruzamento", regime: "Tendência", rsi: "RSI" } as const;

/** One-line summary, e.g. "O bot está funcionando e esperando o cruzamento. Tendência e RSI estão ok." */
export function summarize(c: Conditions): string {
  switch (c.kind) {
    case "unknown":
      return "Ainda não há avaliação registrada para este símbolo.";
    case "no-data":
      return "O Krypto está funcionando, mas ainda não tem candles suficientes para avaliar este símbolo.";
    case "position":
      return "Há uma posição aberta: agora o Krypto espera o sinal de saída, não de entrada.";
    case "exit":
      return "O último candle deu sinal de saída da posição.";
    case "entry":
      return c.side === "short"
        ? "Todas as condições de short foram atendidas no último candle: sinal de venda a descoberto enviado ao gerenciador de risco."
        : "Todas as condições foram atendidas no último candle: sinal de compra enviado ao gerenciador de risco.";
    case "waiting": {
      const keys = ["cross", "regime", "rsi"] as const;
      const missing = keys.filter((k) => c[k] === false);
      const ok = keys.filter((k) => c[k] === true).map((k) => OK_LABEL[k]);
      const labels = c.side === "short" ? SHORT_LABEL : LABEL;
      const wait = missing.map((k) => labels[k]);
      const waitText = wait.length > 1 ? `${wait.slice(0, -1).join(", ")} e ${wait.at(-1)}` : wait[0];
      const okText = ok.length === 0 ? "" : ok.length === 1 ? ` ${ok[0]} está ok.` : ` ${ok.slice(0, -1).join(", ")} e ${ok.at(-1)} estão ok.`;
      const prefix = c.side === "short" ? "A tendência maior não está de alta, então o Krypto avalia o short: está" : "O Krypto está funcionando e";
      return `${prefix} esperando ${waitText ?? "uma condição de entrada"}.${okText}`;
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
