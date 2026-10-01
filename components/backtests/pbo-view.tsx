"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { runLabel } from "@/components/analytics/run-select";
import { Histogram } from "@/components/charts/histogram";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBacktestPbo, useBacktestRuns } from "@/hooks/use-data";
import { formatFraction, formatNumber, formatSignedPercent, MINUS } from "@/lib/format";
import { MAX_PBO_RUNS, type BacktestRun, type Pbo } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** Below this PBO, picking the best in-sample variant is mostly picking real edge. */
export const PBO_LOW = 0.2;
/** At or above a coin flip, the in-sample winner is no better than a random pick. */
export const PBO_HIGH = 0.5;

function Back() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
      <Link href="/backtests"><ArrowLeft aria-hidden /> Backtests</Link>
    </Button>
  );
}

export function pboReading(pbo: number): { tone: "good" | "warn" | "bad"; title: string; text: string } {
  if (pbo < PBO_LOW) {
    return {
      tone: "good",
      title: "Risco de overfitting baixo",
      text: "A variante que vai melhor na metade dos dados costuma continuar entre as melhores na outra metade.",
    };
  }
  if (pbo < PBO_HIGH) {
    return {
      tone: "warn",
      title: "Risco de overfitting moderado",
      text: "Em boa parte das divisões, a melhor variante no treino cai para a metade de baixo fora dele. Escolher a melhor destas variantes é arriscado.",
    };
  }
  return {
    tone: "bad",
    title: "Risco de overfitting alto",
    text: "Escolher a melhor variante no histórico não é melhor que sortear uma. As diferenças entre elas parecem ruído.",
  };
}

const TONE = {
  good: { box: "border-profit/40 bg-profit/10", icon: CheckCircle2, text: "text-profit" },
  warn: { box: "border-warning/50 bg-warning/10", icon: AlertTriangle, text: "text-warning" },
  bad: { box: "border-loss/40 bg-loss/10", icon: XCircle, text: "text-loss" },
} as const;

function Result({ pbo, runs }: { pbo: Pbo; runs: Map<string, BacktestRun> }) {
  const reading = pboReading(pbo.pbo);
  const tone = TONE[reading.tone];
  const Icon = tone.icon;
  const bins = pbo.logitHistogram.map((b) => {
    const first = Number(b.bucket.match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
    return { label: b.bucket.replace(/-/g, MINUS), count: b.count, tone: first < 0 ? ("loss" as const) : ("profit" as const) };
  });
  return (
    <div className="space-y-6">
      <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", tone.box)}>
        <Icon className={cn("mt-0.5 size-5 shrink-0", tone.text)} aria-hidden />
        <div>
          <p className="font-semibold">
            PBO {formatFraction(pbo.pbo, 0)}: {reading.title}
          </p>
          <p className="text-sm text-muted-foreground">{reading.text}</p>
        </div>
      </div>

      {(pbo.warnings.length > 0 || pbo.approximated) && (
        <ul role="note" className="space-y-1 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          {pbo.warnings.map((w) => <li key={w}>{w}</li>)}
          {pbo.approximated && <li>Algumas janelas são de execuções antigas: o retorno delas foi estimado sobre o saldo inicial.</li>}
        </ul>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Divisões testadas", value: formatNumber(pbo.combinations, 0), hint: `${pbo.windows} janelas em ${pbo.blocks} blocos` },
          { label: "Melhor no treino perdeu fora", value: formatFraction(pbo.probOosLoss, 0), hint: "Retorno negativo na outra metade" },
          { label: "Retorno médio no treino", value: formatSignedPercent(pbo.meanInSampleReturn * 100), hint: "Da variante escolhida" },
          { label: "Retorno médio fora do treino", value: formatSignedPercent(pbo.meanOutOfSampleReturn * 100), hint: "A queda aqui é o custo de escolher" },
        ].map((i) => (
          <div key={i.label} className="space-y-0.5 rounded-lg border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{i.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{i.value}</dd>
            <dd className="text-xs text-muted-foreground">{i.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Posição da melhor variante fora do treino</CardTitle>
            <CardDescription>
              Logit da posição relativa (λ). Abaixo de 0 = a melhor no treino ficou na metade de baixo fora dele. O PBO é a fração das divisões
              nessa região.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Histogram bins={bins} ariaLabel="Histograma do logit da posição fora do treino" binTitle="λ" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quem foi escolhida</CardTitle>
            <CardDescription>Quantas vezes cada variante foi a melhor na metade de treino.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variante</TableHead>
                    <TableHead className="text-right">Escolhida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...pbo.selected].sort((x, y) => y.count - x.count).map((s) => {
                    const run = runs.get(s.runId);
                    return (
                      <TableRow key={s.runId}>
                        <TableCell>
                          <Link href={`/backtests/${encodeURIComponent(s.runId)}`} className="underline-offset-4 hover:underline">
                            {run ? runLabel(run) : s.runId}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(s.count, 0)} <span className="text-xs text-muted-foreground">({formatFraction(s.count / pbo.combinations, 0)})</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Probability of Backtest Overfitting (Bailey, Borwein, López de Prado & Zhu 2015) over the
 * selected variants: every half/half split of the walk-forward windows picks the best variant on
 * one half and checks where it lands on the other.
 */
export function PboView({ runIds }: { runIds: string[] }) {
  const pbo = useBacktestPbo(runIds);
  const allRuns = useBacktestRuns();
  const runs = new Map((allRuns.data ?? []).map((r) => [r.runId, r]));

  return (
    <>
      <Back />
      <PageHeader
        showDataMode={false}
        title="Risco de overfitting (PBO)"
        description="Se você escolher a melhor destas variantes olhando o histórico, qual a chance de ter escolhido ruído?"
      />
      {runIds.length < 2 ? (
        <EmptyState
          title="Escolha as variantes"
          description={`Na lista de backtests, marque de 2 a ${MAX_PBO_RUNS} execuções do mesmo período e com o mesmo tamanho de janela de walk-forward.`}
        />
      ) : (
        <QueryState query={pbo} loading={<Skeleton className="h-96 w-full" />}>
          {(data) => <Result pbo={data} runs={runs} />}
        </QueryState>
      )}
    </>
  );
}
