"use client";

import Link from "next/link";
import { Pnl, PnlPercent } from "@/components/data/pnl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { readRun } from "@/lib/backtest-explain";
import { formatDate, formatDateTime, formatFraction, formatNumber, MINUS } from "@/lib/format";
import { MAX_PBO_RUNS, type BacktestRun } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { TONE_ICON, TONE_TEXT } from "./run-reading";

interface Props {
  runs: BacktestRun[];
  selected: string[];
  onToggle: (runId: string) => void;
}

/** Two selected runs = side-by-side comparison; 2 to MAX_PBO_RUNS = the PBO of those variants. */
export function RunsTable({ runs, selected, onToggle }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"><span className="sr-only">Comparar</span></TableHead>
            <TableHead>Execução</TableHead>
            <TableHead>Moedas</TableHead>
            <TableHead>Período</TableHead>
            <TableHead className="text-right">Trades</TableHead>
            <TableHead className="text-right">Resultado</TableHead>
            <TableHead className="text-right" title="Quanto teria dado só comprar no início e vender no fim">
              Comprar e segurar
            </TableHead>
            <TableHead className="text-right" title="Maior queda do saldo a partir de um topo">
              Pior queda
            </TableHead>
            <TableHead>Leitura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((r) => {
            const s = r.summary;
            const reading = readRun(r);
            const checked = selected.includes(r.runId);
            const disabled = !checked && selected.length >= MAX_PBO_RUNS;
            const Icon = TONE_ICON[reading.verdict.tone];
            return (
              <TableRow key={r.runId} data-state={checked ? "selected" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggle(r.runId)}
                    aria-label={`Selecionar ${r.symbols.join(", ")} ${r.timeframe} de ${formatDateTime(r.createdAt)} para comparar`}
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/backtests/${encodeURIComponent(r.runId)}`} className="font-medium underline-offset-4 hover:underline">
                    {formatDateTime(r.createdAt)}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.strategy}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.symbols.join(", ")} · {r.timeframe}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(r.from)} – {formatDate(r.to)}
                  <div className="text-xs">{reading.days} dias</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(s.tradeCount, 0)}</TableCell>
                <TableCell className="text-right">
                  <PnlPercent value={s.tradeCount ? reading.returnPct : null} />
                  <div className="text-xs"><Pnl value={s.tradeCount ? s.totalPnl : null} /></div>
                </TableCell>
                <TableCell className="text-right">
                  {reading.buyAndHoldPct === null ? (
                    <span className="text-muted-foreground" title="Execução anterior a essa comparação">—</span>
                  ) : (
                    <PnlPercent value={reading.buyAndHoldPct} />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.tradeCount && s.maxDrawdownPct ? `${MINUS}${formatFraction(s.maxDrawdownPct, 1)}` : "—"}
                </TableCell>
                <TableCell>
                  <span className={cn("inline-flex items-center gap-1.5 text-sm whitespace-nowrap", TONE_TEXT[reading.verdict.tone])} title={reading.verdict.text}>
                    <Icon className="size-4" aria-hidden />
                    {reading.verdict.title}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
