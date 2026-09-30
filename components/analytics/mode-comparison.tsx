"use client";

import { AlertTriangle, Scale } from "lucide-react";
import { ModeBadge } from "@/components/mode/mode-badge";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBacktestRuns, useCompareModes } from "@/hooks/use-data";
import { buildComparison, SMALL_SAMPLE } from "@/lib/analytics";
import type { ReportsFilter } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { ALL_RUNS, RunSelect } from "./run-select";

interface Props {
  /** Period (PAPER/LIVE only) from the page. */
  period: Pick<ReportsFilter, "from" | "to" | "dateField">;
  runId: string;
  /** Omit to pin the comparison to `runId` (e.g. on a backtest detail page). */
  onRunChange?: (runId: string) => void;
}

/** Backtest next to paper and live, flagging large gaps (slippage, fees, overfitting). */
export function ModeComparison({ period, runId, onRunChange }: Props) {
  const runs = useBacktestRuns();
  const compare = useCompareModes({ ...period, runId: runId === ALL_RUNS ? undefined : runId });
  const runCount = runs.data?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4" aria-hidden /> Backtest × paper × live
        </CardTitle>
        <CardDescription>
          Mesmas métricas lado a lado. Diferenças grandes em relação ao backtest costumam vir de slippage, taxas ou
          overfitting. O período da página vale para PAPER e LIVE; o BACKTEST usa as datas históricas da execução
          escolhida.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {onRunChange && runCount > 0 && <RunSelect id="cmp-run" runs={runs.data!} value={runId} onChange={onRunChange} />}
        {onRunChange && runId === ALL_RUNS && runCount > 1 && (
          <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            A coluna BACKTEST está juntando {runCount} execuções, possivelmente com parâmetros e períodos diferentes. Para uma
            comparação justa, escolha uma execução.
          </p>
        )}

        <QueryState
          query={compare}
          loading={<Skeleton className="h-96 w-full" />}
          isEmpty={(d) => d.every((c) => c.summary.tradeCount === 0)}
          empty={
            <EmptyState
              icon={Scale}
              title="Nada para comparar ainda"
              description="Nenhum modo tem trades fechadas com esses filtros. Rode um backtest e deixe o bot operar em paper para comparar."
            />
          }
        >
          {(data) => {
            const { rows, flags, smallSample } = buildComparison(data);
            return (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Métrica</TableHead>
                        {data.map((c, i) => (
                          <TableHead key={c.mode} className="text-right">
                            <span className="inline-flex flex-col items-end gap-0.5">
                              <ModeBadge mode={c.mode} />
                              {smallSample[i] && <span className="text-[0.7rem] font-normal text-warning">amostra pequena</span>}
                              {c.summary.tradeCount === 0 && <span className="text-[0.7rem] font-normal text-muted-foreground">sem trades</span>}
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium" title={row.help}>{row.label}</TableCell>
                          {row.cells.map((cell, i) => (
                            <TableCell
                              key={data[i].mode}
                              className={cn("text-right align-top tabular-nums", cell.divergence && "bg-warning/10")}
                            >
                              <div>{cell.text}</div>
                              {cell.divergence && (
                                <div className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-warning">
                                  <AlertTriangle className="size-3" aria-hidden />
                                  <span>{cell.divergence}</span>
                                </div>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {flags > 0
                    ? `${flags} diferença(s) grande(s) em relação ao backtest destacada(s).`
                    : "Nenhuma diferença grande em relação ao backtest."}{" "}
                  Com menos de {SMALL_SAMPLE} trades num modo, diferenças podem ser só acaso.
                </p>
              </>
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}
