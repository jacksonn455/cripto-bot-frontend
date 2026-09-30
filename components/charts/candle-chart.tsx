"use client";

import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  LineSeries,
  LineStyle,
  TickMarkType,
  type AutoscaleInfo,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Candle } from "@/lib/schemas";
import { priceDigits } from "@/lib/trades";

export type MarkerTone = "entry" | "exit";

export interface ChartMarker {
  /** Epoch ms; snapped to the candle that contains it. */
  time: number;
  tone: MarkerTone;
  position: "above" | "below";
  text: string;
}

export interface ChartPriceLine {
  price: number;
  title: string;
  tone: "stop" | "target" | "entry";
}

export interface ChartOverlay {
  id: string;
  title: string;
  /** Hex (canvas needs concrete colors). */
  color: string;
  points: Array<{ time: number; value: number }>;
}

interface CandleChartProps {
  candles: Candle[];
  markers?: ChartMarker[];
  priceLines?: ChartPriceLine[];
  overlays?: ChartOverlay[];
  height?: number;
  ariaLabel: string;
}

/**
 * Canvas colors can't read CSS variables, so the palette lives here, per theme.
 * Candles use the conventional green/red; entry/exit markers use blue/orange so they never
 * blend into the candles.
 */
export const CHART_PALETTE = {
  light: {
    text: "#52514e",
    grid: "#ecebe8",
    border: "#d9d8d4",
    up: "#089981",
    down: "#f23645",
    entry: "#2a78d6",
    exit: "#eb6834",
    stop: "#e34948",
    target: "#1baf7a",
  },
  dark: {
    text: "#c3c2b7",
    grid: "#2a2a28",
    border: "#3a3a37",
    up: "#26a69a",
    down: "#ef5350",
    entry: "#3987e5",
    exit: "#d95926",
    stop: "#e66767",
    target: "#199e70",
  },
} as const;

const toTime = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;
const fromTime = (t: Time) => (typeof t === "number" ? t * 1000 : Date.parse(String(t)));

const tickFormats = {
  [TickMarkType.Year]: new Intl.DateTimeFormat("pt-BR", { year: "numeric" }),
  [TickMarkType.Month]: new Intl.DateTimeFormat("pt-BR", { month: "short" }),
  [TickMarkType.DayOfMonth]: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }),
  [TickMarkType.Time]: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  [TickMarkType.TimeWithSeconds]: new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium" }),
};

/** Index of the last candle opening at/before `ms` (candles ascending). */
function snapToCandle(candles: Candle[], ms: number): number | null {
  let lo = 0;
  let hi = candles.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].openTime <= ms) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found === -1 ? null : found;
}

export function CandleChart({ candles, markers = [], priceLines = [], overlays = [], height = 420, ariaLabel }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  /** Price-line levels the autoscale must include (stop/target can sit outside the candles). */
  const extraPricesRef = useRef<number[]>([]);
  const overlaysRef = useRef(new Map<string, ISeriesApi<"Line">>());
  const { resolvedTheme } = useTheme();
  const palette = CHART_PALETTE[resolvedTheme === "dark" ? "dark" : "light"];

  // Create once; everything else is applied by the effects below.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: "transparent" }, fontFamily: "inherit", attributionLogo: false },
      localization: {
        locale: "pt-BR",
        timeFormatter: (t: Time) => formatDateTime(fromTime(t)),
        priceFormatter: (p: number) => formatNumber(p, priceDigits(p)),
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (t: Time, type: TickMarkType) => tickFormats[type].format(fromTime(t)),
      },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(CandlestickSeries, {
      priceLineVisible: false,
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const info = original();
        const extra = extraPricesRef.current;
        if (!info?.priceRange || extra.length === 0) return info;
        return {
          ...info,
          priceRange: {
            minValue: Math.min(info.priceRange.minValue, ...extra),
            maxValue: Math.max(info.priceRange.maxValue, ...extra),
          },
        };
      },
    });
    markersRef.current = createSeriesMarkers(seriesRef.current, []);
    const overlaySeries = overlaysRef.current;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      priceLinesRef.current = [];
      overlaySeries.clear();
    };
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: { textColor: palette.text },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      rightPriceScale: { borderColor: palette.border },
      timeScale: { borderColor: palette.border },
    });
    seriesRef.current?.applyOptions({
      upColor: palette.up,
      downColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
      borderVisible: false,
    });
  }, [palette]);

  useEffect(() => {
    seriesRef.current?.setData(
      candles.map((c) => ({ time: toTime(c.openTime), open: c.open, high: c.high, low: c.low, close: c.close })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    const snapped = markers
      .map((m) => {
        const i = snapToCandle(candles, m.time);
        if (i === null) return null;
        return {
          time: toTime(candles[i].openTime),
          position: m.position === "above" ? ("aboveBar" as const) : ("belowBar" as const),
          shape: m.position === "above" ? ("arrowDown" as const) : ("arrowUp" as const),
          color: palette[m.tone],
          text: m.text,
        };
      })
      .filter((m) => m !== null)
      .sort((a, b) => a.time - b.time);
    markersRef.current?.setMarkers(snapped);
  }, [markers, candles, palette]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    priceLinesRef.current.forEach((l) => series.removePriceLine(l));
    extraPricesRef.current = priceLines.map((l) => l.price);
    priceLinesRef.current = priceLines.map((l) =>
      series.createPriceLine({
        price: l.price,
        title: l.title,
        color: l.tone === "entry" ? palette.entry : palette[l.tone],
        lineWidth: 1,
        lineStyle: l.tone === "entry" ? LineStyle.Dotted : LineStyle.Dashed,
        axisLabelVisible: true,
      }),
    );
  }, [priceLines, palette]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const existing = overlaysRef.current;
    for (const [id, s] of existing) {
      if (!overlays.some((o) => o.id === id)) {
        chart.removeSeries(s);
        existing.delete(id);
      }
    }
    for (const o of overlays) {
      let s = existing.get(o.id);
      if (!s) {
        // lastValueVisible: the title+value label on the price axis identifies the line without color.
        s = chart.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
        existing.set(o.id, s);
      }
      s.applyOptions({ color: o.color, title: o.title });
      s.setData(o.points.map((p) => ({ time: toTime(p.time), value: p.value })));
    }
  }, [overlays]);

  return <div ref={containerRef} role="img" aria-label={ariaLabel} style={{ height }} className="w-full" />;
}
