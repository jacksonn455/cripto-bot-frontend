import type { LiveEvent } from "@/components/live/live-events-provider";
import { formatDateTime, formatDuration, formatNumber, formatSignedMoney, formatSignedPercent } from "@/lib/format";
import type { Mode } from "@/lib/schemas";
import { REJECT_REASON_LABELS } from "@/lib/schemas/signals";
import { exitReasonLabel } from "@/lib/trades";
import { pauseReasonLabel, SIGNAL_ACTION_LABELS } from "@/lib/bot-health";
import { candleEnd, DEFAULT_RANGES, NO_ENTRY_TOOLTIP, translateReason, type StrategyRanges } from "@/lib/strategy-explain";

/** Feed categories the user can filter by. */
export const FEED_KINDS = [
  { key: "entry", label: "Entradas" },
  { key: "exit", label: "Saídas" },
  { key: "veto", label: "Vetos de risco" },
  { key: "signal", label: "Sinais aprovados" },
  { key: "cycle", label: "Avaliações (sem entrada)" },
  { key: "backtest", label: "Backtests" },
  { key: "bot", label: "Pausa/retomada" },
  { key: "worker", label: "Worker (início/queda)" },
  { key: "error", label: "Erros" },
  { key: "alert", label: "Alertas" },
] as const;
export type FeedKind = (typeof FEED_KINDS)[number]["key"];

export type FeedTone = "neutral" | "profit" | "loss" | "warning" | "critical";

export interface FeedItem {
  kind: FeedKind;
  tone: FeedTone;
  title: string;
  detail?: string;
  /** Small print with the numbers behind the decision (EMAs, RSI). */
  metrics?: string;
  /** Explanation shown on hover. */
  hint?: string;
  mode?: Mode;
  at: number;
  /** Strategy evaluation (bot.cycle) details, used to group and spot re-evaluations. */
  cycle?: { symbol: string; action: string; reason: string; candleTime?: string | null; reevaluation?: boolean | null };
  /** Outage confirmed by the backend's persisted heartbeat (worker.started with a downtime), epoch ms. */
  downtime?: { from: number; to: number };
}

const price = (p: number) => formatNumber(p, p >= 100 ? 2 : p >= 1 ? 4 : 6);

/** Turns a raw SSE event into what the feed shows. Pure, so it is unit-tested. */
export function describeEvent(e: LiveEvent, ranges: StrategyRanges = DEFAULT_RANGES): FeedItem {
  const at = e.receivedAt;
  switch (e.type) {
    case "trade.opened":
      return {
        kind: "entry",
        tone: "neutral",
        title: `Entrada ${e.data.side} em ${e.data.symbol}`,
        detail: [
          `${formatNumber(e.data.qty, 6)} @ ${price(e.data.entryPrice)}${e.data.stopLoss != null ? ` · stop ${price(e.data.stopLoss)}` : ""}`,
          e.data.timeframe,
          e.data.signalReason,
        ]
          .filter(Boolean)
          .join(" · "),
        mode: e.data.mode,
        at,
      };
    case "trade.closed":
      return {
        kind: "exit",
        tone: e.data.pnl > 0 ? "profit" : e.data.pnl < 0 ? "loss" : "neutral",
        title: `${e.data.side ? `${e.data.side} fechado` : "Saída"} em ${e.data.symbol}: ${formatSignedMoney(e.data.pnl)}${
          e.data.pnlPct != null ? ` (${formatSignedPercent(e.data.pnlPct)})` : ""
        }`,
        detail: [
          exitReasonLabel(e.data.reason),
          e.data.entryPrice != null && e.data.exitPrice != null ? `${price(e.data.entryPrice)} → ${price(e.data.exitPrice)}` : null,
          e.data.reasonDetail,
        ]
          .filter(Boolean)
          .join(" · "),
        mode: e.data.mode,
        at,
      };
    case "signal.recorded":
      return e.data.approved
        ? {
            kind: "signal",
            tone: "neutral",
            title: `Sinal ${e.data.signal} aprovado em ${e.data.symbol}`,
            detail: e.data.reason ?? undefined,
            mode: e.data.mode,
            at,
          }
        : {
            kind: "veto",
            tone: "warning",
            title: `Sinal ${e.data.signal} vetado em ${e.data.symbol}`,
            detail: [REJECT_REASON_LABELS[e.data.rejectReason ?? ""] ?? e.data.rejectReason, e.data.reason].filter(Boolean).join(" · "),
            mode: e.data.mode,
            at,
          };
    case "bot.paused":
      return { kind: "bot", tone: "warning", title: "Operações pausadas", detail: pauseReasonLabel(e.data.reason), at };
    case "bot.resumed":
      return { kind: "bot", tone: "neutral", title: "Operações retomadas", at };
    case "bot.error":
      return { kind: "error", tone: "loss", title: "Erro no loop de execução", detail: e.data.message, mode: e.data.mode ?? undefined, at };
    case "bot.cycle": {
      const ind = e.data.indicators ?? {};
      const metrics = [
        ind.emaFast != null && `EMA${ranges.emaFast} ${price(ind.emaFast)}`,
        ind.emaSlow != null && `EMA${ranges.emaSlow} ${price(ind.emaSlow)}`,
        ind.rsi != null && `RSI ${formatNumber(ind.rsi, 1)}`,
      ].filter(Boolean);
      const hold = e.data.action === "HOLD";
      return {
        kind: "cycle",
        tone: "neutral",
        title: `${e.data.symbol}: ${hold ? "sem entrada" : (SIGNAL_ACTION_LABELS[e.data.action] ?? e.data.action).toLowerCase()}`,
        detail: translateReason(e.data.reason, ranges),
        metrics: metrics.length ? metrics.join(" · ") : undefined,
        hint: hold ? NO_ENTRY_TOOLTIP : undefined,
        mode: e.data.mode ?? undefined,
        at,
        cycle: {
          symbol: e.data.symbol,
          action: e.data.action,
          reason: e.data.reason,
          candleTime: e.data.candleTime,
          reevaluation: e.data.reevaluation,
        },
      };
    }
    case "backtest.completed":
      return {
        kind: "backtest",
        tone: e.data.totalPnl > 0 ? "profit" : e.data.totalPnl < 0 ? "loss" : "neutral",
        title: `Backtest concluído: ${e.data.symbols.join(", ")} · ${e.data.timeframe}`,
        detail: `${e.data.tradeCount} trade(s) · PnL ${formatSignedMoney(e.data.totalPnl)}`,
        mode: "BACKTEST",
        at,
      };
    case "worker.started": {
      const d = e.data.downtime;
      if (!d) return { kind: "worker", tone: "neutral", title: "Krypto worker iniciado", detail: "Início normal (deploy/reinício rápido).", mode: e.data.mode ?? undefined, at };
      const from = Date.parse(d.from);
      const to = Date.parse(d.to);
      return {
        kind: "worker",
        tone: "warning",
        title: `Krypto worker voltou após ${formatDuration(to - from)} offline`,
        detail: [
          `Último heartbeat antes da queda: ${new Date(from).toLocaleString("pt-BR")}`,
          d.previousStopReason ? `processo encerrado pela plataforma (${d.previousStopReason})` : "sem parada registrada (crash ou hibernação da instância)",
        ].join(" · "),
        mode: e.data.mode ?? undefined,
        at,
        downtime: { from, to },
      };
    }
    case "worker.gap": {
      const fmt = (iso: string) => formatDateTime(candleEnd(Date.parse(iso)));
      return {
        kind: "worker",
        tone: "warning",
        title: `${e.data.symbol}: ${e.data.missedCandles} candle(s) de ${e.data.timeframe} sem avaliação`,
        detail: `Fecharam enquanto o worker estava fora (${fmt(e.data.firstMissedCandleClose)} a ${fmt(e.data.lastMissedCandleClose)}). Só o último candle (${fmt(e.data.evaluatedCandleClose)}) foi avaliado; nenhum trade é aberto retroativamente.`,
        mode: e.data.mode ?? undefined,
        at,
      };
    }
    case "worker.stalled":
      return { kind: "worker", tone: "critical", title: "Loop de execução parado", detail: `Último ciclo às ${new Date(e.data.lastTickAt).toLocaleTimeString("pt-BR")}`, mode: e.data.mode ?? undefined, at };
    case "worker.resumed":
      return { kind: "worker", tone: "neutral", title: "Loop de execução retomado", mode: e.data.mode ?? undefined, at };
    case "alert.critical":
      return { kind: "alert", tone: "critical", title: "Alerta crítico", detail: e.data.message, at };
  }
}

// ---------------------------------------------------------------------------------------------
// Timeline: groups repetitive evaluations, folds restart re-evaluations, flags gaps.

/** Evaluations of the same symbol closer than this (without candle info) are restart repeats. */
const REEVALUATION_WINDOW_MS = 10 * 60_000;
/** With 1h candles, more than this without an evaluation means the bot wasn't running. */
export const GAP_THRESHOLD_MS = 70 * 60_000;

export type TimelineRow =
  | { type: "item"; item: FeedItem; reevaluation: boolean }
  | { type: "group"; key: string; items: FeedItem[]; flags: boolean[]; reevaluations: number }
  | { type: "gap"; key: string; symbol: string; from: number; to: number; downtime?: { from: number; to: number } };

/**
 * A cycle is a re-evaluation when the backend flagged it, when an older event already covered
 * the same symbol + candle, or (older events without candle info) when the same symbol got the
 * same decision within a few minutes — the loop only moves once per candle.
 */
export function markReevaluations(items: FeedItem[]): Set<FeedItem> {
  const result = new Set<FeedItem>();
  const asc = items.filter((i) => i.cycle).sort((a, b) => a.at - b.at);
  const seenCandles = new Set<string>();
  const lastBySymbol = new Map<string, FeedItem>();
  for (const item of asc) {
    const cy = item.cycle!;
    const prev = lastBySymbol.get(cy.symbol);
    const candleKey = cy.candleTime ? `${cy.symbol}|${cy.candleTime}` : null;
    const repeat =
      cy.reevaluation === true ||
      (candleKey !== null && seenCandles.has(candleKey)) ||
      (!cy.candleTime && prev !== undefined && prev.cycle!.reason === cy.reason && item.at - prev.at < REEVALUATION_WINDOW_MS);
    if (repeat) result.add(item);
    if (candleKey) seenCandles.add(candleKey);
    lastBySymbol.set(cy.symbol, item);
  }
  return result;
}

/** Periods with no evaluation of a symbol for longer than GAP_THRESHOLD_MS (within the loaded history). */
export function findGaps(items: FeedItem[]): Array<{ symbol: string; from: number; to: number }> {
  const bySymbol = new Map<string, number[]>();
  for (const i of items) if (i.cycle) bySymbol.set(i.cycle.symbol, [...(bySymbol.get(i.cycle.symbol) ?? []), i.at]);
  const gaps: Array<{ symbol: string; from: number; to: number }> = [];
  for (const [symbol, times] of bySymbol) {
    times.sort((a, b) => a - b);
    for (let k = 1; k < times.length; k++) {
      if (times[k] - times[k - 1] > GAP_THRESHOLD_MS) gaps.push({ symbol, from: times[k - 1], to: times[k] });
    }
  }
  return gaps;
}

/**
 * Newest first. Consecutive "sem entrada" evaluations of the same symbol and reason (other
 * evaluations may be interleaved) collapse into one expandable group; any other event or a gap
 * ends the run. Re-evaluations are hidden unless `showReevaluations`.
 */
export function buildTimeline(items: FeedItem[], opts: { showReevaluations: boolean }): { rows: TimelineRow[]; hiddenReevaluations: number } {
  const reevaluations = markReevaluations(items);
  const visible = opts.showReevaluations ? items : items.filter((i) => !reevaluations.has(i));
  // A gap the backend confirmed (worker.started reported a downtime overlapping it) is a real outage.
  const downtimes = items.flatMap((i) => (i.downtime ? [i.downtime] : []));
  const gaps = findGaps(items.filter((i) => !reevaluations.has(i))).map((g) => ({
    ...g,
    downtime: downtimes.find((d) => d.from < g.to && d.to > g.from),
  }));

  type Entry = { at: number; item?: FeedItem; gap?: (typeof gaps)[number] };
  // A gap sits just below the event that ended it.
  const entries: Entry[] = [...visible.map((item) => ({ at: item.at, item })), ...gaps.map((gap) => ({ at: gap.to - 0.5, gap }))];
  entries.sort((a, b) => b.at - a.at);

  const rows: TimelineRow[] = [];
  let block = new Map<string, FeedItem[]>();
  const flush = () => {
    for (const [key, group] of block) {
      if (group.length === 1) rows.push({ type: "item", item: group[0], reevaluation: reevaluations.has(group[0]) });
      else {
        const flags = group.map((g) => reevaluations.has(g));
        rows.push({ type: "group", key, items: group, flags, reevaluations: flags.filter(Boolean).length });
      }
    }
    block = new Map();
  };
  for (const e of entries) {
    if (e.gap) {
      flush();
      rows.push({ type: "gap", key: `gap|${e.gap.symbol}|${e.gap.from}`, ...e.gap });
      continue;
    }
    const item = e.item!;
    if (item.cycle && item.cycle.action === "HOLD") {
      const key = `${item.cycle.symbol}|${item.cycle.reason}|${item.at}`;
      const groupKey = [...block.keys()].find((k) => k.startsWith(`${item.cycle!.symbol}|${item.cycle!.reason}|`)) ?? key;
      block.set(groupKey, [...(block.get(groupKey) ?? []), item]);
      continue;
    }
    flush();
    rows.push({ type: "item", item, reevaluation: reevaluations.has(item) });
  }
  flush();
  return { rows, hiddenReevaluations: opts.showReevaluations ? 0 : reevaluations.size };
}
