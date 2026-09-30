import type { RunBacktestInput, StrategyParam } from "@/lib/schemas";

export const MAX_SYMBOLS = 10;
/** Strategy parameter that turns the short side on (0/1). */
export const SHORT_PARAM = "allowShort";

export interface BacktestFormValues {
  strategy: string;
  /** One or more symbols, separated by commas or spaces. */
  symbols: string;
  timeframe: string;
  regimeTimeframe: string;
  /** yyyy-mm-dd, local. */
  from: string;
  to: string;
  initialBalance: string;
  /** In percent, as typed (0,1 = 0.1%). */
  feesPct: string;
  slippagePct: string;
  walkForwardDays: string;
  /** Run with the short side on (strategy param allowShort = 1). */
  includeShort: boolean;
  /** In percent per day, as typed (0,03 = 0.03%/day). Only sent when includeShort. */
  shortBorrowPctPerDay: string;
  /** Raw inputs by param key; "" = keep the configured value. */
  params: Record<string, string>;
}

/** Accepts both "0,1" and "0.1". */
export function parseDecimal(value: string): number {
  return Number(value.trim().replace(",", "."));
}

function localDay(yyyyMmDd: string, endOfDay: boolean): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
}

/**
 * Validates the form (same limits the backend enforces) and builds the request body. Only
 * parameters that differ from their configured value are sent.
 */
export function buildBacktestInput(
  v: BacktestFormValues,
  params: StrategyParam[],
  now = Date.now(),
): { input?: RunBacktestInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!v.strategy) errors.strategy = "Escolha uma estratégia.";
  const symbols = [...new Set(v.symbols.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
  const invalid = symbols.filter((s) => !/^[A-Z0-9]{5,20}$/.test(s));
  if (symbols.length === 0) errors.symbols = "Informe ao menos um símbolo, por exemplo BTCUSDT.";
  else if (invalid.length) errors.symbols = `Formato inválido: ${invalid.join(", ")}. Use o da Binance, por exemplo BTCUSDT.`;
  else if (symbols.length > MAX_SYMBOLS) errors.symbols = `No máximo ${MAX_SYMBOLS} símbolos por execução.`;

  let from: Date | undefined;
  let to: Date | undefined;
  if (!v.from) errors.from = "Informe a data inicial.";
  else from = localDay(v.from, false);
  if (!v.to) errors.to = "Informe a data final.";
  else to = new Date(Math.min(localDay(v.to, true).getTime(), now));
  if (from && to && from >= to) errors.to = "A data final precisa ser depois da inicial.";

  const balance = parseDecimal(v.initialBalance);
  if (!(balance > 0)) errors.initialBalance = "Saldo inicial precisa ser maior que zero.";
  const fees = parseDecimal(v.feesPct);
  if (!(fees >= 0 && fees <= 10)) errors.feesPct = "Taxa entre 0% e 10%.";
  const slippage = parseDecimal(v.slippagePct);
  if (!(slippage >= 0 && slippage <= 10)) errors.slippagePct = "Slippage entre 0% e 10%.";

  let walkForward: RunBacktestInput["walkForward"];
  if (v.walkForwardDays.trim()) {
    const days = Number(v.walkForwardDays);
    if (!Number.isInteger(days) || days < 1) errors.walkForwardDays = "Número inteiro de dias, 1 ou mais.";
    else walkForward = { testWindowDays: days };
  }

  let shortBorrow: number | undefined;
  if (v.includeShort) {
    const perDay = parseDecimal(v.shortBorrowPctPerDay);
    if (!(perDay >= 0 && perDay <= 5)) errors.shortBorrowPctPerDay = "Custo do short entre 0% e 5% ao dia.";
    else shortBorrow = perDay / 100;
  }

  const strategyParams: Record<string, number> = {};
  for (const p of params) {
    // allowShort is driven by the "Incluir Short" switch, not by a numeric input.
    if (p.key === SHORT_PARAM) {
      const wanted = v.includeShort ? 1 : 0;
      if (wanted !== p.value) strategyParams[p.key] = wanted;
      continue;
    }
    const raw = v.params[p.key]?.trim();
    if (!raw) continue;
    const value = parseDecimal(raw);
    if (!Number.isFinite(value)) errors[`param.${p.key}`] = "Número inválido.";
    else if (p.integer && !Number.isInteger(value)) errors[`param.${p.key}`] = "Precisa ser inteiro.";
    else if (value < p.min || value > p.max) errors[`param.${p.key}`] = `Entre ${p.min} e ${p.max}.`;
    else if (value !== p.value) strategyParams[p.key] = value;
  }

  if (Object.keys(errors).length || !from || !to) return { errors };
  return {
    errors,
    input: {
      strategy: v.strategy,
      symbols,
      timeframe: v.timeframe,
      regimeTimeframe: v.regimeTimeframe,
      from: from.toISOString(),
      to: to.toISOString(),
      initialBalance: balance,
      feesPct: fees / 100,
      slippagePct: slippage / 100,
      ...(walkForward ? { walkForward } : {}),
      ...(v.includeShort && shortBorrow !== undefined ? { shortBorrowPctPerDay: shortBorrow } : {}),
      ...(Object.keys(strategyParams).length ? { strategyParams } : {}),
    },
  };
}

/** The strategy's short switch, when it has one (older backends don't). */
export function shortParamOf(params: StrategyParam[] | undefined): StrategyParam | undefined {
  return params?.find((p) => p.key === SHORT_PARAM);
}
