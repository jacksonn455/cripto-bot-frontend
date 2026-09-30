"use client";

import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { SeedNotice } from "@/components/data/seed-notice";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBacktestRuns, useSummary } from "@/hooks/use-data";
import { useDataMode } from "@/hooks/use-data-mode";
import type { ReportsFilter } from "@/lib/schemas";
import { periodRange } from "@/lib/trades";
import { BreakdownCharts } from "./breakdown-charts";
import { DistributionCharts } from "./distribution-charts";
import { MetricsGrid } from "./metrics-grid";
import { ModeComparison } from "./mode-comparison";
import { SideComparison } from "./side-comparison";
import { PeriodPicker, type AnalyticsPeriod } from "./period-picker";
import { ALL_RUNS, RunSelect } from "./run-select";

export function AnalyticsView() {
  const { mode } = useDataMode();
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [runId, setRunId] = useState<string | null>(null);
  const runs = useBacktestRuns();

  // Until the user picks one, use the latest backtest run: mixing runs with different parameters misleads.
  const selectedRun = runId ?? runs.data?.[0]?.runId ?? ALL_RUNS;

  const range = useMemo(() => periodRange(period, custom), [period, custom]);
  const isBacktest = mode === "BACKTEST";
  // Period filters apply to exit time: "PnL realized in the period".
  const filter: ReportsFilter = {
    mode,
    ...range,
    dateField: range.from || range.to ? "exitTime" : undefined,
    runId: isBacktest && selectedRun !== ALL_RUNS ? selectedRun : undefined,
  };
  const summary = useSummary(filter);

  return (
    <>
      <PageHeader
        title="Análises"
        description="Desempenho das trades fechadas: métricas, agrupamentos e distribuição."
      />
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-4 rounded-lg border p-3">
          <div className="space-y-1">
            <span className="block text-xs font-medium">Período (data de saída)</span>
            <PeriodPicker
              period={period}
              customFrom={custom.from}
              customTo={custom.to}
              onChange={(p) => {
                if (p.period) setPeriod(p.period);
                if (p.customFrom !== undefined || p.customTo !== undefined) {
                  setCustom((c) => ({ from: p.customFrom ?? c.from, to: p.customTo ?? c.to }));
                }
              }}
            />
          </div>
          {isBacktest && runs.data && runs.data.length > 0 && (
            <RunSelect id="an-run" runs={runs.data} value={selectedRun} onChange={setRunId} />
          )}
        </div>
        {isBacktest && (
          <p className="text-sm text-muted-foreground">
            Em BACKTEST, as datas são as históricas da simulação. Se o período escolhido não cobrir a execução, use “Tudo”.
          </p>
        )}

        <SeedNotice mode={mode} />

        <QueryState
          query={summary}
          loading={<Skeleton className="h-64 w-full" />}
          isEmpty={(s) => s.tradeCount === 0}
          empty={
            <EmptyState
              icon={BarChart3}
              title={`Sem trades fechadas em ${mode} neste período`}
              description={
                isBacktest
                  ? "Rode um backtest (tela Backtests) ou mude o período para “Tudo”."
                  : "As análises aparecem depois que o bot fechar as primeiras trades neste modo."
              }
            />
          }
        >
          {(s) => (
            <div className="space-y-6">
              <MetricsGrid summary={s} />
              <SideComparison summary={s} />
              <BreakdownCharts filter={filter} />
              <DistributionCharts summary={s} />
            </div>
          )}
        </QueryState>

        <ModeComparison
          period={{ from: range.from, to: range.to, dateField: range.from || range.to ? "exitTime" : undefined }}
          runId={selectedRun}
          onRunChange={setRunId}
        />
      </div>
    </>
  );
}
