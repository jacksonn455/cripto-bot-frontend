"use client";

import { BarChart3 } from "lucide-react";
import type { ReactNode } from "react";
import { BarMetricChart, type BarDatum } from "@/components/charts/bar-metric-chart";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useByHour, useGroupedReport } from "@/hooks/use-data";
import { fillBuckets, formatGroupedProfitFactor } from "@/lib/analytics";
import { formatFraction, formatNumber, formatSignedMoney, withSign } from "@/lib/format";
import type { GroupedMetric, ReportsFilter } from "@/lib/schemas";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1, signDisplay: "exceptZero" });

function details(g: Pick<GroupedMetric, "tradeCount" | "winRate" | "profitFactor">): Array<[string, ReactNode]> {
  return [
    ["Trades", formatNumber(g.tradeCount, 0)],
    ["Win rate", formatFraction(g.winRate, 1)],
    ["Profit factor", formatGroupedProfitFactor(g)],
  ];
}

function ChartCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const noTrades = <EmptyState icon={BarChart3} title="Sem trades fechadas" description="Nada para agrupar neste modo e período." />;

function GroupChart({ by, filter }: { by: "strategy" | "symbol"; filter: ReportsFilter }) {
  const q = useGroupedReport(by, filter);
  const title = by === "strategy" ? "PnL por estratégia (USDT)" : "PnL por símbolo (USDT)";
  return (
    <ChartCard title={title}>
      <QueryState query={q} loading={<Skeleton className="h-40 w-full" />} isEmpty={(d) => d.items.length === 0} empty={noTrades}>
        {(d) => {
          const data: BarDatum[] = d.items.map((g) => ({ label: g.key, value: g.totalPnl, details: details(g) }));
          return (
            <BarMetricChart
              data={data}
              orientation="horizontal"
              valueLabel="PnL total"
              formatValue={(v) => formatSignedMoney(v)}
              formatTick={(v) => compact.format(v)}
              formatLabel={(v) => withSign(v, (a) => formatNumber(a, 2))}
              showValueLabels={data.length <= 12}
              ariaLabel={`${title}: ${data.map((x) => `${x.label} ${formatSignedMoney(x.value)}`).join(", ")}`}
            />
          );
        }}
      </QueryState>
    </ChartCard>
  );
}

export function BreakdownCharts({ filter }: { filter: ReportsFilter }) {
  const byHour = useByHour(filter);

  const timeCharts = (kind: "hour" | "weekday") => (
    <QueryState
      query={byHour}
      loading={<Skeleton className="h-60 w-full" />}
      isEmpty={(d) => (kind === "hour" ? d.byHourOfDay : d.byDayOfWeek).length === 0}
      empty={noTrades}
    >
      {(d) => {
        const buckets = fillBuckets(kind === "hour" ? d.byHourOfDay : d.byDayOfWeek, kind);
        const data: BarDatum[] = buckets.map((b) => ({
          label: b.label,
          value: b.value,
          empty: b.tradeCount === 0,
          details: b.tradeCount ? details({ tradeCount: b.tradeCount, winRate: b.winRate ?? 0, profitFactor: b.profitFactor ?? 0 }) : undefined,
        }));
        return (
          <BarMetricChart
            data={data}
            valueLabel="PnL total"
            formatValue={(v) => formatSignedMoney(v)}
            formatTick={(v) => compact.format(v)}
            ariaLabel={`PnL por ${kind === "hour" ? "hora do dia" : "dia da semana"}`}
          />
        );
      }}
    </QueryState>
  );

  const tzNote = byHour.data ? `Pela hora de saída da trade, no fuso ${byHour.data.timezone}.` : "Pela hora de saída da trade.";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <GroupChart by="strategy" filter={filter} />
      <GroupChart by="symbol" filter={filter} />
      <ChartCard title="PnL por hora do dia (USDT)" description={tzNote}>{timeCharts("hour")}</ChartCard>
      <ChartCard title="PnL por dia da semana (USDT)" description={tzNote}>{timeCharts("weekday")}</ChartCard>
    </div>
  );
}
