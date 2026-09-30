"use client";

import { Radio } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ModeBadge } from "@/components/mode/mode-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNow } from "@/hooks/use-now";
import { useStrategies } from "@/hooks/use-data";
import { SIGNAL_ACTION_LABELS } from "@/lib/bot-health";
import { NO_ENTRY_TOOLTIP, rangesFromParams, translateReason } from "@/lib/strategy-explain";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { BotStatus } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const ACTION_CLASS: Record<string, string> = {
  ENTER_LONG: "border-profit/50 text-profit",
  ENTER_SHORT: "border-profit/50 text-profit",
  EXIT: "border-loss/50 text-loss",
};

export function LastSignals({ status }: { status: BotStatus }) {
  const now = useNow(10_000);
  const strategies = useStrategies();
  const ranges = rangesFromParams(strategies.data?.strategies.find((x) => x.name === strategies.data?.live.strategy)?.params);
  const entries = Object.entries(status.lastSignalBySymbol).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Último sinal por símbolo <ModeBadge mode={status.mode} />
        </CardTitle>
        <CardDescription>Decisão da estratégia no último candle fechado. Fica só em memória no backend e zera quando ele reinicia.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="Nenhum sinal ainda"
            description="O backend não avaliou nenhum candle desde que iniciou."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Símbolo</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Horário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(([symbol, s]) => (
                  <TableRow key={symbol}>
                    <TableCell className="font-medium">{symbol}</TableCell>
                    <TableCell>
                      <span
                        className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", ACTION_CLASS[s.action])}
                        title={s.action === "HOLD" ? NO_ENTRY_TOOLTIP : s.action}
                      >
                        {SIGNAL_ACTION_LABELS[s.action] ?? s.action}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-48 whitespace-normal text-muted-foreground">{translateReason(s.reason, ranges)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <time dateTime={s.at} title={formatDateTime(s.at)}>
                        {formatRelative(s.at, now)}
                      </time>
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
