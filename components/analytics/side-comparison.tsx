"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pnl, PnlPercent } from "@/components/data/pnl";
import { MINUS, formatFraction, formatMoney, formatNumber } from "@/lib/format";
import type { MetricsSummary, SideMetrics } from "@/lib/schemas";

/** Below this many trades a side's numbers are noise (same threshold the strategy research uses). */
export const MIN_TRADES_FOR_CONCLUSION = 30;

export function sideProfitFactor(s: SideMetrics): string {
  if (s.tradeCount === 0) return "—";
  if (s.winCount === s.tradeCount) return "∞";
  return formatNumber(s.profitFactor, 2);
}

/** Why a comparison can't be read yet, or null when both sides have enough trades. */
export function sideSampleWarning(bySide: { LONG: SideMetrics; SHORT: SideMetrics }): string | null {
  const small = (["LONG", "SHORT"] as const).filter((k) => bySide[k].tradeCount > 0 && bySide[k].tradeCount < MIN_TRADES_FOR_CONCLUSION);
  if (small.length === 0) return null;
  return `Amostra pequena em ${small.join(" e ")} (menos de ${MIN_TRADES_FOR_CONCLUSION} trades): ainda não dá para concluir qual lado é melhor.`;
}

/**
 * LONG and SHORT side by side. Long and short are not symmetric in crypto (funding, squeezes,
 * long-term upward drift), so they are always shown separately instead of only blended.
 * Renders nothing on backends/runs that predate per-side metrics.
 */
export function SideComparison({ summary, description }: { summary: MetricsSummary; description?: string }) {
  const bySide = summary.bySide;
  if (!bySide) return null;
  const warning = sideSampleWarning(bySide);
  const hasShorts = bySide.SHORT.tradeCount > 0;

  const rows: Array<{ label: string; render: (s: SideMetrics) => React.ReactNode }> = [
    { label: "Trades", render: (s) => formatNumber(s.tradeCount, 0) },
    { label: "Win rate", render: (s) => (s.tradeCount ? formatFraction(s.winRate, 1) : "—") },
    { label: "PnL total", render: (s) => (s.tradeCount ? <Pnl value={s.totalPnl} /> : "—") },
    { label: "Profit factor", render: sideProfitFactor },
    { label: "Expectancy (por trade)", render: (s) => (s.tradeCount ? <Pnl value={s.expectancy} /> : "—") },
    { label: "Retorno médio", render: (s) => (s.tradeCount ? <PnlPercent value={s.avgReturnPct} /> : "—") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Long vs Short</CardTitle>
        <CardDescription>
          {description ?? "Mesmas métricas separadas por lado: em cripto os dois lados não se comportam igual, então avalie cada um."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Long</TableHead>
                <TableHead className="text-right">Short</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.render(bySide.LONG)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.render(bySide.SHORT)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {(summary.grossProfit != null || summary.totalFees != null) && (
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {summary.grossProfit != null && (
              <div><dt className="text-xs text-muted-foreground">Lucro bruto</dt><dd><Pnl value={summary.grossProfit} /></dd></div>
            )}
            {summary.grossLoss != null && (
              <div>
                <dt className="text-xs text-muted-foreground">Prejuízo bruto</dt>
                <dd className="tabular-nums text-loss">{summary.grossLoss > 0 ? `${MINUS}${formatMoney(summary.grossLoss)}` : formatMoney(0)}</dd>
              </div>
            )}
            {summary.totalFees != null && (
              <div><dt className="text-xs text-muted-foreground">Taxas pagas</dt><dd className="tabular-nums">{formatMoney(summary.totalFees)}</dd></div>
            )}
          </dl>
        )}
        {!hasShorts && (
          <p className="text-xs text-muted-foreground">
            Nenhum short neste recorte. O short fica desligado por padrão (TREND_ALLOW_SHORT). Para medir, rode um backtest com
            “Incluir Short” e compare com o mesmo backtest sem.
          </p>
        )}
        {warning && <p className="text-xs text-warning">{warning}</p>}
      </CardContent>
    </Card>
  );
}
