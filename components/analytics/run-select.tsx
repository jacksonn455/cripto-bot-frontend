"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime } from "@/lib/format";
import type { BacktestRun } from "@/lib/schemas";

export const ALL_RUNS = "__all__";

export function runLabel(run: BacktestRun): string {
  return `${run.symbols.join(", ")} ${run.timeframe} · ${formatDate(run.from)}–${formatDate(run.to)} · ${formatDateTime(run.createdAt)}`;
}

interface Props {
  id: string;
  runs: BacktestRun[];
  value: string;
  onChange: (runId: string) => void;
  label?: string;
}

/** Picks one backtest execution (or all of them). */
export function RunSelect({ id, runs, value, onChange, label = "Execução de backtest" }: Props) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} size="sm" className="w-full max-w-md sm:w-96">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_RUNS}>Todas as execuções ({runs.length})</SelectItem>
          {runs.map((r) => (
            <SelectItem key={r.runId} value={r.runId}>
              {r.strategy} · {runLabel(r)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
