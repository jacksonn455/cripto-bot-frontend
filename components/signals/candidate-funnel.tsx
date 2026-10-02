"use client";

import { Filter, PauseCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { ModeBadge } from "@/components/mode/mode-badge";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCandidateFunnel } from "@/hooks/use-data";
import { useDataMode } from "@/hooks/use-data-mode";
import { useNow } from "@/hooks/use-now";
import { ApiError } from "@/lib/api/client";
import { formatNumber, withSign } from "@/lib/format";
import { CANDIDATE_STAGE_LABELS, REJECT_REASON_LABELS, type CandidateFilter, type ShadowStats } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 0, label: "Tudo" },
] as const;

/** "+0,35R" / "−1,20R". */
export function formatR(value: number | null): string {
  return value === null ? "—" : `${withSign(value, (abs) => formatNumber(abs, 2))}R`;
}

/** Shadow outcome of a group: "12 V / 30 D · média −0,25R" (+ how many are still open). */
function Shadow({ stats }: { stats: ShadowStats }) {
  if (stats.measured === 0) {
    return <span className="text-muted-foreground">{stats.pending ? `${stats.pending} em aberto` : "—"}</span>;
  }
  return (
    <span className="tabular-nums">
      {stats.wins} V / {stats.losses} D ·{" "}
      <span className={cn(stats.avgR !== null && (stats.avgR > 0 ? "text-profit" : "text-loss"))}>média {formatR(stats.avgR)}</span>
      {stats.pending > 0 && <span className="text-muted-foreground"> · {stats.pending} em aberto</span>}
    </span>
  );
}

/**
 * Where the opportunities go: every triggered setup (accepted or rejected) through the strategy
 * gates, the pause and the risk manager, with what the ones removed at each step would have done
 * (shadow outcome, same exit rules, no order). With `runId` it shows one backtest run's ledger;
 * otherwise the selected data mode over a period.
 */
export function CandidateFunnel({ runId }: { runId?: string } = {}) {
  const { mode } = useDataMode();
  const [days, setDays] = useState<number>(30);
  // Rounded to the hour so the query key (and the request) only moves once an hour.
  const hour = Math.floor(useNow(60_000) / 3_600_000) * 3_600_000;
  const filter = useMemo<CandidateFilter>(() => {
    if (runId) return { mode: "BACKTEST", runId };
    return { mode, ...(days ? { from: new Date(hour - days * 86_400_000).toISOString() } : {}) };
  }, [runId, mode, days, hour]);
  const funnel = useCandidateFunnel(filter);
  const unavailable = funnel.error instanceof ApiError && funnel.error.status === 404;
  const f = funnel.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Funil de oportunidades <ModeBadge mode={runId ? "BACKTEST" : mode} />
        </CardTitle>
        <CardDescription>
          Cada vez que um setup dispara (cruzamento das médias), o Krypto registra a oportunidade, aprovada ou não, e em que
          etapa ela parou. O resultado sombra mostra o que ela teria feito se tivesse sido operada, com as mesmas regras de
          saída. É só análise: nada aqui envia ordem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!runId && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
            {PERIODS.map((p) => (
              <Button key={p.days} size="sm" variant={days === p.days ? "default" : "outline"} onClick={() => setDays(p.days)} aria-pressed={days === p.days}>
                {p.label}
              </Button>
            ))}
          </div>
        )}

        {unavailable ? (
          <EmptyState icon={Filter} title="Funil indisponível" description="Este backend ainda não tem o ledger de candidatos (GET /candidates/funnel)." />
        ) : !f ? (
          funnel.isError ? (
            <ErrorState error={funnel.error} onRetry={() => void funnel.refetch()} retrying={funnel.isFetching} />
          ) : (
            <Skeleton className="h-48 w-full" />
          )
        ) : f.total === 0 ? (
          <EmptyState
            icon={Filter}
            title="Nenhuma oportunidade registrada"
            description={
              runId
                ? "Esta execução não gravou o ledger. Rode o backtest com “Registrar candidatos” marcado."
                : "Nenhum setup disparou no período (ou o ledger acabou de ser ligado)."
            }
          />
        ) : (
          <>
            <p className="text-sm">
              <strong className="tabular-nums">{f.total}</strong> oportunidades ({f.bySide.LONG} long, {f.bySide.SHORT} short) →{" "}
              <strong className="tabular-nums">{f.strategyAccepted}</strong> aprovadas pela estratégia →{" "}
              <strong className="tabular-nums">{f.entered}</strong> viraram trade.
            </p>

            {f.paused.blockedByPause > 0 && (
              <div role="status" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <PauseCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <p>
                  <strong>{f.paused.blockedByPause}</strong> entradas foram bloqueadas porque o bot estava pausado;{" "}
                  <strong>{f.paused.wouldTradeIfResumed}</strong> teriam sido aprovadas logo após um resume. Resultado sombra
                  delas: <Shadow stats={f.paused.blockedShadow} />.
                </p>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Chegaram</TableHead>
                    <TableHead className="text-right">Barradas aqui</TableHead>
                    <TableHead>Resultado sombra das barradas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {f.steps.map((s) => {
                    const meta = CANDIDATE_STAGE_LABELS[s.step] ?? { label: s.step, hint: "" };
                    return (
                      <TableRow key={s.step} className={cn(s.rejected === 0 && "text-muted-foreground")}>
                        <TableCell>
                          <span className="font-medium" title={meta.hint}>
                            {meta.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.entering}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.rejected}</TableCell>
                        <TableCell>{s.rejected > 0 ? <Shadow stats={s.rejectedShadow} /> : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell className="font-medium">Entraram</TableCell>
                    <TableCell className="text-right tabular-nums">{f.entered}</TableCell>
                    <TableCell />
                    <TableCell>
                      <Shadow stats={f.shadow.entered} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {Object.keys(f.riskRejectReasons).length > 0 && (
              <p className="text-sm text-muted-foreground">
                Vetos do risco:{" "}
                {Object.entries(f.riskRejectReasons)
                  .map(([reason, n]) => `${REJECT_REASON_LABELS[reason] ?? reason} (${n})`)
                  .join(" · ")}
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              Das barradas com resultado sombra, <span className="tabular-nums">{f.shadow.rejectedWinners}</span> teriam ganhado e{" "}
              <span className="tabular-nums">{f.shadow.rejectedLosers}</span> perdido (média {formatR(f.shadow.rejected.avgR)}, contra{" "}
              {formatR(f.shadow.entered.avgR)} das que entraram). R = resultado em múltiplos do risco inicial, já com custos.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
