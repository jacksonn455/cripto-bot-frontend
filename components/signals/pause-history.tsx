"use client";

import { PauseCircle } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePauseImpact } from "@/hooks/use-data";
import { ApiError } from "@/lib/api/client";
import { pauseReasonLabel } from "@/lib/bot-health";
import { formatDateTime, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatR } from "./candidate-funnel";

/**
 * Every pause of the bot (3 stops in a row, 3% daily loss, kill switch, manual): when it started,
 * when someone resumed it, and the entries it blocked meanwhile — with what they would have done.
 * The pause itself is a safety mechanism; this only measures its cost.
 */
export function PauseHistory() {
  const pauses = usePauseImpact();
  // Older backends don't have the endpoint: hide the card instead of showing an error.
  if (pauses.error instanceof ApiError && pauses.error.status === 404) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pausas do bot</CardTitle>
        <CardDescription>
          Depois de 3 stops seguidos ou 3% de perda no dia, o Krypto pausa e só volta com um resume manual. Aqui fica quanto
          tempo cada pausa durou e quantas entradas ela bloqueou.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pauses.data === undefined ? (
          pauses.isError ? (
            <ErrorState error={pauses.error} onRetry={() => void pauses.refetch()} retrying={pauses.isFetching} />
          ) : (
            <Skeleton className="h-24 w-full" />
          )
        ) : pauses.data.length === 0 ? (
          <EmptyState icon={PauseCircle} title="Nenhuma pausa registrada" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead className="text-right">Oportunidades</TableHead>
                  <TableHead className="text-right">Entradas bloqueadas</TableHead>
                  <TableHead className="text-right">Teriam entrado</TableHead>
                  <TableHead className="text-right">Sombra (soma)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pauses.data.map((p) => (
                  <TableRow key={p.pausedAt}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(p.pausedAt)}</TableCell>
                    <TableCell>
                      {pauseReasonLabel(p.reason)}
                      {p.additionalReasons.length > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          + {p.additionalReasons.map((r) => pauseReasonLabel(r.reason)).join(", ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDuration(p.durationMs)}
                      {p.resumedAt === null && <span className="block text-xs font-medium text-warning">em andamento</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.candidates}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.blockedByPause}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.wouldTradeIfResumed}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        p.blockedShadow.measured > 0 && (p.blockedShadow.sumR > 0 ? "text-profit" : "text-loss"),
                      )}
                    >
                      {p.blockedShadow.measured > 0 ? formatR(p.blockedShadow.sumR) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
