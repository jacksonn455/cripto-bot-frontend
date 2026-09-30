"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDataMode } from "@/hooks/use-data-mode";
import { MODE_META } from "@/lib/mode";
import { MODES, type Mode } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";

const DOT: Record<Mode, string> = {
  PAPER: "bg-mode-paper",
  LIVE: "bg-mode-live",
  BACKTEST: "bg-mode-backtest",
};

/** Global filter: which mode's data every screen shows. There is intentionally no "all modes". */
export function DataModeSelect({ className, id = "data-mode", label = "Dados:", hideLabel = false }: { className?: string; id?: string; label?: string; hideLabel?: boolean }) {
  const { mode, setMode } = useDataMode();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label htmlFor={id} className={cn("text-xs whitespace-nowrap text-muted-foreground", hideLabel && "sr-only")}>
        {label}
      </Label>
      <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <SelectTrigger id={id} size="sm" className="w-32.5 font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODES.map((m) => (
            <SelectItem key={m} value={m}>
              <span className={cn("size-2 rounded-full", DOT[m])} aria-hidden />
              {MODE_META[m].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
