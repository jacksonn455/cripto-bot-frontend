"use client";

import { AlertTriangle, CheckCircle2, CircleHelp, Clock, Hourglass } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { ModeBadge } from "@/components/mode/mode-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBotStatus } from "@/hooks/use-bot-status";
import { useCandles, useStrategies } from "@/hooks/use-data";
import { useNow } from "@/hooks/use-now";
import { loopHealth } from "@/lib/bot-health";
import { formatDateTime, formatDuration, formatNumber, formatRelative } from "@/lib/format";
import { ema } from "@/lib/indicators";
import { INTERVAL_MS, type CandleInterval, type SignalSnapshot } from "@/lib/schemas";
import {
  candleEnd,
  conditionsFrom,
  formatCandleRange,
  formatCountdown,
  formatWhen,
  nextCandleClose,
  rangesFromParams,
  shortRsiBand,
  summarize,
  type StrategyRanges,
} from "@/lib/strategy-explain";
import { priceDigits } from "@/lib/trades";
import { cn } from "@/lib/utils";

/** The live loop evaluates on the last emaRegime + 10 closed candles (ExecutionService.runCycle). */
const LOOKBACK_MARGIN = 10;
const pct = (v: number) => `${formatNumber(Math.abs(v) * 100, 2)}%`;
const price = (v: number) => formatNumber(v, priceDigits(v));

function Check({ ok, title, children }: { ok: boolean | null; title: string; children: ReactNode }) {
  const Icon = ok === true ? CheckCircle2 : ok === false ? Hourglass : CircleHelp;
  return (
    <li className="flex items-start gap-2.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", ok === true ? "text-profit" : ok === false ? "text-warning" : "text-muted-foreground")} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {title}{" "}
          <span className="sr-only">{ok === true ? "(atendida)" : ok === false ? "(aguardando)" : "(sem dado)"}</span>
        </p>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

/** Distance between the averages now, and when the fast one last crossed above — as the bot sees it. */
function useCrossPicture(symbol: string, timeframe: CandleInterval, ranges: StrategyRanges) {
  const lookback = ranges.emaRegime + LOOKBACK_MARGIN;
  const candles = useCandles({ symbol, interval: timeframe, limit: Math.min(1000, lookback + 2) }, { refetchInterval: 60_000 });
  return useMemo(() => {
    const closed = (candles.data ?? []).filter((c) => c.isClosed).slice(-lookback);
    if (closed.length < ranges.emaSlow + 2) return null;
    const closes = closed.map((c) => c.close);
    const fast = ema(ranges.emaFast, closes);
    const slow = ema(ranges.emaSlow, closes);
    const last = closes.length - 1;
    let lastCrossUp: number | null = null;
    for (let i = last; i > 0; i--) {
      const [f0, s0, f1, s1] = [fast[i - 1], slow[i - 1], fast[i], slow[i]];
      if (f0 !== undefined && s0 !== undefined && f1 !== undefined && s1 !== undefined && f0 <= s0 && f1 > s1) {
        lastCrossUp = closed[i].closeTime;
        break;
      }
    }
    return { fast: fast[last]!, slow: slow[last]!, lastCrossUp };
  }, [candles.data, lookback, ranges.emaFast, ranges.emaSlow]);
}

function SymbolBlock({
  symbol,
  snapshot,
  timeframe,
  tfMs,
  regimeTimeframe,
  ranges,
  now,
}: {
  symbol: string;
  snapshot: SignalSnapshot | undefined;
  timeframe: CandleInterval;
  tfMs: number;
  regimeTimeframe: string;
  ranges: StrategyRanges;
  now: number;
}) {
  const conditions = conditionsFrom(snapshot?.action, snapshot?.reason);
  const picture = useCrossPicture(symbol, timeframe, ranges);
  const ind = snapshot?.indicators ?? {};
  const emaFast = ind.emaFast ?? picture?.fast;
  const emaSlow = ind.emaSlow ?? picture?.slow;
  const rsi = ind.rsi ?? null;
  const emaRegime = ind.emaRegime ?? null;
  const judging = conditions.kind === "waiting" || conditions.kind === "entry";
  const short = conditions.side === "short";
  const [shortRsiMin, shortRsiMax] = shortRsiBand(ranges);
  const rsiMin = short ? shortRsiMin : ranges.rsiMin;
  const rsiMax = short ? shortRsiMax : ranges.rsiMax;

  let crossText: ReactNode = "Sem dados de médias ainda.";
  if (short) {
    if (conditions.kind === "entry") {
      crossText = `A EMA${ranges.emaFast} cruzou abaixo da EMA${ranges.emaSlow} neste candle.`;
    } else if (emaFast != null && emaSlow != null) {
      const gap = (emaFast - emaSlow) / emaSlow;
      crossText =
        gap >= 0
          ? `EMA${ranges.emaFast} está ${pct(gap)} acima da EMA${ranges.emaSlow}, falta cair ${pct(gap)} para cruzar para baixo.`
          : `EMA${ranges.emaFast} já está ${pct(gap)} abaixo da EMA${ranges.emaSlow}; precisa subir e cruzar para baixo de novo. A regra vale só no candle do cruzamento.`;
    }
  } else if (conditions.kind === "entry") {
    crossText = `A EMA${ranges.emaFast} cruzou acima da EMA${ranges.emaSlow} neste candle.`;
  } else if (emaFast != null && emaSlow != null) {
    const gap = (emaFast - emaSlow) / emaSlow;
    if (gap <= 0) {
      crossText = `EMA${ranges.emaFast} está ${pct(gap)} abaixo da EMA${ranges.emaSlow}, falta subir ${pct(gap)}.`;
    } else if (picture?.lastCrossUp) {
      const when = formatWhen(candleEnd(picture.lastCrossUp), now);
      // "às 06:00" today, "em 29/09 às 06:00" on another day.
      const preposition = when.includes("às") ? "em" : "às";
      crossText = `Já cruzou no candle que fechou ${preposition} ${when} e segue ${pct(gap)} acima; precisa cair e cruzar de novo. A regra vale só no candle do cruzamento.`;
    } else {
      crossText = `EMA${ranges.emaFast} está ${pct(gap)} acima da EMA${ranges.emaSlow} há mais tempo do que a janela analisada; precisa cair e cruzar de novo.`;
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-labelledby={`why-${symbol}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`why-${symbol}`} className="font-semibold">{symbol}</h3>
        <span className="text-xs text-muted-foreground">
          {snapshot ? (
            <>
              Última avaliação:{" "}
              <time dateTime={snapshot.at} title={formatDateTime(snapshot.at)}>
                {formatRelative(snapshot.at, now)}
              </time>
              {snapshot.candleTime && <> · candle {formatCandleRange(Date.parse(snapshot.candleTime), tfMs, now)}</>}
            </>
          ) : (
            "Sem avaliação desde que o backend iniciou"
          )}
        </span>
      </div>
      <p className="text-sm">{summarize(conditions)}</p>
      {judging || conditions.kind === "unknown" ? (
        <ul className="space-y-3">
          <Check
            ok={conditions.cross}
            title={
              short
                ? `Cruzamento de baixa (short): EMA${ranges.emaFast} cruzou abaixo da EMA${ranges.emaSlow} neste candle?`
                : `Cruzamento de alta: EMA${ranges.emaFast} cruzou acima da EMA${ranges.emaSlow} neste candle?`
            }
          >
            {crossText}
            {emaFast != null && emaSlow != null && (
              <span className="mt-0.5 block text-xs tabular-nums">
                EMA{ranges.emaFast} {price(emaFast)} · EMA{ranges.emaSlow} {price(emaSlow)}
              </span>
            )}
          </Check>
          <Check
            ok={conditions.regime}
            title={
              short
                ? `Tendência maior de baixa (short): preço abaixo da EMA${ranges.emaRegime} no gráfico de ${regimeTimeframe}?`
                : `Tendência maior de alta: preço acima da EMA${ranges.emaRegime} no gráfico de ${regimeTimeframe}?`
            }
          >
            {conditions.regime === true
              ? short
                ? "Sim: a tendência maior está de baixa (regras de short)."
                : "Sim: a tendência maior está de alta."
              : conditions.regime === false
                ? short
                  ? "Ainda não: o preço está praticamente em cima dessa média, tendência indefinida."
                  : "Ainda não: o preço está abaixo dessa média no gráfico maior."
                : "Sem dado ainda."}
            {emaRegime != null && (
              <span className="mt-0.5 block text-xs tabular-nums">
                EMA{ranges.emaRegime} ({regimeTimeframe}) {price(emaRegime)}
                {snapshot?.price != null && <> · último fechamento ({timeframe}) {price(snapshot.price)}</>}
              </span>
            )}
          </Check>
          <Check ok={conditions.rsi} title={`RSI na faixa de ${rsiMin} a ${rsiMax}${short ? " (short)" : ""}?`}>
            {rsi != null ? (
              <>RSI atual {formatNumber(rsi, 1)} (faixa aceita{short ? " no short" : ""}: {rsiMin} a {rsiMax}).</>
            ) : conditions.rsi === true ? (
              "Dentro da faixa."
            ) : conditions.rsi === false ? (
              "Fora da faixa."
            ) : (
              "Sem dado ainda."
            )}
          </Check>
        </ul>
      ) : null}
    </section>
  );
}

export function WhyNoTrades() {
  const status = useBotStatus();
  const strategies = useStrategies();
  const now = useNow(1000);

  if (!status.data || !strategies.data) {
    return <Skeleton className="h-64 w-full" />;
  }
  const s = status.data;
  const live = strategies.data.live;
  const ranges = rangesFromParams(strategies.data.strategies.find((x) => x.name === live.strategy)?.params);
  const timeframe = live.timeframe as CandleInterval;
  const tfMs = INTERVAL_MS[timeframe] ?? 3_600_000;
  const health = loopHealth(s, now);
  const nextClose = nextCandleClose(now, tfMs);

  let banner: ReactNode = null;
  if (health.state === "disabled") {
    banner = "O loop de execução está desligado (EXECUTION_ENABLED=false): o bot não avalia nada e não abre trades.";
  } else if (health.state === "stale") {
    banner = `O bot parou de verificar o mercado há ${formatDuration(health.lagMs)}. Enquanto estiver parado, nenhum candle é avaliado e oportunidades são perdidas.`;
  } else if (s.paused) {
    banner = "O bot está pausado: ele continua avaliando, mas o gerenciador de risco veta qualquer entrada até você retomar.";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Por que não há trades agora? <ModeBadge mode={s.mode} />
        </CardTitle>
        <CardDescription>
          O bot só entra quando as 3 condições abaixo acontecem juntas no fechamento de um candle de {live.timeframe}. Na
          maior parte do tempo alguma falta, e é normal passar horas ou dias sem trade.{" "}
          {ranges.allowShort
            ? "Short ligado: com a tendência maior de baixa, ele avalia as regras espelhadas de venda a descoberto."
            : "Só opera Long (Short desligado no backend: TREND_ALLOW_SHORT)."}
        </CardDescription>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-muted-foreground" aria-hidden />
            Próxima avaliação em <strong className="tabular-nums">{formatCountdown(nextClose - now)}</strong>
          </span>
          <span className="text-xs text-muted-foreground">
            (o próximo candle fecha às {formatWhen(nextClose, now)}; o bot confere a cada {s.pollIntervalSeconds} s, então
            pode levar até isso a mais)
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {banner && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {banner}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {live.symbols.map((symbol) => (
            <SymbolBlock
              key={symbol}
              symbol={symbol}
              snapshot={s.lastSignalBySymbol[symbol]}
              timeframe={timeframe}
              tfMs={tfMs}
              regimeTimeframe={live.regimeTimeframe}
              ranges={ranges}
              now={now}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
