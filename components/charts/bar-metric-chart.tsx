"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { roundedBarShape } from "./bar-shape";

export interface BarDatum {
  label: string;
  value: number;
  /** Extra tooltip lines (text tokens only). */
  details?: Array<[string, ReactNode]>;
  /** Rendered as "sem trades" and drawn as a gap. */
  empty?: boolean;
}

interface BarMetricChartProps {
  data: BarDatum[];
  /** "horizontal" = one row per category (long labels, e.g. strategies); "vertical" = columns. */
  orientation?: "horizontal" | "vertical";
  valueLabel: string;
  formatValue: (v: number) => string;
  /** Compact tick format; defaults to formatValue. */
  formatTick?: (v: number) => string;
  /** Direct-label format (keep it short, no unit); defaults to formatValue. */
  formatLabel?: (v: number) => string;
  /** "sign": profit/loss colors by sign (values are signed in labels too). "single": one hue. */
  color?: "sign" | "single";
  /** Direct value labels at the bar tips; keep for small category counts only. */
  showValueLabels?: boolean;
  height?: number;
  ariaLabel: string;
}

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
const BAR_SIZE = 24;

export function BarMetricChart({
  data,
  orientation = "vertical",
  valueLabel,
  formatValue,
  formatTick = formatValue,
  formatLabel = formatValue,
  color = "sign",
  showValueLabels = false,
  height,
  ariaLabel,
}: BarMetricChartProps) {
  const horizontal = orientation === "horizontal";
  const fill = (v: number) => (color === "single" ? "var(--series-1)" : v < 0 ? "var(--loss)" : "var(--profit)");
  const shape = roundedBarShape(horizontal ? "horizontal" : "vertical", fill);
  const chartHeight = height ?? (horizontal ? Math.max(120, data.length * 40 + 40) : 240);
  const hasNegative = data.some((d) => d.value < 0);

  const tooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: BarDatum }> }) => {
    const d = payload?.[0]?.payload;
    if (!active || !d) return null;
    return (
      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
        <p className="mb-1 font-medium">{d.label}</p>
        {d.empty ? (
          <p className="text-muted-foreground">Sem trades</p>
        ) : (
          <>
            <p>
              {valueLabel}: <strong className="tabular-nums">{formatValue(d.value)}</strong>
            </p>
            {d.details?.map(([k, v]) => (
              <p key={k} className="text-muted-foreground">
                {k}: <span className="text-popover-foreground tabular-nums">{v}</span>
              </p>
            ))}
          </>
        )}
      </div>
    );
  };

  const valueAxis = horizontal ? (
    <XAxis type="number" tickFormatter={formatTick} tick={AXIS_TICK} axisLine={false} tickLine={false} />
  ) : (
    <YAxis type="number" tickFormatter={formatTick} tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} />
  );
  const categoryAxis = horizontal ? (
    <YAxis type="category" dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} width={140} interval={0} />
  ) : (
    <XAxis type="category" dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={4} />
  );

  return (
    <div style={{ height: chartHeight }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: showValueLabels ? 64 : 8, bottom: 0, left: 0 }}
          barCategoryGap={2}
        >
          <CartesianGrid horizontal={!horizontal} vertical={horizontal} stroke="var(--border)" />
          {valueAxis}
          {categoryAxis}
          {hasNegative && (horizontal ? <ReferenceLine x={0} stroke="var(--muted-foreground)" /> : <ReferenceLine y={0} stroke="var(--muted-foreground)" />)}
          <Tooltip content={tooltip} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          <Bar dataKey="value" maxBarSize={BAR_SIZE} shape={shape} isAnimationActive={false}>
            {showValueLabels && (
              <LabelList
                dataKey="value"
                position={horizontal ? "right" : "top"}
                formatter={(v: unknown) => (typeof v === "number" ? formatLabel(v) : "")}
                style={{ fill: "var(--foreground)", fontSize: 12 }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
