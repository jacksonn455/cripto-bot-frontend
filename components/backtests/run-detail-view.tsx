"use client";

import { ArrowLeft, LineChart, List } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MetricsGrid } from "@/components/analytics/metrics-grid";
import { ModeComparison } from "@/components/analytics/mode-comparison";
import { SideComparison } from "@/components/analytics/side-comparison";
import { EquityChart } from "@/components/charts/equity-chart";
import { PageHeader } from "@/components/layout/page-header";
import { ModeBadge } from "@/components/mode/mode-badge";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { QueryState } from "@/components/states/query-state";
import { Pagination } from "@/components/trades/pagination";
import { TradesTable } from "@/components/trades/trades-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBacktestRun, useEquityCurve, useTrades } from "@/hooks/use-data";
import { ApiError } from "@/lib/api/client";
import { formatRatio } from "@/lib/analytics";
import { formatDate, formatDateTime, formatFraction, formatNumber } from "@/lib/format";
import type { BacktestRun, TradesQuery } from "@/lib/schemas";
import { Pnl, PnlPercent } from "@/components/data/pnl";
import { RDistribution } from "@/components/analytics/r-distribution";
import { OverfittingNotice } from "./overfitting-notice";
import { RunCosts } from "./run-costs";
import { RunParams } from "./run-params";
import { RunReading } from "./run-reading";
import { RunRiskAdjusted } from "./run-risk-adjusted";

function Back() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
      <Link href="/backtests"><ArrowLeft aria-hidden /> Backtests</Link>
    </Button>
  );
}

export function RunDetailView({ runId }: { runId: string }) {
  const run = useBacktestRun(runId);
  if (!run.data) {
    const notFound = run.error instanceof ApiError && run.error.status === 404;
    return (
      <>
        <Back />
        {run.isError ? (
          <ErrorState
            error={notFound ? new ApiError("http", "Essa execução de backtest não existe ou foi apagada.", 404) : run.error}
            onRetry={notFound ? undefined : () => void run.refetch()}
          />
        ) : (
          <Skeleton className="h-96 w-full" />
        )}
      </>
    );
  }
  return <RunDetail run={run.data} />;
}

function RunDetail({ run }: { run: BacktestRun }) {
  const curve = useEquityCurve({ mode: "BACKTEST", runId: run.runId });
  const [page, setPage] = useState({ page: 1, limit: 20 });
  const [sort, setSort] = useState<Pick<TradesQuery, "sortBy" | "sortOrder">>({ sortBy: "entryTime", sortOrder: "asc" });
  const trades = useTrades({ mode: "BACKTEST", runId: run.runId, ...page, ...sort });

  return (
    <>
      <Back />
      <PageHeader
        showDataMode={false}
        title={`Backtest ${run.symbols.join(", ")} · ${run.timeframe}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ModeBadge mode="BACKTEST" /> {run.strategy} · {formatDate(run.from)} – {formatDate(run.to)} · rodado em {formatDateTime(run.createdAt)}
          </span>
        }
      />
      <div className="space-y-6">
        <RunReading run={run} />

        <OverfittingNotice strategy={run.strategy} variations={run.paramVariationsTestedForStrategy} />

        <Card>
          <CardHeader><CardTitle>Parâmetros</CardTitle></CardHeader>
          <CardContent><RunParams run={run} /></CardContent>
        </Card>

        {run.summary.tradeCount === 0 ? (
          <EmptyState title="Nenhuma trade simulada" description="A estratégia não gerou entradas nesse período e timeframe." />
        ) : (
          <>
            <MetricsGrid summary={run.summary} />
            <SideComparison
              summary={run.summary}
              description="Resultado por lado nesta simulação. Para saber se o short agrega valor, compare com o mesmo período rodado sem short."
            />
          </>
        )}

        <RunRiskAdjusted run={run} />

        {run.summary.rStats && run.summary.tradeCount > 0 && (
          <RDistribution
            stats={run.summary.rStats}
            riskPerTradePct={typeof run.params.riskPerTradePct === "number" ? run.params.riskPerTradePct : undefined}
          />
        )}

        {(run.costs || run.exposurePct != null) && (
          <Card>
            <CardHeader>
              <CardTitle>Custos e exposição</CardTitle>
              <CardDescription>O que a simulação cobrou (já descontado do PnL) e quanto tempo ficou posicionada.</CardDescription>
            </CardHeader>
            <CardContent><RunCosts run={run} /></CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Curva de capital</CardTitle>
            <CardDescription>Equity simulada candle a candle, partindo do saldo inicial.</CardDescription>
          </CardHeader>
          <CardContent>
            <QueryState
              query={curve}
              loading={<Skeleton className="h-90 w-full" />}
              isEmpty={(d) => d.length < 2}
              empty={<EmptyState icon={LineChart} title="Sem curva de capital" description="O backend não gravou pontos de equity para esta execução." />}
            >
              {(d) => <EquityChart series={d} label="Curva de capital do backtest" />}
            </QueryState>
          </CardContent>
        </Card>

        {run.walkForwardWindows && run.walkForwardWindows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Janelas de walk-forward</CardTitle>
              <CardDescription>Resultado de cada janela consecutiva. Resultados muito diferentes entre janelas indicam uma estratégia instável.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Janela</TableHead>
                      <TableHead className="text-right">Trades</TableHead>
                      <TableHead className="text-right">Retorno</TableHead>
                      <TableHead className="text-right">PnL</TableHead>
                      <TableHead className="text-right">Win rate</TableHead>
                      <TableHead className="text-right">Profit factor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.walkForwardWindows.map((w) => (
                      <TableRow key={w.from}>
                        <TableCell className="whitespace-nowrap">{formatDate(w.from)} – {formatDate(w.to)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(w.tradeCount, 0)}</TableCell>
                        <TableCell className="text-right"><PnlPercent value={w.returnPct != null ? w.returnPct * 100 : null} /></TableCell>
                        <TableCell className="text-right"><Pnl value={w.summary.totalPnl} /></TableCell>
                        <TableCell className="text-right tabular-nums">{w.tradeCount ? formatFraction(w.summary.winRate, 1) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatRatio(w.summary.profitFactor, w.summary)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <ModeComparison period={{}} runId={run.runId} />

        <section className="space-y-3" aria-labelledby="bt-trades">
          <h2 id="bt-trades" className="text-lg font-semibold">Trades simuladas</h2>
          <QueryState
            query={trades}
            loading={<Skeleton className="h-60 w-full" />}
            isEmpty={(d) => d.items.length === 0}
            empty={<EmptyState icon={List} title="Nenhuma trade nesta execução" />}
          >
            {(d) => (
              <div className="space-y-3">
                <TradesTable
                  trades={d.items}
                  sortBy={sort.sortBy ?? "entryTime"}
                  sortOrder={sort.sortOrder ?? "asc"}
                  onSortChange={(sortBy, sortOrder) => {
                    setSort({ sortBy, sortOrder });
                    setPage((p) => ({ ...p, page: 1 }));
                  }}
                />
                <Pagination
                  page={page.page}
                  limit={page.limit}
                  total={d.total}
                  pageSizes={[20, 50, 100]}
                  onChange={(p) => setPage((cur) => ({ ...cur, ...p }))}
                  busy={trades.isPlaceholderData}
                />
              </div>
            )}
          </QueryState>
        </section>
      </div>
    </>
  );
}
