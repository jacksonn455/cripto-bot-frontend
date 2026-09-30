"use client";

import { Download, List } from "lucide-react";
import { useEffect } from "react";
import { SeedNotice } from "@/components/data/seed-notice";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrades } from "@/hooks/use-data";
import { useDataMode } from "@/hooks/use-data-mode";
import { PAGE_SIZES, useTradeFilters } from "@/hooks/use-trade-filters";
import { api } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { Pagination } from "./pagination";
import { TradeFiltersBar } from "./trade-filters-bar";
import { TradesTable } from "./trades-table";

export function TradesView() {
  const { mode } = useDataMode();
  const { filters, update, reset, hasFilters, query } = useTradeFilters();
  const trades = useTrades(query);

  // A mode or filter change can leave the current page past the end.
  const total = trades.data?.total;
  useEffect(() => {
    if (total !== undefined && filters.page > 1 && (filters.page - 1) * filters.limit >= total) update({ page: 1 });
  }, [total, filters.page, filters.limit, update]);

  // Same filters and order as the table, all pages.
  const csvUrl = api.trades.exportCsvUrl({
    mode: query.mode,
    symbol: query.symbol,
    strategy: query.strategy,
    status: query.status,
    from: query.from,
    to: query.to,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });

  return (
    <>
      <PageHeader
        title="Trades"
        description="Todas as operações registradas pelo backend, com filtros, ordenação e paginação no servidor."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={csvUrl} download>
              <Download aria-hidden /> Exportar CSV
            </a>
          </Button>
        }
      />
      <div className="space-y-4">
        <SeedNotice mode={mode} />
        <TradeFiltersBar filters={filters} update={update} reset={reset} hasFilters={hasFilters} />

        <QueryState
          query={trades}
          loading={<Skeleton className="h-96 w-full" />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              icon={List}
              title={hasFilters ? "Nenhuma trade com esses filtros" : `Nenhuma trade em ${mode} ainda`}
              description={
                hasFilters
                  ? "Ajuste ou limpe os filtros para ver outras trades."
                  : mode === "BACKTEST"
                    ? "As trades de backtest aparecem aqui depois que você roda um backtest."
                    : "Cada operação que o bot abrir neste modo vai aparecer aqui."
              }
              action={
                hasFilters ? (
                  <Button variant="outline" size="sm" onClick={reset}>Limpar filtros</Button>
                ) : undefined
              }
            />
          }
        >
          {(data) => (
            <div className={cn("space-y-3 transition-opacity", trades.isPlaceholderData && "opacity-60")} aria-busy={trades.isFetching}>
              <TradesTable
                trades={data.items}
                sortBy={filters.sortBy}
                sortOrder={filters.sortOrder}
                onSortChange={(sortBy, sortOrder) => update({ sortBy, sortOrder, page: 1 })}
              />
              <Pagination
                page={filters.page}
                limit={filters.limit}
                total={data.total}
                pageSizes={PAGE_SIZES}
                onChange={update}
                busy={trades.isPlaceholderData}
              />
            </div>
          )}
        </QueryState>
      </div>
    </>
  );
}
