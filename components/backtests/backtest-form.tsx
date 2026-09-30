"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Pnl } from "@/components/data/pnl";
import { describeError } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBacktestRun } from "@/hooks/use-data";
import { useNow } from "@/hooks/use-now";
import { api } from "@/lib/api/endpoints";
import { SHORT_PARAM, buildBacktestInput, MAX_SYMBOLS, shortParamOf, type BacktestFormValues } from "@/lib/backtest-form";
import { formatDuration, formatFraction, formatNumber } from "@/lib/format";
import { CANDLE_INTERVALS, type Strategies } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { OverfittingNotice } from "./overfitting-notice";
import { RunReading } from "./run-reading";

const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Field({ id, label, error, hint, children, className }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-loss">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Plain-language reading of the run that just finished (loads the stored run for the benchmark). */
function JustRanReading({ runId }: { runId: string }) {
  const stored = useBacktestRun(runId);
  if (!stored.data) return <p className="text-sm text-muted-foreground">Preparando a leitura do resultado…</p>;
  return <RunReading run={stored.data} compact />;
}

/** Ticks only while a run is in flight. */
function Elapsed({ since }: { since: number }) {
  const now = useNow(1000);
  return (
    <p className="text-sm text-muted-foreground">
      {formatDuration(now - since)} · baixar candles de um período longo pode levar alguns minutos.
    </p>
  );
}

export function BacktestForm({ strategies }: { strategies: Strategies }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<BacktestFormValues>(() => {
    const today = new Date();
    return {
      strategy: strategies.live.strategy,
      symbols: strategies.live.symbols[0] ?? "BTCUSDT",
      timeframe: strategies.live.timeframe,
      regimeTimeframe: strategies.live.regimeTimeframe,
      from: toInputDate(new Date(today.getTime() - 90 * 86_400_000)),
      to: toInputDate(today),
      initialBalance: "10000",
      feesPct: "0,1",
      slippagePct: "0,05",
      walkForwardDays: "",
      includeShort: shortParamOf(strategies.strategies.find((s) => s.name === strategies.live.strategy)?.params)?.value === 1,
      shortBorrowPctPerDay: "0,03",
      params: {},
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showParams, setShowParams] = useState(false);

  const strategy = strategies.strategies.find((s) => s.name === values.strategy);
  const params = strategy?.params ?? [];
  const shortParam = shortParamOf(params);
  // allowShort has its own switch below; the numeric grid shows the other knobs.
  const numericParams = params.filter((p) => p.key !== SHORT_PARAM);
  const changedParams = numericParams.filter((p) => values.params[p.key]?.trim() && Number(values.params[p.key].replace(",", ".")) !== p.value).length;

  const run = useMutation({
    mutationFn: api.backtest.run,
    onSuccess: async (r) => {
      toast.success("Backtest concluído", { description: `${r.tradeCount} trade(s) simulada(s).` });
      await Promise.all(["backtest", "trades", "reports", "equity"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    },
  });

  const set = <K extends keyof BacktestFormValues>(key: K, value: BacktestFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { input, errors: errs } = buildBacktestInput(values, params);
    setErrors(errs);
    if (!input) return;
    run.mutate(input);
  };
  const err = (k: string) => errors[k];
  const inputProps = (k: string) => ({ "aria-invalid": Boolean(err(k)) || undefined, "aria-describedby": err(k) ? `${k}-error` : undefined });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rodar backtest</CardTitle>
        <CardDescription>
          Simula a estratégia sobre candles históricos da Binance, com taxas e slippage, vendo o mercado como o bot ao vivo:
          mesma janela de candles, histórico de aquecimento antes do início e filtro de regime no próprio timeframe. As
          trades ficam gravadas como BACKTEST.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="strategy" label="Estratégia" error={err("strategy")}>
              <Select
                value={values.strategy}
                onValueChange={(v) =>
                  setValues((s) => ({
                    ...s,
                    strategy: v,
                    params: {},
                    includeShort: shortParamOf(strategies.strategies.find((x) => x.name === v)?.params)?.value === 1,
                  }))
                }
              >
                <SelectTrigger id="strategy" size="sm" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {strategies.strategies.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="symbols"
              label="Símbolos"
              error={err("symbols")}
              hint={
                <>
                  Separe por vírgula (até {MAX_SYMBOLS}). Com mais de um, o saldo é dividido igualmente.{" "}
                  <button type="button" className="underline" onClick={() => set("symbols", strategies.live.symbols.join(", "))}>
                    Usar os do bot
                  </button>
                </>
              }
            >
              <Input id="symbols" value={values.symbols} onChange={(e) => set("symbols", e.target.value.toUpperCase())} className="h-8 uppercase" autoComplete="off" {...inputProps("symbols")} />
            </Field>
            <Field id="timeframe" label="Timeframe">
              <Select value={values.timeframe} onValueChange={(v) => set("timeframe", v)}>
                <SelectTrigger id="timeframe" size="sm" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CANDLE_INTERVALS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="regimeTimeframe"
              label="Timeframe do regime"
              hint={values.regimeTimeframe === strategies.live.regimeTimeframe ? "Igual ao do bot ao vivo." : `O bot ao vivo usa ${strategies.live.regimeTimeframe}.`}
            >
              <Select value={values.regimeTimeframe} onValueChange={(v) => set("regimeTimeframe", v)}>
                <SelectTrigger id="regimeTimeframe" size="sm" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CANDLE_INTERVALS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="initialBalance" label="Saldo inicial (USDT)" error={err("initialBalance")}>
              <Input id="initialBalance" inputMode="decimal" value={values.initialBalance} onChange={(e) => set("initialBalance", e.target.value)} className="h-8" {...inputProps("initialBalance")} />
            </Field>
            <Field id="from" label="De" error={err("from")}>
              <Input id="from" type="date" value={values.from} max={values.to} onChange={(e) => set("from", e.target.value)} className="h-8" {...inputProps("from")} />
            </Field>
            <Field id="to" label="Até" error={err("to")}>
              <Input id="to" type="date" value={values.to} min={values.from} onChange={(e) => set("to", e.target.value)} className="h-8" {...inputProps("to")} />
            </Field>
            <Field id="feesPct" label="Taxa por lado (%)" error={err("feesPct")} hint="0,1% = taxa padrão da Binance.">
              <Input id="feesPct" inputMode="decimal" value={values.feesPct} onChange={(e) => set("feesPct", e.target.value)} className="h-8" {...inputProps("feesPct")} />
            </Field>
            <Field id="slippagePct" label="Slippage (%)" error={err("slippagePct")} hint="Aplicado contra você na entrada e na saída.">
              <Input id="slippagePct" inputMode="decimal" value={values.slippagePct} onChange={(e) => set("slippagePct", e.target.value)} className="h-8" {...inputProps("slippagePct")} />
            </Field>
            <Field id="walkForwardDays" label="Walk-forward (dias por janela)" error={err("walkForwardDays")} hint="Opcional. Divide o período em janelas consecutivas.">
              <Input id="walkForwardDays" inputMode="numeric" placeholder="Desligado" value={values.walkForwardDays} onChange={(e) => set("walkForwardDays", e.target.value)} className="h-8" {...inputProps("walkForwardDays")} />
            </Field>
          </div>

          {shortParam && (
            <div className="flex flex-wrap items-start gap-4 rounded-lg border p-3">
              <label htmlFor="includeShort" className="flex max-w-md cursor-pointer items-start gap-2 text-sm">
                <input
                  id="includeShort"
                  type="checkbox"
                  checked={values.includeShort}
                  onChange={(e) => set("includeShort", e.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  <span className="font-medium">Incluir Short</span>
                  <span className="block text-xs text-muted-foreground">
                    Espelho das regras de compra: vende a descoberto quando a tendência maior é de baixa. No bot ao vivo está{" "}
                    {shortParam.value === 1 ? "ligado" : "desligado"}. Para medir o efeito, rode o mesmo período com e sem.
                  </span>
                </span>
              </label>
              {values.includeShort && (
                <Field
                  id="shortBorrowPctPerDay"
                  label="Custo do short (% ao dia)"
                  error={err("shortBorrowPctPerDay")}
                  hint="Juros/funding de manter a posição vendida. 0,03% ≈ funding da Binance."
                >
                  <Input
                    id="shortBorrowPctPerDay"
                    inputMode="decimal"
                    value={values.shortBorrowPctPerDay}
                    onChange={(e) => set("shortBorrowPctPerDay", e.target.value)}
                    className="h-8 w-32"
                    {...inputProps("shortBorrowPctPerDay")}
                  />
                </Field>
              )}
            </div>
          )}

          {numericParams.length > 0 && (
            <div className="rounded-lg border">
              <button
                type="button"
                onClick={() => setShowParams((s) => !s)}
                aria-expanded={showParams}
                aria-controls="bt-params"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
              >
                <span>
                  Parâmetros da estratégia{" "}
                  <span className="font-normal text-muted-foreground">
                    ({changedParams ? `${changedParams} alterado(s)` : "valores configurados no backend"})
                  </span>
                </span>
                <ChevronDown className={cn("size-4 transition-transform", showParams && "rotate-180")} aria-hidden />
              </button>
              {showParams && (
                <div id="bt-params" className="grid gap-4 border-t p-3 sm:grid-cols-2 lg:grid-cols-5">
                  {numericParams.map((p) => (
                    <Field
                      key={p.key}
                      id={`param.${p.key}`}
                      label={p.description}
                      error={err(`param.${p.key}`)}
                      hint={`Atual: ${formatNumber(p.value, p.integer ? 0 : 2)} · ${p.min}–${p.max}`}
                    >
                      <Input
                        id={`param.${p.key}`}
                        inputMode={p.integer ? "numeric" : "decimal"}
                        placeholder={formatNumber(p.value, p.integer ? 0 : 2)}
                        value={values.params[p.key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, params: { ...v.params, [p.key]: e.target.value } }))}
                        className="h-8"
                        {...inputProps(`param.${p.key}`)}
                      />
                    </Field>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={run.isPending}>
              {run.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              {run.isPending ? "Rodando…" : "Rodar backtest"}
            </Button>
            {run.isPending && run.submittedAt > 0 && (
              <Elapsed since={run.submittedAt} />
            )}
          </div>

          {run.isError && (
            <p role="alert" className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm">
              <strong>{describeError(run.error).title}:</strong> {describeError(run.error).message}
            </p>
          )}

          {run.data && (
            <div className="space-y-3 rounded-lg border p-3" aria-live="polite">
              <p className="text-sm font-medium">Resultado</p>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Trades</dt>
                  <dd className="tabular-nums">
                    {run.data.tradeCount}
                    {run.data.summary.shortCount != null && run.data.summary.shortCount > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({run.data.summary.longCount ?? 0} long · {run.data.summary.shortCount} short)
                      </span>
                    )}
                  </dd>
                </div>
                <div><dt className="text-xs text-muted-foreground">PnL total</dt><dd><Pnl value={run.data.summary.totalPnl} /></dd></div>
                <div><dt className="text-xs text-muted-foreground">Win rate</dt><dd className="tabular-nums">{run.data.tradeCount ? formatFraction(run.data.summary.winRate, 1) : "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Max drawdown</dt><dd className="tabular-nums">{formatFraction(run.data.summary.maxDrawdownPct, 1)}</dd></div>
              </dl>
              <JustRanReading runId={run.data.runId} />
              <OverfittingNotice strategy={values.strategy} variations={run.data.paramVariationsTestedForStrategy} />
              <Button asChild variant="outline" size="sm">
                <Link href={`/backtests/${encodeURIComponent(run.data.runId)}`}>Ver execução</Link>
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
