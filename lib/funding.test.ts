import { describe, expect, it } from "vitest";
import { BASELINE_ANNUALIZED_PCT, interpretRate, marketMood } from "./funding";

describe("interpretRate", () => {
  it("tells who pays and how strong it is", () => {
    expect(interpretRate(0.0001, 10.95)).toEqual({ payer: "longs", intensity: "normal" });
    expect(interpretRate(-0.0003, -32.85)).toEqual({ payer: "shorts", intensity: "elevated" });
    expect(interpretRate(0.002, 219)).toEqual({ payer: "longs", intensity: "extreme" });
    expect(interpretRate(0, 0)).toEqual({ payer: "none", intensity: "zero" });
  });
});

describe("marketMood", () => {
  it("reads the median against Binance's default rate", () => {
    expect(BASELINE_ANNUALIZED_PCT).toBeCloseTo(10.95);
    expect(marketMood(-2).title).toBe("Mercado pessimista");
    expect(marketMood(5.5).title).toBe("Mercado equilibrado");
    expect(marketMood(18).title).toBe("Otimismo acima do normal");
    expect(marketMood(45).title).toMatch(/Euforia/);
  });
});
