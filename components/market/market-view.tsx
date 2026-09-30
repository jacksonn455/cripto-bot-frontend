"use client";

import { CandlestickChart } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { CandleChart, CHART_PALETTE, type ChartMarker, type ChartOverlay } from "@/components/charts/candle-chart";
import { PageHeader } from "@/components/layout/page-header";
import { ModeBadge } from "@/components/mode/mode-badge";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandles, useStrategies, useTrades } from "@/hooks/use-data";
import { useDataMode } from "@/hooks/use-data-mode";
import { ema } from "@/lib/indicators";
import { formatNumber } from "@/lib/format";
import { CANDLE_INTERVALS, type Candle, type CandleInterval, type Trade } from "@/lib/schemas";
import { exitReasonLabel, priceDigits } from "@/lib/trades";

/**
 * EMA line colors (canvas needs hex). Validated with the dataviz palette checker (all pairs,
 * CVD-safe) and chosen apart from the entry/exit marker colors (blue/orange). The light yellow
 * and pink sit under 3:1 contrast, so every EMA also carries its value label on the price axis.
 */
const EMA_COLORS = {
  light: ["#eda100", "#e87ba4", "#4a3aa7"],
  dark: ["#c98500", "#d55181", "#9085e9"],
} as const;

const CANDLE_COUNTS = [200, 500, 1000] as const;
const DEFAULT_EMAS = { emaFast: 20, emaSlow: 50, emaRegime: 200 };

function tradeMarkers(trades: Trade[]): ChartMarker[] {
  return trades.flatMap((t) => {
    const up = t.side === "LONG";
    const list: ChartMarker[] = [
      { time: Date.parse(t.entryTime), tone: "entry", position: up ? "below" : "above", text: `Entrada ${formatNumber(t.entryPrice, priceDigits(t.entryPrice))}` },
    ];
    if (t.exitTime && t.exitPrice != null) {
      list.push({ time: Date.parse(t.exitTime), tone: "exit", position: up ? "above" : "below", text: `Saída ${exitReasonLabel(t.exitReason)}` });
    }
    return list;
  });
}

export function MarketView() {
  const { mode } = useDataMode();
  const { resolvedTheme } = useTheme();
  const strategies = useStrategies();
  const live = strategies.data?.live;
  const [symbolChoice, setSymbolChoice] = useState<string | null>(null);
  const [intervalChoice, setIntervalChoice] = useState<CandleInterval | null>(null);
  const [limit, setLimit] = useState<number>(500);

  const symbol = symbolChoice ?? live?.symbols[0] ?? "BTCUSDT";
  const interval = intervalChoice ?? (live?.timeframe as CandleInterval | undefined) ?? "1h";
  const validSymbol = /^[A-Z0-9]{5,20}$/.test(symbol);

  const candles = useCandles({ symbol, interval, limit }, { enabled: validSymbol, refetchInterval: 60_000 });
  const firstOpen = candles.data?.[0]?.openTime;
  // Trades of the selected data mode that started inside the visible window.
  const trades = useTrades(
    { mode, symbol, from: firstOpen ? new Date(firstOpen).toISOString() : undefined, limit: 200, sortBy: "entryTime", sortOrder: "asc" },
    { enabled: validSymbol && firstOpen !== undefined },
  );

  const strategy = strategies.data?.strategies.find((s) => s.name === live?.strategy);
  const periods = useMemo(() => {
    const value = (k: keyof typeof DEFAULT_EMAS) => strategy?.params.find((p) => p.key === k)?.value ?? DEFAULT_EMAS[k];
    return [
      { key: "emaFast", period: value("emaFast") },
      { key: "emaSlow", period: value("emaSlow") },
      { key: "emaRegime", period: value("emaRegime") },
    ];
  }, [strategy]);

  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const colors = EMA_COLORS[theme];
  const overlays = useMemo<ChartOverlay[]>(() => {
    const data: Candle[] = candles.data ?? [];
    const closes = data.map((c) => c.close);
    return periods.map((p, i) => ({
      id: p.key,
      title: `EMA${p.period}`,
      color: colors[i],
      points: ema(p.period, closes).flatMap((v, j) => (v === undefined ? [] : [{ time: data[j].openTime, value: v }])),
    }));
  }, [candles.data, periods, colors]);
  const markers = useMemo(() => tradeMarkers(trades.data?.items ?? []), [trades.data]);

  const symbolOptions = live?.symbols ?? [];

  return (
    <>
      <PageHeader title="Mercado" description="Candles do backend com as médias da estratégia e as trades do modo selecionado." />
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
          <div className="w-40 space-y-1.5">
            <Label htmlFor="mk-symbol" className="text-xs">Símbolo</Label>
            <Input
              id="mk-symbol"
              value={symbol}
              onChange={(e) => setSymbolChoice(e.target.value.toUpperCase().trim())}
              list="mk-symbols"
              autoComplete="off"
              className="h-8 uppercase"
              aria-invalid={!validSymbol}
            />
            <datalist id="mk-symbols">
              {symbolOptions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mk-interval" className="text-xs">Timeframe</Label>
            <Select value={interval} onValueChange={(v) => setIntervalChoice(v as CandleInterval)}>
              <SelectTrigger id="mk-interval" size="sm" className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CANDLE_INTERVALS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mk-limit" className="text-xs">Candles</Label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger id="mk-limit" size="sm" className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CANDLE_COUNTS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {live && (
            <p className="pb-1 text-xs text-muted-foreground">
              O bot opera {live.symbols.join(", ")} em {live.timeframe} (regime em {live.regimeTimeframe}).
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {symbol} · {interval}
              <span className="text-sm font-normal text-muted-foreground">trades de</span>
              <ModeBadge mode={mode} />
            </CardTitle>
            <CardDescription>
              As EMAs são calculadas no navegador, só para exibição, com os mesmos períodos e a mesma fórmula da estratégia.
              Nenhuma decisão de trade é tomada aqui.
              {live && interval !== live.regimeTimeframe &&
                ` A estratégia calcula a EMA${periods[2].period} de regime no timeframe ${live.regimeTimeframe}; para ver a mesma linha, escolha ${live.regimeTimeframe}.`}
            </CardDescription>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs" aria-label="Legenda">
              {overlays.map((o) => (
                <li key={o.id} className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full" style={{ background: o.color }} aria-hidden /> {o.title}
                </li>
              ))}
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden style={{ color: CHART_PALETTE[theme].entry }}>▲</span> Entrada
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden style={{ color: CHART_PALETTE[theme].exit }}>▼</span> Saída
              </li>
            </ul>
          </CardHeader>
          <CardContent>
            {!validSymbol ? (
              <EmptyState icon={CandlestickChart} title="Símbolo inválido" description="Use o formato da Binance, por exemplo BTCUSDT." />
            ) : (
              <QueryState
                query={candles}
                loading={<Skeleton className="h-130 w-full" />}
                isEmpty={(d) => d.length === 0}
                empty={<EmptyState icon={CandlestickChart} title="Sem candles" description="O backend não retornou candles para esse símbolo e timeframe." />}
              >
                {(data) => (
                  <>
                    <CandleChart
                      candles={data}
                      overlays={overlays}
                      markers={markers}
                      height={520}
                      ariaLabel={`Candles ${symbol} ${interval} com ${overlays.map((o) => o.title).join(", ")} e trades de ${mode}`}
                    />
                    <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                      {trades.data
                        ? trades.data.total === 0
                          ? `Nenhuma trade de ${mode} em ${symbol} neste período.`
                          : `${trades.data.items.length} trade(s) de ${mode} marcadas${trades.data.total > trades.data.items.length ? ` (de ${trades.data.total}; só as primeiras 200)` : ""}.`
                        : "Carregando trades…"}
                    </p>
                  </>
                )}
              </QueryState>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
