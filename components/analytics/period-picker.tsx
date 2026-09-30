"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const ANALYTICS_PERIODS = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "all", label: "Tudo" },
  { key: "custom", label: "Personalizado" },
] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]["key"];

interface Props {
  period: AnalyticsPeriod;
  customFrom: string;
  customTo: string;
  onChange: (patch: { period?: AnalyticsPeriod; customFrom?: string; customTo?: string }) => void;
}

export function PeriodPicker({ period, customFrom, customTo, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div role="group" aria-label="Período" className="flex flex-wrap rounded-lg border p-0.5">
        {ANALYTICS_PERIODS.map((p) => (
          <Button
            key={p.key}
            size="xs"
            variant="ghost"
            aria-pressed={period === p.key}
            onClick={() => onChange({ period: p.key })}
            className={cn(period === p.key && "bg-accent text-accent-foreground")}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="an-from" className="text-xs">De</Label>
            <Input id="an-from" type="date" value={customFrom} max={customTo || undefined} onChange={(e) => onChange({ customFrom: e.target.value })} className="h-7 w-38" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="an-to" className="text-xs">Até</Label>
            <Input id="an-to" type="date" value={customTo} min={customFrom || undefined} onChange={(e) => onChange({ customTo: e.target.value })} className="h-7 w-38" />
          </div>
        </div>
      )}
    </div>
  );
}
