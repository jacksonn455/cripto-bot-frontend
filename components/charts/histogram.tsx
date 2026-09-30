"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";
import { roundedBarShape } from "./bar-shape";

export interface HistogramBin {
  label: string;
  count: number;
  /** Which side of zero the bin covers; colors the bar (the label carries the sign too). */
  tone: "loss" | "profit";
}

interface HistogramProps {
  bins: HistogramBin[];
  height?: number;
  ariaLabel: string;
}

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

/** Adjacent bins with a 2px surface gap; counts labeled on the caps (few bins). */
export function Histogram({ bins, height = 240, ariaLabel }: HistogramProps) {
  const total = bins.reduce((s, b) => s + b.count, 0);
  const shape = roundedBarShape("vertical", (_v, i) => (bins[i]?.tone === "loss" ? "var(--loss)" : "var(--profit)"));

  const tooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: HistogramBin }> }) => {
    const b = payload?.[0]?.payload;
    if (!active || !b) return null;
    return (
      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
        <p className="mb-1 font-medium">PnL por trade: {b.label}</p>
        <p>
          <strong className="tabular-nums">{b.count}</strong> trade(s)
          {total > 0 && <span className="text-muted-foreground"> · {formatNumber((b.count / total) * 100, 0)}%</span>}
        </p>
      </div>
    );
  };

  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={tooltip} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          <Bar dataKey="count" shape={shape} isAnimationActive={false}>
            <LabelList dataKey="count" position="top" style={{ fill: "var(--foreground)", fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
