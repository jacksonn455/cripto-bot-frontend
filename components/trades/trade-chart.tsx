"use client";

import { CandlestickChart } from "lucide-react";
import { useMemo, useState } from "react";
import { CandleChart, type ChartMarker, type ChartPriceLine } from "@/components/charts/candle-chart";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandles } from "@/hooks/use-data";
import { formatNumber } from "@/lib/format";
import type { CandleInterval, Trade } from "@/lib/schemas";
import { exitReasonLabel, priceDigits, TRADE_CHART_INTERVALS, tradeCandleWindow } from "@/lib/trades";

const AUTO = "auto";

export function TradeChart({ trade, now }: { trade: Trade; now: number }) {
  const [choice, setChoice] = useState<CandleInterval | typeof AUTO>(AUTO);
  // "now" in 5-min steps: the range (and the query key) only moves when that step changes.
  const anchor = Math.floor(now / 300_000) * 300_000;
  const { entryTime, exitTime } = trade;
  const range = useMemo(
    () => tradeCandleWindow({ entryTime, exitTime }, anchor, choice === AUTO ? undefined : choice),
    [entryTime, exitTime, anchor, choice],
  );
  const candles = useCandles(
    { symbol: trade.symbol, interval: range.interval, startTime: range.startTime, endTime: range.endTime, limit: range.limit },
    { refetchInterval: trade.status === "OPEN" ? 60_000 : false },
  );

  const markers = useMemo<ChartMarker[]>(() => {
    const entryLabel = `Entrada ${trade.side} ${formatNumber(trade.entryPrice, priceDigits(trade.entryPrice))}`;
    const list: ChartMarker[] = [
      { time: Date.parse(trade.entryTime), tone: "entry", position: trade.side === "LONG" ? "below" : "above", text: entryLabel },
    ];
    if (trade.exitTime && trade.exitPrice != null) {
      list.push({
        time: Date.parse(trade.exitTime),
        tone: "exit",
        position: trade.side === "LONG" ? "above" : "below",
        text: `Saída ${exitReasonLabel(trade.exitReason)} ${formatNumber(trade.exitPrice, priceDigits(trade.exitPrice))}`,
      });
    }
    return list;
  }, [trade]);

  const priceLines = useMemo<ChartPriceLine[]>(() => {
    const lines: ChartPriceLine[] = [
      { price: trade.entryPrice, title: "Entrada", tone: "entry" },
      { price: trade.stopLoss, title: "Stop", tone: "stop" },
    ];
    if (trade.takeProfit != null) lines.push({ price: trade.takeProfit, title: "Alvo", tone: "target" });
    return lines;
  }, [trade]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-prose text-xs text-muted-foreground">
          Candles de {trade.symbol} vindos do backend (<code>/exchange/candles</code>). Setas marcam entrada e saída;
          as linhas tracejadas são stop e alvo gravados na abertura da trade. A saída por trailing é um sinal
          da estratégia e não move o stop gravado.
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor="trade-interval" className="text-xs text-muted-foreground">Intervalo</Label>
          <Select value={choice} onValueChange={(v) => setChoice(v as CandleInterval | typeof AUTO)}>
            <SelectTrigger id="trade-interval" size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>Auto ({range.interval})</SelectItem>
              {TRADE_CHART_INTERVALS.map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {range.truncated && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Com o intervalo {range.interval}, o período da trade passa de 1000 candles (limite do backend). O gráfico mostra
          só o começo; escolha um intervalo maior para ver a saída.
        </p>
      )}

      <QueryState
        query={candles}
        loading={<Skeleton className="h-105 w-full" />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            icon={CandlestickChart}
            title="Sem candles para este período"
            description="O backend não retornou candles para esse símbolo e intervalo."
          />
        }
      >
        {(data) => (
          <CandleChart
            candles={data}
            markers={markers}
            priceLines={priceLines}
            ariaLabel={`Gráfico de candles ${trade.symbol} ${range.interval} com entrada e saída da trade`}
          />
        )}
      </QueryState>
    </div>
  );
}
