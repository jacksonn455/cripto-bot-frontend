"use client";

import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleSlash,
  FlaskConical,
  Pause,
  PowerOff,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ModeBadge } from "@/components/mode/mode-badge";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_RECENT, useLiveEvents } from "@/components/live/live-events-provider";
import { useStrategies } from "@/hooks/use-data";
import { useNow } from "@/hooks/use-now";
import { formatDate, formatDateTime, formatDuration, formatRelative } from "@/lib/format";
import { buildTimeline, describeEvent, FEED_KINDS, type FeedItem, type FeedKind, type FeedTone } from "@/lib/live-feed";
import { rangesFromParams } from "@/lib/strategy-explain";
import { cn } from "@/lib/utils";

const ICON: Record<FeedKind, typeof Activity> = {
  entry: ArrowUpRight,
  exit: ArrowDownRight,
  veto: CircleSlash,
  signal: Zap,
  cycle: RefreshCw,
  backtest: FlaskConical,
  bot: Pause,
  error: AlertTriangle,
  alert: AlertOctagon,
};

const TONE: Record<FeedTone, string> = {
  neutral: "text-muted-foreground",
  profit: "text-profit",
  loss: "text-loss",
  warning: "text-warning",
  critical: "text-mode-live",
};

const STATUS = {
  open: { label: "Conectado", className: "bg-profit" },
  connecting: { label: "Conectando…", className: "bg-warning animate-pulse motion-reduce:animate-none" },
  reconnecting: { label: "Reconectando…", className: "bg-warning animate-pulse motion-reduce:animate-none" },
} as const;

const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function Title({ item }: { item: FeedItem }) {
  if (!item.hint) return <>{item.title}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">
          {item.title}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{item.hint}</TooltipContent>
    </Tooltip>
  );
}

function ReevaluationTag() {
  return (
    <span
      className="rounded border border-dashed px-1.5 py-0.5 text-[0.7rem] font-normal text-muted-foreground"
      title="O backend reiniciou e avaliou de novo o mesmo candle. Não é uma avaliação nova."
    >
      reavaliação após reinício
    </span>
  );
}

function When({ at, now }: { at: number; now: number }) {
  return (
    <time dateTime={new Date(at).toISOString()} title={formatDateTime(at)} className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
      {formatRelative(at, now)}
    </time>
  );
}

function ItemRow({ item, reevaluation, now }: { item: FeedItem; reevaluation: boolean; now: number }) {
  const Icon = ICON[item.kind];
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[item.tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <Title item={item} />
          {item.mode && <ModeBadge mode={item.mode} />}
          {reevaluation && <ReevaluationTag />}
        </p>
        {item.detail && <p className="text-sm break-words text-muted-foreground">{item.detail}</p>}
        {item.metrics && <p className="text-xs text-muted-foreground tabular-nums">{item.metrics}</p>}
      </div>
      <When at={item.at} now={now} />
    </li>
  );
}

export function LiveFeed() {
  const { status, recent, clearRecent, reconnects, historyAvailable } = useLiveEvents();
  const strategies = useStrategies();
  const [hidden, setHidden] = useState<Set<FeedKind>>(new Set());
  const [showReevaluations, setShowReevaluations] = useState(false);
  const now = useNow(15_000);

  const ranges = useMemo(() => {
    const live = strategies.data?.live;
    return rangesFromParams(strategies.data?.strategies.find((s) => s.name === live?.strategy)?.params);
  }, [strategies.data]);
  const items = useMemo(() => recent.map((e) => describeEvent(e, ranges)), [recent, ranges]);
  const counts = useMemo(() => {
    const c = new Map<FeedKind, number>();
    for (const i of items) c.set(i.kind, (c.get(i.kind) ?? 0) + 1);
    return c;
  }, [items]);
  const visible = useMemo(() => items.filter((i) => !hidden.has(i.kind)), [items, hidden]);
  const { rows, hiddenReevaluations } = useMemo(() => buildTimeline(visible, { showReevaluations }), [visible, showReevaluations]);
  const toggle = (k: FeedKind) =>
    setHidden((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Activity className="size-4" aria-hidden /> Eventos em tempo real
          <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground" role="status">
            <span className={cn("size-2 rounded-full", STATUS[status].className)} aria-hidden />
            {STATUS[status].label}
            {reconnects > 0 && ` · ${reconnects} reconexão(ões)`}
          </span>
        </CardTitle>
        <CardDescription>
          Tudo o que o bot fez: entradas, saídas, vetos de risco, avaliações sem entrada, backtests, erros e alertas. Mostra
          os últimos {MAX_RECENT} eventos, inclusive o que aconteceu com o painel fechado (o backend guarda 30 dias).
          Avaliações repetidas do mesmo símbolo e motivo aparecem agrupadas.
          {!historyAvailable && " Este backend não tem histórico de eventos: aparecem só os eventos desde que o painel abriu."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar tipos de evento">
          {FEED_KINDS.map((k) => {
            const on = !hidden.has(k.key);
            return (
              <Button key={k.key} size="xs" variant="outline" aria-pressed={on} onClick={() => toggle(k.key)} className={cn(!on && "opacity-50 line-through")}>
                {k.label} <span className="tabular-nums text-muted-foreground">{counts.get(k.key) ?? 0}</span>
              </Button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            {(hiddenReevaluations > 0 || showReevaluations) && (
              <Button size="xs" variant="outline" aria-pressed={showReevaluations} onClick={() => setShowReevaluations((v) => !v)}>
                {showReevaluations ? "Ocultar reavaliações" : `Mostrar reavaliações (${hiddenReevaluations})`}
              </Button>
            )}
            <Button size="xs" variant="ghost" onClick={clearRecent} disabled={items.length === 0}>
              <Trash2 aria-hidden /> Limpar
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={items.length === 0 ? "Nenhum evento ainda" : "Nenhum evento nos tipos selecionados"}
            description={
              items.length === 0
                ? "Os eventos aparecem aqui a cada candle avaliado, e quando o bot abrir ou fechar uma trade, pausar ou registrar um erro."
                : undefined
            }
          />
        ) : (
          <ol className="divide-y rounded-lg border" aria-live="polite" aria-relevant="additions">
            {rows.map((row) => {
              if (row.type === "item") return <ItemRow key={`${row.item.at}-${row.item.title}`} item={row.item} reevaluation={row.reevaluation} now={now} />;
              if (row.type === "gap") {
                return (
                  <li key={row.key} role="note" className="flex items-start gap-3 bg-warning/10 px-3 py-2.5">
                    <PowerOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                    <p className="text-sm">
                      <strong>
                        Sem registros de avaliação de {row.symbol} entre {clock.format(row.from)} e {clock.format(row.to)}
                      </strong>{" "}
                      <span className="text-muted-foreground">
                        ({formatDuration(row.to - row.from)}, em {formatDate(row.from)}). O bot provavelmente estava desligado;
                        oportunidades nesse intervalo não foram avaliadas.
                      </span>
                    </p>
                  </li>
                );
              }
              const [latest] = row.items;
              const Icon = ICON[latest.kind];
              return (
                <li key={row.key}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-2.5 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                      <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[latest.tone])} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <Title item={latest} />
                          <span className="font-normal text-muted-foreground">
                            ({row.items.length} avaliações, última {formatRelative(latest.at, now)})
                          </span>
                          {latest.mode && <ModeBadge mode={latest.mode} />}
                          {row.reevaluations > 0 && (
                            <span className="text-[0.7rem] font-normal text-muted-foreground">inclui {row.reevaluations} reavaliação(ões) após reinício</span>
                          )}
                        </p>
                        {latest.detail && <p className="text-sm break-words text-muted-foreground">{latest.detail}</p>}
                        {latest.metrics && <p className="text-xs text-muted-foreground tabular-nums">Última: {latest.metrics}</p>}
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                      <span className="sr-only">Ver as {row.items.length} avaliações</span>
                    </summary>
                    <ol className="divide-y border-t bg-muted/20 pl-7">
                      {row.items.map((item, i) => (
                        <ItemRow key={`${item.at}-${item.title}`} item={item} reevaluation={row.flags[i]} now={now} />
                      ))}
                    </ol>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
