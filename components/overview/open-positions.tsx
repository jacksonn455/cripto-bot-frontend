"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { Pnl } from "@/components/data/pnl";
import { SeedBadge } from "@/components/data/seed-badge";
import { ModeBadge } from "@/components/mode/mode-badge";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLastPrices, useTrades } from "@/hooks/use-data";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { unrealizedPnl } from "@/lib/positions";
import { POLL_MS } from "@/lib/query";
import type { Mode, Trade } from "@/lib/schemas";

const MAX_ROWS = 50;

/** Prices shown with enough decimals for both BTC (60 000) and small caps (0,0001). */
function formatPrice(v: number) {
  return formatNumber(v, v >= 100 ? 2 : v >= 1 ? 4 : 6);
}

export function OpenPositions({ mode }: { mode: Mode }) {
  const trades = useTrades(
    { mode, status: "OPEN", limit: MAX_ROWS, sortBy: "entryTime", sortOrder: "desc" },
    { refetchInterval: POLL_MS.openPositions },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Posições abertas <ModeBadge mode={mode} />
        </CardTitle>
        <CardDescription>
          Atualiza a cada 10 s e na hora em que o bot abre ou fecha uma trade. O PnL não realizado é uma estimativa pelo
          último preço de 1 min, sem taxas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState
          query={trades}
          loading={<Skeleton className="h-24 w-full" />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              icon={Wallet}
              title="Nenhuma posição aberta"
              description={
                mode === "BACKTEST"
                  ? "Backtests terminam com todas as posições fechadas."
                  : `O bot não tem posições abertas em ${mode} agora.`
              }
            />
          }
        >
          {(data) => <PositionsTable trades={data.items} total={data.total} />}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function PositionsTable({ trades, total }: { trades: Trade[]; total: number }) {
  const now = useNow(30_000);
  const prices = useLastPrices(trades.map((t) => t.symbol));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Símbolo</TableHead>
              <TableHead>Lado</TableHead>
              <TableHead>Estratégia</TableHead>
              <TableHead className="text-right">Entrada</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Stop</TableHead>
              <TableHead className="text-right">Alvo</TableHead>
              <TableHead className="text-right">Último preço</TableHead>
              <TableHead className="text-right">PnL não realizado</TableHead>
              <TableHead className="text-right">Aberta há</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((t) => {
              const last = prices.get(t.symbol);
              const est = last ? unrealizedPnl(t, last.price) : null;
              return (
                <TableRow key={t._id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Link href={`/trades/${t._id}`} className="underline-offset-4 hover:underline">
                        {t.symbol}
                      </Link>
                      {t.isSeed && <SeedBadge />}
                    </span>
                  </TableCell>
                  <TableCell>{t.side}</TableCell>
                  <TableCell className="text-muted-foreground">{t.strategy}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPrice(t.entryPrice)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(t.qty, 6)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPrice(t.stopLoss)}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.takeProfit != null ? formatPrice(t.takeProfit) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{last ? formatPrice(last.price) : "—"}</TableCell>
                  <TableCell className="text-right">
                    {est ? <Pnl value={est.pnl} percent={est.pnlPct} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap" title={formatDateTime(t.entryTime)}>
                    {formatDuration(now - new Date(t.entryTime).getTime())}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {total > trades.length && (
        <p className="text-xs text-muted-foreground">
          Mostrando {trades.length} de {total}. Veja todas em <Link href="/trades" className="underline">Trades</Link>.
        </p>
      )}
    </div>
  );
}
