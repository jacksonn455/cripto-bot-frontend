"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { DataModeSelect } from "@/components/mode/data-mode-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFilterSuggestions } from "@/hooks/use-data";
import { useDataMode } from "@/hooks/use-data-mode";
import type { TradeFilters } from "@/hooks/use-trade-filters";
import { PERIOD_PRESETS, type PeriodKey } from "@/lib/trades";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "OPEN", label: "Abertas" },
  { value: "CLOSED", label: "Fechadas" },
] as const;

/** Text input that commits to the URL after the user stops typing. */
function DebouncedInput({
  id,
  value,
  onCommit,
  ...props
}: { id: string; value: string; onCommit: (v: string) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  // Follow external changes (e.g. "Limpar filtros") without an effect: adjust state during render.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onCommit(draft), 400);
    return () => clearTimeout(t);
  }, [draft, value, onCommit]);
  return <Input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} {...props} />;
}

interface Props {
  filters: TradeFilters;
  update: (patch: Partial<TradeFilters>) => void;
  reset: () => void;
  hasFilters: boolean;
}

export function TradeFiltersBar({ filters, update, reset, hasFilters }: Props) {
  const { mode } = useDataMode();
  const suggestions = useFilterSuggestions(mode);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3" role="search" aria-label="Filtros de trades">
      <div className="space-y-1.5">
        <span aria-hidden className="block text-xs font-medium">Modo</span>
        <DataModeSelect id="f-mode" label="Modo" hideLabel />
      </div>

      <div className="w-36 space-y-1.5">
        <Label htmlFor="f-symbol" className="text-xs">Símbolo</Label>
        <DebouncedInput
          id="f-symbol"
          value={filters.symbol}
          onCommit={(symbol) => update({ symbol })}
          placeholder="BTCUSDT"
          list="f-symbol-list"
          autoComplete="off"
          className="h-8 uppercase placeholder:normal-case"
        />
        <datalist id="f-symbol-list">
          {suggestions.symbols.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>

      <div className="w-48 space-y-1.5">
        <Label htmlFor="f-strategy" className="text-xs">Estratégia</Label>
        <DebouncedInput
          id="f-strategy"
          value={filters.strategy}
          onCommit={(strategy) => update({ strategy })}
          placeholder="Todas"
          list="f-strategy-list"
          autoComplete="off"
          className="h-8"
        />
        <datalist id="f-strategy-list">
          {suggestions.strategies.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-status" className="text-xs">Status</Label>
        <Select value={filters.status || "all"} onValueChange={(v) => update({ status: v === "all" ? "" : (v as "OPEN" | "CLOSED") })}>
          <SelectTrigger id="f-status" size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-period" className="text-xs">Período (entrada)</Label>
        <Select value={filters.period} onValueChange={(v) => update({ period: v as PeriodKey })}>
          <SelectTrigger id="f-period" size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filters.period === "custom" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="f-from" className="text-xs">De</Label>
            <Input
              id="f-from"
              type="date"
              value={filters.customFrom}
              max={filters.customTo || undefined}
              onChange={(e) => update({ customFrom: e.target.value })}
              className="h-8 w-38"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-to" className="text-xs">Até</Label>
            <Input
              id="f-to"
              type="date"
              value={filters.customTo}
              min={filters.customFrom || undefined}
              onChange={(e) => update({ customTo: e.target.value })}
              className="h-8 w-38"
            />
          </div>
        </>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset} className="mb-0.5">
          <X aria-hidden /> Limpar filtros
        </Button>
      )}
    </div>
  );
}
