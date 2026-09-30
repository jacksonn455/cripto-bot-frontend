import { formatDate, formatFraction, formatMoney, formatNumber } from "@/lib/format";
import type { BacktestRun } from "@/lib/schemas";

export interface ParamRow {
  key: string;
  label: string;
  value: string;
}

/** Everything that defines a run, as label/value rows (also used to diff two runs). */
export function runParamRows(run: BacktestRun): ParamRow[] {
  const initialBalance = typeof run.params.initialBalance === "number" ? run.params.initialBalance : null;
  const strategyParams = (run.params.strategyParams ?? {}) as Record<string, unknown>;
  const num = (k: string) => (typeof run.params[k] === "number" ? (run.params[k] as number) : null);
  const regime = typeof run.params.regimeTimeframe === "string" ? run.params.regimeTimeframe : null;
  const lookback = num("candleLookback");
  const allocation = num("allocationPerSymbol");
  return [
    { key: "strategy", label: "Estratégia", value: run.strategy },
    { key: "symbols", label: "Símbolo", value: run.symbols.join(", ") },
    { key: "timeframe", label: "Timeframe", value: run.timeframe },
    { key: "regimeTimeframe", label: "Timeframe do regime", value: regime ?? "igual ao timeframe (execução antiga)" },
    ...(lookback != null ? [{ key: "candleLookback", label: "Janela por candle", value: `${formatNumber(lookback, 0)} candles` }] : []),
    { key: "period", label: "Período", value: `${formatDate(run.from)} – ${formatDate(run.to)}` },
    { key: "initialBalance", label: "Saldo inicial", value: initialBalance != null ? formatMoney(initialBalance) : "—" },
    ...(allocation != null && run.symbols.length > 1
      ? [{ key: "allocation", label: "Por símbolo", value: formatMoney(allocation) }]
      : []),
    { key: "feesPct", label: "Taxa por lado", value: formatFraction(run.feesPct, 3) },
    { key: "slippagePct", label: "Slippage", value: formatFraction(run.slippagePct, 3) },
    ...(run.walkForwardWindows?.length
      ? [{ key: "walkForward", label: "Walk-forward", value: `${run.walkForwardWindows.length} janela(s)` }]
      : []),
    ...Object.entries(strategyParams).map(([k, v]) => ({
      key: `sp.${k}`,
      label: k,
      value: typeof v === "number" ? formatNumber(v, Number.isInteger(v) ? 0 : 2) : String(v),
    })),
  ];
}

export function RunParams({ run }: { run: BacktestRun }) {
  const rows = runParamRows(run);
  const hasStrategyParams = rows.some((r) => r.key.startsWith("sp."));
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((r) => (
          <div key={r.key} className="space-y-0.5">
            <dt className={r.key.startsWith("sp.") ? "font-mono text-xs text-muted-foreground" : "text-xs text-muted-foreground"}>{r.label}</dt>
            <dd className="text-sm tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
      {!hasStrategyParams && (
        <p className="text-xs text-muted-foreground">Execução anterior ao registro dos parâmetros da estratégia: só os parâmetros gerais foram salvos.</p>
      )}
    </div>
  );
}
