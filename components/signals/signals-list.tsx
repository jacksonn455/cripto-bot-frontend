"use client";

import { CheckCircle2, CircleSlash, Radio, ServerCog } from "lucide-react";
import { useState } from "react";
import { ModeBadge } from "@/components/mode/mode-badge";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Pagination } from "@/components/trades/pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSignals } from "@/hooks/use-data";
import { useDataMode } from "@/hooks/use-data-mode";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, formatNumber } from "@/lib/format";
import { REJECT_REASON_LABELS, type SignalRecord } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const DECISIONS = [
  { value: "all", label: "Todos" },
  { value: "approved", label: "Aprovados" },
  { value: "vetoed", label: "Vetados" },
] as const;

const INDICATOR_LABELS: Record<string, string> = { emaFast: "EMA rápida", emaSlow: "EMA lenta", emaRegime: "EMA regime", rsi: "RSI", atr: "ATR" };

function Indicators({ values }: { values: SignalRecord["indicators"] }) {
  const entries = Object.entries(values).filter(([, v]) => v != null);
  if (!entries.length) return <span className="text-muted-foreground">—</span>;
  return (
    <details>
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">ver</summary>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 text-xs tabular-nums">
        {entries.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{INDICATOR_LABELS[k] ?? k}</dt>
            <dd className="text-right">{formatNumber(v as number, 2)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function SignalsList() {
  const { mode } = useDataMode();
  const [symbol, setSymbol] = useState("");
  const [decision, setDecision] = useState<(typeof DECISIONS)[number]["value"]>("all");
  const [paging, setPaging] = useState({ page: 1, limit: 50 });
  const validSymbol = symbol === "" || /^[A-Z0-9]{2,20}$/.test(symbol);

  const signals = useSignals({
    mode,
    symbol: validSymbol && symbol.length >= 5 ? symbol : undefined,
    approved: decision === "all" ? undefined : decision === "approved",
    ...paging,
  });
  const unavailable = signals.error instanceof ApiError && signals.error.status === 404;
  const filtered = decision !== "all" || symbol !== "";
  // Most recent signal of the mode regardless of filters, for "Último sinal: …" in the empty state.
  const latest = useSignals({ mode, limit: 1 });
  const lastAny = latest.data?.items[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sinais avaliados pelo risco <ModeBadge mode={mode} />
        </CardTitle>
        <CardDescription>
          Cada sinal de entrada da estratégia passa pelo gerenciador de risco, que aprova ou veta com um motivo. Avaliações
          “sem entrada” e saídas não entram nesta lista; a última de cada símbolo está no quadro acima.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40 space-y-1.5">
            <Label htmlFor="sg-symbol" className="text-xs">Símbolo</Label>
            <Input id="sg-symbol" value={symbol} onChange={(e) => { setSymbol(e.target.value.toUpperCase().trim()); setPaging((p) => ({ ...p, page: 1 })); }} placeholder="Todos" className="h-8 uppercase placeholder:normal-case" autoComplete="off" aria-invalid={!validSymbol} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sg-decision" className="text-xs">Decisão</Label>
            <Select value={decision} onValueChange={(v) => { setDecision(v as typeof decision); setPaging((p) => ({ ...p, page: 1 })); }}>
              <SelectTrigger id="sg-decision" size="sm" className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DECISIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {unavailable ? (
          <EmptyState
            icon={ServerCog}
            title="Endpoint indisponível"
            description="Este backend não tem GET /signals. Atualize o backend para ver a lista de sinais; o feed em tempo real continua funcionando."
          />
        ) : !signals.data ? (
          signals.isError ? (
            <ErrorState error={signals.error} onRetry={() => void signals.refetch()} retrying={signals.isFetching} />
          ) : (
            <Skeleton className="h-60 w-full" />
          )
        ) : signals.data.items.length === 0 ? (
          <EmptyState
            icon={Radio}
            title={
              filtered
                ? `Nenhum sinal em ${mode} com esses filtros`
                : mode === "BACKTEST"
                  ? "Nenhum sinal de backtest ainda"
                  : "Nenhum sinal de entrada ainda"
            }
            description={
              <>
                {mode === "BACKTEST" ? (
                  "Os sinais de backtest aparecem aqui depois de rodar um backtest."
                ) : (
                  <>
                    Só aparecem aqui os momentos em que a estratégia quis comprar e o gerenciador de risco aprovou ou vetou.
                    Enquanto o Krypto só diz “sem entrada”, esta lista fica vazia, e isso é esperado.
                  </>
                )}
                {lastAny && (
                  <span className="mt-2 block">
                    Último sinal{filtered ? " (sem filtros)" : ""}: {formatDateTime(lastAny.candleTime)} · {lastAny.symbol} ·{" "}
                    {lastAny.approved ? "aprovado" : "vetado"}
                  </span>
                )}
              </>
            }
          />
        ) : (
          <div className={cn("space-y-3", signals.isPlaceholderData && "opacity-60")}>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candle</TableHead>
                    <TableHead>Símbolo</TableHead>
                    <TableHead>Sinal</TableHead>
                    <TableHead>Decisão do risco</TableHead>
                    <TableHead>Motivo da estratégia</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead>Indicadores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signals.data.items.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell className="align-top whitespace-nowrap">{formatDateTime(s.candleTime)}</TableCell>
                      <TableCell className="align-top font-medium">
                        {s.symbol}
                        <div className="text-xs font-normal text-muted-foreground">{s.strategy}</div>
                      </TableCell>
                      <TableCell className="align-top">{s.signal}</TableCell>
                      <TableCell className="align-top">
                        {s.approved ? (
                          <span className="inline-flex items-center gap-1.5 text-profit"><CheckCircle2 className="size-4" aria-hidden /> Aprovado</span>
                        ) : (
                          <span className="inline-flex flex-col">
                            <span className="inline-flex items-center gap-1.5 font-medium text-warning"><CircleSlash className="size-4" aria-hidden /> Vetado</span>
                            <span className="text-xs text-muted-foreground" title={s.rejectReason ?? undefined}>
                              {REJECT_REASON_LABELS[s.rejectReason ?? ""] ?? s.rejectReason ?? "Motivo não informado"}
                            </span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md min-w-48 align-top text-sm whitespace-normal text-muted-foreground">
                        {s.reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums">{s.price != null ? formatNumber(s.price, 2) : "—"}</TableCell>
                      <TableCell className="align-top"><Indicators values={s.indicators} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={paging.page} limit={paging.limit} total={signals.data.total} pageSizes={[50, 100, 200]} onChange={(p) => setPaging((cur) => ({ ...cur, ...p }))} busy={signals.isPlaceholderData} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
