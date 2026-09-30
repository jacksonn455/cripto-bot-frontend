/**
 * Plain-language reading of a backtest result, for people who don't read trading metrics.
 * Display only: it restates numbers the backend computed (summary, buy-and-hold benchmark, costs,
 * walk-forward windows) and never feeds a decision.
 */
import { formatFraction, formatMoney, formatNumber, formatSignedMoney, formatSignedPercent } from "@/lib/format";
import type { BacktestRun } from "@/lib/schemas";

/** Fewer closed trades than this and any conclusion is mostly luck. */
export const MIN_TRADES = 30;
/** A drawdown deeper than this is hard to live through in real money. */
export const DEEP_DRAWDOWN = 0.2;
/** Walk-forward: at least this share of windows must be profitable to call it consistent. */
export const CONSISTENT_SHARE = 2 / 3;

export type FindingTone = "good" | "bad" | "warn" | "neutral";

export interface Finding {
  key: string;
  tone: FindingTone;
  title: string;
  text: string;
}

export type VerdictKind = "no-trades" | "inconclusive" | "loss" | "below-hold" | "unstable" | "promising";

export interface Verdict {
  kind: VerdictKind;
  tone: FindingTone;
  title: string;
  text: string;
}

export interface RunReading {
  /** Result over the initial balance, in percent. */
  returnPct: number;
  days: number;
  buyAndHoldPct: number | null;
  verdict: Verdict;
  findings: Finding[];
}

function initialBalanceOf(run: BacktestRun): number {
  const v = run.params.initialBalance;
  return typeof v === "number" && v > 0 ? v : 10_000;
}

/** Win rate needed to break even with this payoff (avg win ÷ avg loss). */
export function breakEvenWinRate(payoff: number): number {
  return payoff > 0 ? 1 / (1 + payoff) : 1;
}

export function readRun(run: BacktestRun): RunReading {
  const s = run.summary;
  const capital = initialBalanceOf(run);
  const returnPct = (s.totalPnl / capital) * 100;
  const days = Math.max(1, Math.round((Date.parse(run.to) - Date.parse(run.from)) / 86_400_000));
  const bh = run.benchmark?.buyAndHoldPct ?? null;
  const findings: Finding[] = [];

  // 1. Result
  findings.push({
    key: "result",
    tone: s.tradeCount === 0 ? "neutral" : s.totalPnl > 0 ? "good" : "bad",
    title: s.tradeCount === 0 ? "Nenhuma trade" : s.totalPnl > 0 ? "Deu lucro" : "Deu prejuízo",
    text:
      s.tradeCount === 0
        ? `Em ${days} dias a estratégia não encontrou nenhuma entrada. O saldo ficou parado.`
        : `${formatSignedPercent(returnPct)} sobre o saldo inicial (${formatSignedMoney(s.totalPnl)}) em ${days} dias.`,
  });

  // 2. Versus buy-and-hold
  if (bh === null) {
    findings.push({
      key: "hold",
      tone: "neutral",
      title: "Sem comparação com comprar e segurar",
      text: "Execução feita antes de o painel calcular essa comparação. Rode de novo para ver.",
    });
  } else {
    const better = returnPct > bh;
    findings.push({
      key: "hold",
      tone: better ? "good" : "bad",
      title: better ? "Melhor que só comprar e segurar" : "Pior que só comprar e segurar",
      text: `Se você só comprasse no início e vendesse no fim, teria ${formatSignedPercent(bh)}${
        better ? `; a estratégia fez ${formatNumber(returnPct - bh, 2)} p.p. a mais.` : `; a estratégia ficou ${formatNumber(bh - returnPct, 2)} p.p. atrás.`
      }`,
    });
  }

  // 3. Sample size
  if (s.tradeCount > 0) {
    const small = s.tradeCount < MIN_TRADES;
    findings.push({
      key: "sample",
      tone: small ? "warn" : "neutral",
      title: small ? "Poucas trades para conclusões" : "Amostra razoável",
      text: small
        ? `Só ${s.tradeCount} trades. Com menos de ${MIN_TRADES}, o resultado pode ser sorte ou azar; aumente o período ou teste mais moedas.`
        : `${s.tradeCount} trades: já dá para enxergar um padrão, embora não garanta o futuro.`,
    });
  }

  // 4. Worst drop
  if (s.tradeCount > 0) {
    const deep = s.maxDrawdownPct >= DEEP_DRAWDOWN;
    findings.push({
      key: "drawdown",
      tone: deep ? "warn" : "neutral",
      title: "Pior momento",
      text: `No pior trecho, o saldo ficou ${formatFraction(s.maxDrawdownPct, 1)} abaixo do seu melhor valor (${formatMoney(s.maxDrawdown)}).${
        deep ? " Uma queda desse tamanho é difícil de aguentar com dinheiro real." : ""
      }`,
    });
  }

  // 5. Win rate vs payoff
  if (s.tradeCount > 0 && s.lossCount > 0 && s.winCount > 0) {
    const need = breakEvenWinRate(s.payoffRatio);
    const pays = s.winRate > need;
    findings.push({
      key: "edge",
      tone: pays ? "good" : "bad",
      title: pays ? "Acertos compensam os erros" : "Acertos não compensam os erros",
      text: `Acertou ${formatFraction(s.winRate, 0)} das trades, e cada ganho médio valeu ${formatNumber(s.payoffRatio, 2)}× a perda média. Com essa proporção, seria preciso acertar mais de ${formatFraction(need, 0)} para lucrar.`,
    });
  }

  // 6. Costs
  if (run.costs && s.tradeCount > 0) {
    const gross = s.totalPnl + run.costs.totalFees;
    const heavy = gross > 0 && run.costs.totalFees > gross * 0.5;
    findings.push({
      key: "costs",
      tone: heavy || (gross > 0 && s.totalPnl <= 0) ? "warn" : "neutral",
      title: "Custo das taxas",
      text: `As taxas somaram ${formatMoney(run.costs.totalFees)} (${formatFraction(run.costs.feesPctOfCapital, 2)} do capital). Sem elas, o resultado teria sido ${formatSignedMoney(gross)}.${
        gross > 0 && s.totalPnl <= 0 ? " Ou seja: as taxas transformaram lucro em prejuízo." : heavy ? " Elas comeram mais da metade do lucro." : ""
      }`,
    });
  }

  // 7. Walk-forward consistency
  const windows = run.walkForwardWindows ?? [];
  let unstable = false;
  if (windows.length > 1) {
    const positive = windows.filter((w) => w.summary.totalPnl > 0).length;
    unstable = positive / windows.length < CONSISTENT_SHARE;
    findings.push({
      key: "walkforward",
      tone: unstable ? "warn" : "good",
      title: unstable ? "Resultado instável entre períodos" : "Resultado consistente entre períodos",
      text: `Lucrou em ${positive} de ${windows.length} janelas de walk-forward.${
        unstable ? " Depender de poucos períodos bons é sinal de que o resultado pode não se repetir." : ""
      }`,
    });
  }

  // 8. Overfitting
  if (run.paramVariationsTestedForStrategy > 1) {
    findings.push({
      key: "overfitting",
      tone: run.paramVariationsTestedForStrategy >= 10 ? "warn" : "neutral",
      title: "Variações testadas",
      text: `${run.paramVariationsTestedForStrategy} combinações de parâmetros já foram testadas para ${run.strategy}. Quanto mais tentativas, maior a chance de o melhor resultado ser coincidência.`,
    });
  }

  return { returnPct, days, buyAndHoldPct: bh, verdict: verdictFor(run, returnPct, bh, unstable), findings };
}

function verdictFor(run: BacktestRun, returnPct: number, bh: number | null, unstable: boolean): Verdict {
  const s = run.summary;
  if (s.tradeCount === 0) {
    return { kind: "no-trades", tone: "neutral", title: "Sem trades no período", text: "Não há o que avaliar. Tente um período maior ou outras moedas." };
  }
  if (s.tradeCount < MIN_TRADES) {
    return {
      kind: "inconclusive",
      tone: "warn",
      title: "Inconclusivo",
      text: `Com ${s.tradeCount} trades não dá para saber se a estratégia funciona. Rode um período maior antes de tirar conclusões.`,
    };
  }
  if (returnPct <= 0) {
    return { kind: "loss", tone: "bad", title: "Não funcionou neste período", text: "A estratégia perdeu dinheiro. Não vale levar para o paper com estes parâmetros." };
  }
  if (bh !== null && returnPct < bh) {
    return {
      kind: "below-hold",
      tone: "warn",
      title: "Lucrou, mas não compensou",
      text: "Só comprar e segurar teria dado mais, com muito menos trabalho e taxas.",
    };
  }
  if (unstable) {
    return { kind: "unstable", tone: "warn", title: "Promissor, mas instável", text: "O lucro veio de poucos períodos. Teste outros intervalos antes de confiar." };
  }
  return {
    kind: "promising",
    tone: "good",
    title: "Promissor neste período",
    text: "Próximo passo: deixar rodando em paper e comparar na tela de Análises. Resultado passado não garante o futuro.",
  };
}

/** Short label for the run list. */
export function verdictBadge(run: BacktestRun): { label: string; tone: FindingTone } {
  const { verdict } = readRun(run);
  return { label: verdict.title, tone: verdict.tone };
}
