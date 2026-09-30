import { formatDuration, formatFraction, formatNumber, formatSignedMoney, formatSignedPercent, MINUS } from "@/lib/format";
import type { GroupedMetric, MetricsSummary, Mode } from "@/lib/schemas";

/** Below this many closed trades, differences between modes can easily be chance. */
export const SMALL_SAMPLE = 30;

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/**
 * Fills the 24 hours (or 7 weekdays) so empty buckets show as gaps, not as missing columns.
 * Backend keys: hour "0"–"23"; weekday "1" (domingo) – "7" (sábado).
 */
export function fillBuckets(items: GroupedMetric[], kind: "hour" | "weekday") {
  const byKey = new Map(items.map((i) => [Number(i.key), i]));
  const keys = kind === "hour" ? Array.from({ length: 24 }, (_, h) => h) : [1, 2, 3, 4, 5, 6, 7];
  return keys.map((k) => {
    const item = byKey.get(k);
    return {
      label: kind === "hour" ? `${String(k).padStart(2, "0")}h` : WEEKDAY_LABELS[k - 1],
      value: item?.totalPnl ?? 0,
      tradeCount: item?.tradeCount ?? 0,
      winRate: item?.winRate,
      profitFactor: item?.profitFactor,
    };
  });
}

/**
 * The backend returns 0 for profit factor / payoff when there are no losses (division by zero).
 * With wins and no losses the honest value is "∞".
 */
export function formatRatio(value: number, s: Pick<MetricsSummary, "winCount" | "lossCount" | "tradeCount">): string {
  if (s.tradeCount === 0) return "—";
  if (s.lossCount === 0 && s.winCount > 0) return "∞";
  return formatNumber(value, 2);
}

export function formatGroupedProfitFactor(g: Pick<GroupedMetric, "profitFactor" | "winRate" | "tradeCount">): string {
  if (g.tradeCount === 0) return "—";
  if (g.winRate === 1) return "∞";
  return formatNumber(g.profitFactor, 2);
}

// ---------------------------------------------------------------------------------------------
// Backtest vs paper vs live

export type ComparisonMetricKey =
  | "tradeCount"
  | "winRate"
  | "avgReturnPct"
  | "profitFactor"
  | "payoffRatio"
  | "expectancy"
  | "sharpe"
  | "sortino"
  | "maxLosingStreak"
  | "avgHoldTimeMs"
  | "totalPnl";

interface MetricDef {
  key: ComparisonMetricKey;
  label: string;
  help: string;
  format: (s: MetricsSummary) => string;
  /** Returns a short description when the value diverges a lot from the backtest, else null. */
  divergence?: (live: MetricsSummary, backtest: MetricsSummary) => string | null;
}

const pp = (diff: number) => `${diff > 0 ? "+" : MINUS}${formatNumber(Math.abs(diff), 1)} p.p.`;
const rel = (a: number, b: number) => (b === 0 ? null : (a - b) / Math.abs(b));
const relText = (r: number) => `${r > 0 ? "+" : MINUS}${formatNumber(Math.abs(r) * 100, 0)}%`;

/** Relative change beyond `threshold`, as text; null when comparable or undefined. */
function relDivergence(a: number, b: number, threshold: number): string | null {
  const r = rel(a, b);
  return r !== null && Math.abs(r) > threshold ? `${relText(r)} vs backtest` : null;
}

export const COMPARISON_METRICS: MetricDef[] = [
  {
    key: "tradeCount",
    label: "Trades fechadas",
    help: "Tamanho da amostra. Com poucas trades, qualquer diferença pode ser acaso.",
    format: (s) => formatNumber(s.tradeCount, 0),
  },
  {
    key: "winRate",
    label: "Win rate",
    help: "Fração de trades com lucro.",
    format: (s) => (s.tradeCount ? formatFraction(s.winRate, 1) : "—"),
    divergence: (l, b) => {
      const diff = (l.winRate - b.winRate) * 100;
      return Math.abs(diff) >= 10 ? `${pp(diff)} vs backtest` : null;
    },
  },
  {
    key: "avgReturnPct",
    label: "Retorno médio por trade",
    help: "Média do PnL % de cada trade. Não depende do tamanho da posição, por isso é a melhor base de comparação entre modos. Uma queda aqui costuma indicar slippage, taxas ou overfitting.",
    format: (s) => (s.tradeCount && s.avgReturnPct != null ? formatSignedPercent(s.avgReturnPct) : "—"),
    divergence: (l, b) => {
      if (l.avgReturnPct == null || b.avgReturnPct == null) return null;
      if (Math.sign(l.avgReturnPct) !== Math.sign(b.avgReturnPct) && Math.abs(l.avgReturnPct - b.avgReturnPct) >= 0.1) {
        return "sinal oposto ao backtest";
      }
      const diff = l.avgReturnPct - b.avgReturnPct;
      return Math.abs(diff) >= 0.2 && Math.abs(diff) > Math.abs(b.avgReturnPct) * 0.5 ? `${pp(diff)} vs backtest` : null;
    },
  },
  {
    key: "profitFactor",
    label: "Profit factor",
    help: "Lucro bruto ÷ prejuízo bruto. Acima de 1 = ganhou mais do que perdeu.",
    format: (s) => formatRatio(s.profitFactor, s),
    divergence: (l, b) => (l.lossCount && b.lossCount ? relDivergence(l.profitFactor, b.profitFactor, 0.3) : null),
  },
  {
    key: "payoffRatio",
    label: "Payoff",
    help: "Ganho médio ÷ perda média (em módulo).",
    format: (s) => formatRatio(s.payoffRatio, s),
    divergence: (l, b) => (l.lossCount && b.lossCount ? relDivergence(l.payoffRatio, b.payoffRatio, 0.3) : null),
  },
  {
    key: "expectancy",
    label: "Expectância",
    help: "PnL médio por trade, em USDT. Depende do tamanho da posição, por isso não é comparado automaticamente.",
    format: (s) => (s.tradeCount ? formatSignedMoney(s.expectancy) : "—"),
  },
  {
    key: "sharpe",
    label: "Sharpe (por trade)",
    help: "Retorno médio ÷ desvio-padrão dos retornos por trade. Não é anualizado.",
    format: (s) => (s.tradeCount > 1 ? formatNumber(s.sharpe, 2) : "—"),
    divergence: (l, b) => (l.tradeCount > 1 && b.tradeCount > 1 ? relDivergence(l.sharpe, b.sharpe, 0.5) : null),
  },
  {
    key: "sortino",
    label: "Sortino (por trade)",
    help: "Como o Sharpe, mas só penaliza a oscilação para baixo. Não é anualizado.",
    format: (s) => (s.tradeCount > 1 ? formatNumber(s.sortino, 2) : "—"),
  },
  {
    key: "maxLosingStreak",
    label: "Maior sequência de perdas",
    help: "Maior número de trades perdedoras seguidas.",
    format: (s) => (s.tradeCount ? formatNumber(s.maxLosingStreak, 0) : "—"),
    divergence: (l, b) => (l.maxLosingStreak >= b.maxLosingStreak + 3 ? `+${l.maxLosingStreak - b.maxLosingStreak} vs backtest` : null),
  },
  {
    key: "avgHoldTimeMs",
    label: "Tempo médio em posição",
    help: "Da entrada à saída, na média.",
    format: (s) => (s.tradeCount ? formatDuration(s.avgHoldTimeMs) : "—"),
    divergence: (l, b) => relDivergence(l.avgHoldTimeMs, b.avgHoldTimeMs, 0.5),
  },
  {
    key: "totalPnl",
    label: "PnL total",
    help: "Soma do PnL das trades fechadas. Depende do período e do tamanho das posições.",
    format: (s) => (s.tradeCount ? formatSignedMoney(s.totalPnl) : "—"),
  },
];

export interface ComparisonCell {
  text: string;
  /** Divergence vs the backtest column, when large. */
  divergence: string | null;
}

/**
 * Builds the comparison grid. Divergences are only computed when both columns have trades;
 * `smallSample` marks columns whose differences are more likely noise.
 */
export function buildComparison(columns: Array<{ mode: Mode; summary: MetricsSummary }>) {
  const backtest = columns.find((c) => c.mode === "BACKTEST")?.summary;
  const rows = COMPARISON_METRICS.map((m) => ({
    ...m,
    cells: columns.map(({ mode, summary }): ComparisonCell => {
      const comparable = mode !== "BACKTEST" && backtest && backtest.tradeCount > 0 && summary.tradeCount > 0;
      return { text: m.format(summary), divergence: comparable && m.divergence ? m.divergence(summary, backtest) : null };
    }),
  }));
  const flags = rows.flatMap((r) => r.cells.map((c) => c.divergence)).filter(Boolean).length;
  return {
    rows,
    flags,
    smallSample: columns.map((c) => c.summary.tradeCount > 0 && c.summary.tradeCount < SMALL_SAMPLE),
  };
}
