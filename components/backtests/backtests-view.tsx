"use client";

import { FlaskConical, GitCompare, Sigma } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { QueryState } from "@/components/states/query-state";
import { Pagination } from "@/components/trades/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBacktestRuns, useBacktestRunsPage, useStrategies } from "@/hooks/use-data";
import { MAX_PBO_RUNS } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { BacktestExplainer } from "./backtest-explainer";
import { BacktestForm } from "./backtest-form";
import { OverfittingNotice } from "./overfitting-notice";
import { RunsTable } from "./runs-table";

const PAGE_SIZES = [10, 20, 50] as const;

export function BacktestsView() {
  const strategies = useStrategies();
  const allRuns = useBacktestRuns();
  const [paging, setPaging] = useState<{ page: number; limit: number }>({ page: 1, limit: 10 });
  const runs = useBacktestRunsPage(paging);
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-MAX_PBO_RUNS)));

  // One overfitting warning per strategy that has runs (the count is per strategy, not per page).
  const variations = new Map<string, number>();
  for (const r of allRuns.data ?? []) variations.set(r.strategy, r.paramVariationsTestedForStrategy);

  return (
    <>
      <PageHeader
        title="Backtests"
        showDataMode={false}
        description="Rode simulações sobre dados históricos e compare execuções. Resultado de backtest não garante resultado futuro."
      />
      <div className="space-y-6">
        <BacktestExplainer />

        {[...variations].map(([strategy, n]) => (
          <OverfittingNotice key={strategy} strategy={strategy} variations={n} />
        ))}

        {strategies.data ? (
          <BacktestForm strategies={strategies.data} />
        ) : strategies.isError ? (
          <ErrorState error={strategies.error} onRetry={() => void strategies.refetch()} retrying={strategies.isFetching} />
        ) : (
          <Skeleton className="h-72 w-full" />
        )}

        <section className="space-y-3" aria-labelledby="runs-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="runs-title" className="text-lg font-semibold">Execuções</h2>
              <p className="text-sm text-muted-foreground">
                Mais recentes primeiro. Abra uma para ver o que o resultado quer dizer, marque duas para comparar (a primeira marcada é a
                base), ou várias variantes do mesmo período para medir o risco de overfitting.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{selected.length} selecionada(s)</span>
              {selected.length === 2 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/backtests/compare?a=${encodeURIComponent(selected[0])}&b=${encodeURIComponent(selected[1])}`}>
                    <GitCompare aria-hidden /> Comparar
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled title="Selecione exatamente duas execuções">
                  <GitCompare aria-hidden /> Comparar
                </Button>
              )}
              {selected.length >= 2 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/backtests/pbo?runs=${selected.map(encodeURIComponent).join(",")}`}>
                    <Sigma aria-hidden /> Risco de overfitting (PBO)
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled title={`Selecione de 2 a ${MAX_PBO_RUNS} variantes`}>
                  <Sigma aria-hidden /> Risco de overfitting (PBO)
                </Button>
              )}
            </div>
          </div>
          <QueryState
            query={runs}
            loading={<Skeleton className="h-40 w-full" />}
            isEmpty={(d) => d.total === 0}
            empty={<EmptyState icon={FlaskConical} title="Nenhum backtest ainda" description="Use o formulário acima para rodar o primeiro." />}
          >
            {(data) => (
              <div className={cn("space-y-3", runs.isPlaceholderData && "opacity-60")}>
                <RunsTable runs={data.items} selected={selected} onToggle={toggle} />
                <Pagination
                  page={data.page}
                  limit={data.limit}
                  total={data.total}
                  pageSizes={PAGE_SIZES}
                  onChange={(p) => setPaging((cur) => ({ ...cur, ...p }))}
                  busy={runs.isPlaceholderData}
                />
              </div>
            )}
          </QueryState>
        </section>
      </div>
    </>
  );
}
