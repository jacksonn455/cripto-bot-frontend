"use client";

import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { EquityChart } from "@/components/charts/equity-chart";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { QueryState } from "@/components/states/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBacktestRun, useEquityCurve } from "@/hooks/use-data";
import { COMPARISON_METRICS } from "@/lib/analytics";
import { formatDateTime, formatFraction, formatNumber } from "@/lib/format";
import type { BacktestRun } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { runLabel } from "@/components/analytics/run-select";
import { CompareWindows } from "./compare-windows";
import { OverfittingNotice } from "./overfitting-notice";
import { runParamRows } from "./run-params";

const dash = "—";
/** Daily/annualized metrics and the DSR, when both runs have them (older runs show "—"). */
const RISK_ADJUSTED_ROWS: Array<{ key: string; label: string; help: string; format: (r: BacktestRun) => string }> = [
  {
    key: "sharpeAnnualized",
    label: "Sharpe anualizado",
    help: "Retornos diários da curva de capital × √365. Comparável entre execuções.",
    format: (r) => (r.riskAdjusted ? formatNumber(r.riskAdjusted.sharpeAnnualized, 2) : dash),
  },
  {
    key: "sortinoAnnualized",
    label: "Sortino anualizado",
    help: "Como o Sharpe anualizado, mas só os dias de perda contam como risco.",
    format: (r) => (r.riskAdjusted ? formatNumber(r.riskAdjusted.sortinoAnnualized, 2) : dash),
  },
  {
    key: "calmar",
    label: "Calmar",
    help: "Retorno anual ÷ pior queda da curva diária.",
    format: (r) => (r.riskAdjusted ? formatNumber(r.riskAdjusted.calmar, 2) : dash),
  },
  {
    key: "dailyDrawdown",
    label: "Pior queda (curva diária)",
    help: "Inclui posições abertas marcadas a mercado.",
    format: (r) => (r.riskAdjusted ? formatFraction(r.riskAdjusted.maxDrawdown, 1) : dash),
  },
  {
    key: "dsr",
    label: "Sharpe deflacionado (DSR)",
    help: "Chance de o Sharpe ser melhor que o de um sortudo, dado o número de variações testadas. Critério: 95% ou mais.",
    format: (r) => (r.overfitting?.deflatedSharpe != null ? formatFraction(r.overfitting.deflatedSharpe, 0) : dash),
  },
];

function Back() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
      <Link href="/backtests"><ArrowLeft aria-hidden /> Backtests</Link>
    </Button>
  );
}

export function CompareView({ a, b }: { a?: string; b?: string }) {
  const runA = useBacktestRun(a ?? "");
  const runB = useBacktestRun(b ?? "");
  if (!a || !b) {
    return (
      <>
        <Back />
        <EmptyState title="Escolha duas execuções" description="Na lista de backtests, marque duas execuções e clique em Comparar." />
      </>
    );
  }
  const failed = runA.isError ? runA : runB.isError ? runB : null;
  if (failed) return (<><Back /><ErrorState error={failed.error} onRetry={() => void failed.refetch()} /></>);
  if (!runA.data || !runB.data) return (<><Back /><Skeleton className="h-96 w-full" /></>);
  return <Compare a={runA.data} b={runB.data} />;
}

function Curve({ run, tag }: { run: BacktestRun; tag: string }) {
  const curve = useEquityCurve({ mode: "BACKTEST", runId: run.runId });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{tag} · {runLabel(run)}</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState query={curve} loading={<Skeleton className="h-72 w-full" />} isEmpty={(d) => d.length < 2} empty={<EmptyState title="Sem curva de capital" />}>
          {(d) => <EquityChart series={d} height={200} label={`Curva de capital ${tag}`} />}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function Compare({ a, b }: { a: BacktestRun; b: BacktestRun }) {
  const rowsA = runParamRows(a);
  const rowsB = runParamRows(b);
  const keys = [...new Set([...rowsA, ...rowsB].map((r) => r.key))];
  const paramRows = keys.map((k) => {
    const ra = rowsA.find((r) => r.key === k);
    const rb = rowsB.find((r) => r.key === k);
    return { key: k, label: ra?.label ?? rb?.label ?? k, a: ra?.value ?? "—", b: rb?.value ?? "—" };
  });
  const differing = paramRows.filter((r) => r.a !== r.b).length;
  const strategies = new Map([[a.strategy, a.paramVariationsTestedForStrategy], [b.strategy, b.paramVariationsTestedForStrategy]]);

  return (
    <>
      <Back />
      <PageHeader showDataMode={false} title="Comparar backtests" description={`A = ${formatDateTime(a.createdAt)} · B = ${formatDateTime(b.createdAt)}`} />
      <div className="space-y-6">
        {[...strategies].map(([s, n]) => <OverfittingNotice key={s} strategy={s} variations={n} />)}

        <div className="grid gap-6 2xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Parâmetros <span className="text-sm font-normal text-muted-foreground">({differing} diferente(s))</span></CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Parâmetro</TableHead><TableHead className="text-right">A</TableHead><TableHead className="text-right">B</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {paramRows.map((r) => {
                      const diff = r.a !== r.b;
                      return (
                        <TableRow key={r.key} className={cn(diff && "bg-warning/10")}>
                          <TableCell className={cn(r.key.startsWith("sp.") && "font-mono text-xs")}>
                            {r.label}
                            {diff && <span className="sr-only"> (diferente)</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.a}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", diff && "font-semibold")}>{r.b}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Métricas</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Métrica</TableHead><TableHead className="text-right">A</TableHead><TableHead className="text-right">B</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPARISON_METRICS.map((m) => (
                      <TableRow key={m.key}>
                        <TableCell title={m.help}>{m.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.format(a.summary)}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.format(b.summary)}</TableCell>
                      </TableRow>
                    ))}
                    {RISK_ADJUSTED_ROWS.map((m) => (
                      <TableRow key={m.key}>
                        <TableCell title={m.help}>{m.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.format(a)}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.format(b)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Períodos ou símbolos diferentes tornam a comparação menos direta. Um parâmetro que só funciona melhor num período específico é sinal de overfitting.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href={`/backtests/compare?a=${encodeURIComponent(b.runId)}&b=${encodeURIComponent(a.runId)}`}>
              <ArrowLeftRight aria-hidden /> Trocar base e variante
            </Link>
          </Button>
        </div>
        <CompareWindows baseline={a.runId} variant={b.runId} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Curve run={a} tag="A" />
          <Curve run={b} tag="B" />
        </div>
      </div>
    </>
  );
}
