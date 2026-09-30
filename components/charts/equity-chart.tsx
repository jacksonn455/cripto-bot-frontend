"use client";

import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downsample, equityStats, withDrawdown, type EquityPoint } from "@/lib/equity";
import { formatDateTime, formatFraction, formatMoney, formatNumber, MINUS } from "@/lib/format";

interface EquityChartProps {
  /** Ascending by time, e.g. equity_snapshots. */
  series: Array<{ timestamp: string; equity: number }>;
  /** Height of the equity panel; the drawdown panel below is ~40% of it. */
  height?: number;
  label?: string;
}

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function timeTickFormatter(spanMs: number) {
  const fmt =
    spanMs > 2 * 86_400_000
      ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" })
      : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (t: number) => fmt.format(t);
}

const pct = (v: number, digits = 1) => (v < 0 ? `${MINUS}${formatFraction(-v, digits)}` : formatFraction(v, digits));

/** Padded y-domain + tick precision from the visible range, so a flat series never repeats ticks. */
function equityAxis(points: EquityPoint[]) {
  const values = points.map((p) => p.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.1, Math.abs(max) * 0.001, 1);
  const lo = min - pad;
  const hi = max + pad;
  const span = hi - lo;
  const format = span >= 10_000 ? (v: number) => compact.format(v) : (v: number) => formatNumber(v, span < 10 ? 2 : 0);
  return { domain: [lo, hi] as [number, number], format };
}

/**
 * Equity curve with its drawdown as a separate area chart below (one y-axis each, shared time
 * axis and synced crosshair). Drawdown is from the running peak of the series shown.
 */
export function EquityChart({ series, height = 260, label = "Curva de capital" }: EquityChartProps) {
  const syncId = useId();
  const points = useMemo(() => withDrawdown(series), [series]);
  const display = useMemo(() => downsample(points), [points]);
  const stats = useMemo(() => equityStats(points), [points]);
  if (!stats) return null;

  const span = stats.last.t - stats.first.t;
  const tick = timeTickFormatter(span);
  const minDrawdown = Math.min(stats.worstDrawdown.drawdown, -0.001);
  const ddDigits = minDrawdown > -0.01 ? 2 : 1;
  const yAxis = equityAxis(display);

  const tooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: EquityPoint }> }) => {
    const p = payload?.[0]?.payload;
    if (!active || !p) return null;
    return (
      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
        <p className="mb-1 font-medium">{formatDateTime(p.t)}</p>
        <p className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-series-1" aria-hidden /> Equity: <strong className="tabular-nums">{formatMoney(p.equity)}</strong>
        </p>
        <p className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-loss" aria-hidden /> Drawdown: <strong className="tabular-nums">{pct(p.drawdown, 2)}</strong>
        </p>
      </div>
    );
  };

  return (
    <figure className="space-y-1" aria-label={label}>
      <div style={{ height }} role="img" aria-label={`${label}: de ${formatMoney(stats.first.equity)} a ${formatMoney(stats.last.equity)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={display} syncId={syncId} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} hide />
            <YAxis
              domain={yAxis.domain}
              tickFormatter={yAxis.format}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={tooltip} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="var(--series-1)"
              strokeWidth={2}
              fill="var(--series-1)"
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="px-1 text-xs text-muted-foreground">Drawdown (queda desde o pico)</p>
      <div style={{ height: Math.round(height * 0.4) }} role="img" aria-label={`Pior drawdown: ${pct(stats.worstDrawdown.drawdown, 2)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={display} syncId={syncId} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={tick}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
            />
            <YAxis
              domain={[minDrawdown, 0]}
              tickFormatter={(v: number) => pct(v, ddDigits)}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={56}
              tickCount={3}
            />
            <Tooltip content={tooltip} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="var(--loss)"
              strokeWidth={2}
              fill="var(--loss)"
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="px-1 pt-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver resumo em tabela</summary>
        <table className="mt-2 w-full max-w-md text-left text-sm">
          <caption className="sr-only">Resumo da {label.toLowerCase()}</caption>
          <tbody className="divide-y">
            {(
              [
                ["Início", stats.first],
                ["Atual", stats.last],
                ["Máxima", stats.max],
                ["Mínima", stats.min],
              ] as const
            ).map(([name, p]) => (
              <tr key={name}>
                <th scope="row" className="py-1 pr-4 font-normal text-muted-foreground">{name}</th>
                <td className="py-1 pr-4 tabular-nums">{formatMoney(p.equity)}</td>
                <td className="py-1 text-muted-foreground">{formatDateTime(p.t)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-1 pr-4 font-normal text-muted-foreground">Pior drawdown</th>
              <td className="py-1 pr-4 tabular-nums">{pct(stats.worstDrawdown.drawdown, 2)}</td>
              <td className="py-1 text-muted-foreground">{formatDateTime(stats.worstDrawdown.t)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1 pr-4 font-normal text-muted-foreground">Pontos</th>
              <td className="py-1 pr-4 tabular-nums" colSpan={2}>
                {formatNumber(points.length, 0)}
                {display.length < points.length && ` (gráfico simplificado para ${formatNumber(display.length, 0)})`}
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </figure>
  );
}
