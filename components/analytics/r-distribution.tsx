"use client";

import { Histogram } from "@/components/charts/histogram";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFraction, formatNumber, withSign } from "@/lib/format";
import type { RStats } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { toHistogramBins } from "./distribution-charts";

/** Top 10% of trades making more than this share of the PnL = results live on the right tail. */
const TAIL_DEPENDENT = 0.5;

const formatR = (r: number) => `${withSign(r, (abs) => formatNumber(abs, 2))}R`;

/** Kelly diagnostic against the configured risk per trade: above ¼ Kelly is aggressive. */
function kellyReading(kelly: number | null, riskPerTradePct: number | undefined): { text: string; warn: boolean } | null {
  if (kelly === null) return null;
  if (kelly <= 0) return { text: "Kelly ≤ 0: por estas trades não há edge para arriscar nada.", warn: true };
  if (riskPerTradePct === undefined) return { text: `Kelly implícito: ${formatFraction(kelly, 1)} de risco por trade.`, warn: false };
  const quarter = kelly / 4;
  const aggressive = riskPerTradePct > quarter;
  return {
    text: `Kelly implícito ${formatFraction(kelly, 1)}; ¼ de Kelly = ${formatFraction(quarter, 2)}. O risco configurado (${formatFraction(riskPerTradePct, 2)}) está ${
      aggressive ? "acima: agressivo para um edge estimado em backtest" : "abaixo: conservador"
    }.`,
    warn: aggressive,
  };
}

/**
 * Results in multiples of the risk taken per trade. Trend following should show many small
 * losses near −1R and a few large winners: if they carry most of the PnL, a fixed take profit
 * would cut exactly those trades.
 */
export function RDistribution({ stats, riskPerTradePct }: { stats: RStats; riskPerTradePct?: number }) {
  const kelly = kellyReading(stats.kellyFraction, riskPerTradePct);
  const share = stats.topDecilePnlShare;
  const items = [
    { label: "R médio por trade", value: formatR(stats.avgR), hint: "Expectância em múltiplos do risco" },
    { label: "Mediana", value: formatR(stats.medianR) },
    { label: "Melhor / pior", value: `${formatR(stats.bestR)} / ${formatR(stats.worstR)}`, hint: "Pior abaixo de −1R = stop com gap ou slippage" },
    { label: "Trades ≥ 3R", value: formatNumber(stats.tradesAtLeast3R, 0), hint: `de ${formatNumber(stats.tradeCount, 0)}` },
    {
      label: "Lucro bruto dos 10% melhores",
      value: share === null ? "—" : formatFraction(share, 0),
      hint: share === null ? "Sem trades vencedoras" : share > TAIL_DEPENDENT ? "Resultado depende da cauda direita" : undefined,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribuição em R</CardTitle>
        <CardDescription>Resultado de cada trade em múltiplos do risco inicial (R = PnL ÷ distância do stop × quantidade).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <Histogram bins={toHistogramBins(stats.rHistogram)} ariaLabel="Histograma do resultado por trade em R" binTitle="Resultado em R" />
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {items.map((i) => (
              <div key={i.label} className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">{i.label}</dt>
                <dd className="text-sm tabular-nums">{i.value}</dd>
                {i.hint && <dd className="text-xs text-muted-foreground">{i.hint}</dd>}
              </div>
            ))}
          </dl>
          {share !== null && share > TAIL_DEPENDENT && (
            <p className="text-xs text-muted-foreground">
              Os 10% melhores trades fizeram {formatFraction(share, 0)} do lucro bruto. Um take profit fixo cortaria justamente esses trades.
            </p>
          )}
          {kelly && <p className={cn("text-xs", kelly.warn ? "text-warning" : "text-muted-foreground")}>{kelly.text} Só diagnóstico: o sizing não muda.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
