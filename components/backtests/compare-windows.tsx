"use client";

import { AlertTriangle, Check, Minus, X } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PnlPercent } from "@/components/data/pnl";
import { useBacktestCompare } from "@/hooks/use-data";
import { formatRatio } from "@/lib/analytics";
import { formatDate, formatFraction, formatNumber } from "@/lib/format";
import type { RunComparison, WindowSide } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** The research doc's bar: the variant must win in at least 60% of the out-of-sample windows. */
export const WINDOW_WIN_BAR = 0.6;

const pf = (s: WindowSide) => formatRatio(s.profitFactor, s);

function Better({ value, label }: { value: boolean | null; label: string }) {
  if (value === null) return <Minus className="inline size-4 text-muted-foreground" aria-label={`${label}: sem trades para comparar`} />;
  return value ? (
    <Check className="inline size-4 text-profit" aria-label={`${label}: B melhor`} />
  ) : (
    <X className="inline size-4 text-muted-foreground" aria-label={`${label}: B não foi melhor`} />
  );
}

function Share({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  const clears = value !== null && value >= WINDOW_WIN_BAR;
  return (
    <div className={cn("space-y-0.5 rounded-lg border px-3 py-2", clears && "border-profit/40 bg-profit/10")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value === null ? "—" : formatFraction(value, 0)}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Windows({ c }: { c: RunComparison }) {
  const s = c.variantWinShare;
  const sides = (x: { LONG: number; SHORT: number }) => `${x.LONG} long · ${x.SHORT} short`;
  return (
    <div className="space-y-4">
      {c.warnings.length > 0 && (
        <ul role="note" className="space-y-1 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          {c.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {w}
            </li>
          ))}
        </ul>
      )}
      {c.sample.inconclusive && (
        <p role="note" className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <strong>Inconclusivo:</strong> algum lado tem menos de {c.sample.minTradesPerSide} trades (A: {sides(c.sample.baseline)}; B:{" "}
          {sides(c.sample.variant)}). Com amostra assim, a diferença entre as execuções pode ser acaso.
        </p>
      )}
      {c.windows.length === 0 ? (
        <EmptyState title="Nenhuma janela em comum" description="Rode A e B com o mesmo período e o mesmo tamanho de janela de walk-forward." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Share label="B com mais retorno" value={s.pnl} hint={`em ${s.windows} janela(s)`} />
            <Share label="B com profit factor maior" value={s.profitFactor} hint="janelas com trades nos dois" />
            <Share label="B com retorno médio por trade maior" value={s.expectancy} hint="expectância sem depender do tamanho" />
            <Share label="B melhor nos dois (PF e expectância)" value={s.profitFactorAndExpectancy} hint={`critério: ${formatFraction(WINDOW_WIN_BAR, 0)} ou mais`} />
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Janela</TableHead>
                  <TableHead className="text-right">Trades A / B</TableHead>
                  <TableHead className="text-right">Retorno A</TableHead>
                  <TableHead className="text-right">Retorno B</TableHead>
                  <TableHead className="text-right">PF A / B</TableHead>
                  <TableHead className="text-center">B melhor (retorno · PF · expectância)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.windows.map((w) => (
                  <TableRow key={w.from}>
                    <TableCell className="whitespace-nowrap">{formatDate(w.from)} – {formatDate(w.to)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(w.baseline.tradeCount, 0)} / {formatNumber(w.variant.tradeCount, 0)}</TableCell>
                    <TableCell className="text-right"><PnlPercent value={w.baseline.returnPct * 100} /></TableCell>
                    <TableCell className="text-right"><PnlPercent value={w.variant.returnPct * 100} /></TableCell>
                    <TableCell className="text-right tabular-nums">{pf(w.baseline)} / {pf(w.variant)}</TableCell>
                    <TableCell className="space-x-2 text-center">
                      <Better value={w.variantBetter.pnl} label="Retorno" />
                      <Better value={w.variantBetter.profitFactor} label="Profit factor" />
                      <Better value={w.variantBetter.expectancy} label="Expectância" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * A = baseline, B = variant. The decision rule from the research doc: judge only the
 * out-of-sample windows, never the total, and require the variant to win in most of them.
 */
export function CompareWindows({ baseline, variant }: { baseline: string; variant: string }) {
  const comparison = useBacktestCompare(baseline, variant);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Janela a janela (A = base, B = variante)</CardTitle>
        <CardDescription>
          Em quantas janelas de walk-forward a variante foi melhor. Um resultado total melhor que vem de uma janela só não conta: o
          critério é vencer em pelo menos {formatFraction(WINDOW_WIN_BAR, 0)} das janelas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState query={comparison} loading={<Skeleton className="h-48 w-full" />}>
          {(c) => <Windows c={c} />}
        </QueryState>
      </CardContent>
    </Card>
  );
}
