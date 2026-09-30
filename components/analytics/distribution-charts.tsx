"use client";

import { BarMetricChart } from "@/components/charts/bar-metric-chart";
import { Histogram, type HistogramBin } from "@/components/charts/histogram";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, MINUS } from "@/lib/format";
import type { MetricsSummary } from "@/lib/schemas";
import { exitReasonLabel } from "@/lib/trades";

/** Backend bucket labels ("< -5%", "-5% a -2%", …): the first number decides the side of zero. */
export function toHistogramBins(histogram: MetricsSummary["pnlHistogram"]): HistogramBin[] {
  return histogram.map(({ bucket, count }) => {
    const first = Number(bucket.match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
    return { label: bucket.replace(/-/g, MINUS), count, tone: first < 0 ? "loss" : "profit" };
  });
}

export function DistributionCharts({ summary }: { summary: MetricsSummary }) {
  const empty = summary.tradeCount === 0;
  const reasons = Object.entries(summary.exitReasonBreakdown).sort(([, a], [, b]) => b - a);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Distribuição do PnL por trade</CardTitle>
          <CardDescription>Quantas trades caíram em cada faixa de PnL %.</CardDescription>
        </CardHeader>
        <CardContent>
          {empty ? (
            <EmptyState title="Sem trades fechadas" />
          ) : (
            <Histogram bins={toHistogramBins(summary.pnlHistogram)} ariaLabel="Histograma do PnL % por trade" />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Motivo de saída</CardTitle>
          <CardDescription>Como as trades foram encerradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {empty ? (
            <EmptyState title="Sem trades fechadas" />
          ) : (
            <BarMetricChart
              data={reasons.map(([reason, count]) => ({
                label: reason === "UNKNOWN" ? "Sem motivo" : exitReasonLabel(reason),
                value: count,
                details: [["Participação", `${formatNumber((count / summary.tradeCount) * 100, 0)}%`]],
              }))}
              orientation="horizontal"
              color="single"
              valueLabel="Trades"
              formatValue={(v) => formatNumber(v, 0)}
              showValueLabels
              ariaLabel={`Motivos de saída: ${reasons.map(([r, c]) => `${exitReasonLabel(r)} ${c}`).join(", ")}`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
