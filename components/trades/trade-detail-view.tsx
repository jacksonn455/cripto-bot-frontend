"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Pnl, PnlPercent } from "@/components/data/pnl";
import { SeedBadge } from "@/components/data/seed-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ModeBadge } from "@/components/mode/mode-badge";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrade } from "@/hooks/use-data";
import { useDataMode } from "@/hooks/use-data-mode";
import { useNow } from "@/hooks/use-now";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, formatDuration, formatMoney, formatNumber } from "@/lib/format";
import type { Trade } from "@/lib/schemas";
import { exitReasonLabel, priceDigits, tradeDurationMs } from "@/lib/trades";
import { TradeChart } from "./trade-chart";

const price = (v: number | null | undefined) => (v == null ? "—" : formatNumber(v, priceDigits(v)));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm tabular-nums">{children}</dd>
    </div>
  );
}

function BackButton() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
      <Link href="/trades">
        <ArrowLeft aria-hidden /> Trades
      </Link>
    </Button>
  );
}

export function TradeDetailView({ id }: { id: string }) {
  const trade = useTrade(id);

  if (!trade.data) {
    return (
      <>
        <BackButton />
        {trade.isError ? (
          <ErrorState
            error={
              trade.error instanceof ApiError && trade.error.status === 404
                ? new ApiError("http", "Essa trade não existe ou foi apagada.", 404)
                : trade.error
            }
            onRetry={trade.error instanceof ApiError && trade.error.status === 404 ? undefined : () => void trade.refetch()}
            retrying={trade.isFetching}
          />
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-105 w-full" />
          </div>
        )}
      </>
    );
  }
  return <TradeDetail trade={trade.data} />;
}

function TradeDetail({ trade }: { trade: Trade }) {
  const now = useNow(30_000);
  const { mode } = useDataMode();
  const open = trade.status === "OPEN";

  return (
    <>
      <BackButton />
      <PageHeader
        showDataMode={false}
        title={`${trade.symbol} · ${trade.side}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ModeBadge mode={trade.mode} />
            {trade.isSeed && <SeedBadge />}
            {trade.strategy} · {open ? "posição aberta" : `fechada por ${exitReasonLabel(trade.exitReason).toLowerCase()}`}
          </span>
        }
      />
      <div className="space-y-6">
        {trade.mode !== mode && (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            Esta trade é de <strong>{trade.mode}</strong>; o filtro de dados está em <strong>{mode}</strong>.
          </p>
        )}
        {trade.isSeed && (
          <p className="rounded-md border border-dashed border-warning/60 bg-warning/10 px-3 py-2 text-sm">
            Trade fictícia do seed: os preços dela não batem com os candles reais do gráfico.
          </p>
        )}

        <Card>
          <CardContent>
            <TradeChart trade={trade} now={now} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados da trade</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Status">{open ? "Aberta" : "Fechada"}</Field>
              <Field label="Lado">{trade.side === "SHORT" ? "Short (vendido)" : "Long (comprado)"}</Field>
              <Field label="PnL">{open ? <span className="text-muted-foreground">Em aberto</span> : <Pnl value={trade.pnl} />}</Field>
              <Field label="PnL %">{open ? "—" : <PnlPercent value={trade.pnlPct} />}</Field>
              <Field label="Duração">
                {formatDuration(tradeDurationMs(trade, now))}
                {open && " (até agora)"}
              </Field>
              <Field label="Preço de entrada">{price(trade.entryPrice)}</Field>
              <Field label="Entrada em">{formatDateTime(trade.entryTime)}</Field>
              <Field label="Preço de saída">{price(trade.exitPrice)}</Field>
              <Field label="Saída em">{trade.exitTime ? formatDateTime(trade.exitTime) : "—"}</Field>
              <Field label="Quantidade">{formatNumber(trade.qty, 6)}</Field>
              <Field label="Valor na entrada">{formatMoney(trade.entryPrice * trade.qty)}</Field>
              <Field label="Taxas">{formatMoney(trade.fees)}</Field>
              <Field label="Motivo de saída">{exitReasonLabel(trade.exitReason)}</Field>
              <Field label="Stop loss">{price(trade.stopLoss)}</Field>
              <Field label="Alvo (take profit)">{price(trade.takeProfit)}</Field>
              <Field label="Pior momento (MAE)">
                {trade.maxAdverseExcursion != null ? <Pnl value={trade.maxAdverseExcursion} /> : "—"}
              </Field>
              <Field label="Melhor momento (MFE)">
                {trade.maxFavorableExcursion != null ? <Pnl value={trade.maxFavorableExcursion} /> : "—"}
              </Field>
              <Field label="Estratégia">{trade.strategy}</Field>
              {trade.timeframe && <Field label="Timeframe">{trade.timeframe}</Field>}
              {trade.runId && (
                <Field label="Execução de backtest">
                  <code className="text-xs break-all">{trade.runId}</code>
                </Field>
              )}
              <Field label="ID">
                <code className="text-xs break-all">{trade._id}</code>
              </Field>
            </dl>
            {trade.entryReason && (
              <p className="mt-4 border-t pt-3 text-sm">
                <span className="text-xs text-muted-foreground">Motivo da entrada: </span>
                {trade.entryReason}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
