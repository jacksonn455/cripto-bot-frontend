import { describe, expect, it } from "vitest";
import { strategiesFixture } from "@/test/fixtures";
import { buildBacktestInput, type BacktestFormValues } from "./backtest-form";

const params = strategiesFixture.strategies[0].params;
const NOW = new Date(2026, 8, 29, 12, 0).getTime();
const base: BacktestFormValues = {
  strategy: "TrendRegimeStrategy",
  symbols: "btcusdt",
  timeframe: "1h",
  regimeTimeframe: "4h",
  from: "2026-06-01",
  to: "2026-06-30",
  initialBalance: "10000",
  feesPct: "0,1",
  slippagePct: "0.05",
  walkForwardDays: "",
  params: {},
};

describe("buildBacktestInput", () => {
  it("builds the request with fractions, uppercase symbol and whole local days", () => {
    const { input, errors } = buildBacktestInput(base, params, NOW);
    expect(errors).toEqual({});
    expect(input).toMatchObject({ symbols: ["BTCUSDT"], regimeTimeframe: "4h", feesPct: 0.001, slippagePct: 0.0005, initialBalance: 10000 });
    expect(new Date(input!.from).getHours()).toBe(0);
    expect(new Date(input!.to).getHours()).toBe(23);
    expect(input).not.toHaveProperty("strategyParams");
    expect(input).not.toHaveProperty("walkForward");
  });

  it("sends only parameters that differ from the configured value", () => {
    const { input } = buildBacktestInput({ ...base, params: { emaFast: "10", emaSlow: "50", atrStopMultiplier: "2,5" } }, params, NOW);
    expect(input!.strategyParams).toEqual({ emaFast: 10, atrStopMultiplier: 2.5 });
  });

  it("validates with the backend's limits", () => {
    const { input, errors } = buildBacktestInput(
      { ...base, symbols: "btc", to: "2026-05-01", feesPct: "20", walkForwardDays: "1.5", params: { emaFast: "1", emaSlow: "7.5" } },
      params,
      NOW,
    );
    expect(input).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual(["feesPct", "param.emaFast", "param.emaSlow", "symbols", "to", "walkForwardDays"]);
    expect(errors["param.emaFast"]).toBe("Entre 2 e 200.");
    expect(errors["param.emaSlow"]).toBe("Precisa ser inteiro.");
  });

  it("accepts several symbols separated by commas or spaces, deduplicated", () => {
    const { input } = buildBacktestInput({ ...base, symbols: "btcusdt, ethusdt  BTCUSDT;solusdt" }, params, NOW);
    expect(input!.symbols).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
  });

  it("rejects more than 10 symbols and names the invalid ones", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `SYM${i}USDT`).join(",");
    expect(buildBacktestInput({ ...base, symbols: eleven }, params, NOW).errors.symbols).toBe("No máximo 10 símbolos por execução.");
    expect(buildBacktestInput({ ...base, symbols: "BTCUSDT, xx" }, params, NOW).errors.symbols).toContain("XX");
  });

  it("never asks for data past now", () => {
    const { input } = buildBacktestInput({ ...base, to: "2026-12-31" }, params, NOW);
    expect(new Date(input!.to).getTime()).toBe(NOW);
  });
});
