"use client";

import { Info } from "lucide-react";
import { StatCard } from "@/components/data/stat-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COMPARISON_METRICS, type ComparisonMetricKey } from "@/lib/analytics";
import { formatMoney, MINUS, toneOf } from "@/lib/format";
import type { MetricsSummary } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const SIGNED: ComparisonMetricKey[] = ["totalPnl", "expectancy", "avgReturnPct"];
const TONE = { profit: "text-profit", loss: "text-loss", neutral: "" } as const;

function Help({ text, label }: { text: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`O que é ${label}`} className="text-muted-foreground hover:text-foreground">
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}

export function MetricsGrid({ summary }: { summary: MetricsSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {COMPARISON_METRICS.map((m) => {
        const signedValue = SIGNED.includes(m.key) ? (summary[m.key] as number | null | undefined) : undefined;
        return (
          <StatCard
            key={m.key}
            label={m.label}
            value={
              <span className={cn(summary.tradeCount > 0 && signedValue != null && TONE[toneOf(signedValue)])}>
                {m.format(summary)}
              </span>
            }
            hint={<Help text={m.help} label={m.label} />}
          />
        );
      })}
      <StatCard
        label="Max drawdown"
        value={summary.maxDrawdown > 0 ? <span className="text-loss">{`${MINUS}${formatMoney(summary.maxDrawdown)}`}</span> : "—"}
        hint={<Help label="Max drawdown" text="Maior queda do PnL acumulado (trades fechadas, em ordem de saída) desde um pico." />}
      />
    </div>
  );
}
