import { describe, expect, it } from "vitest";
import { ema } from "./indicators";

describe("ema", () => {
  it("seeds with the SMA and applies k = 2/(n+1), aligned to the input", () => {
    // period 3: seed = (1+2+3)/3 = 2; then (4-2)*0.5+2 = 3; (5-3)*0.5+3 = 4
    expect(ema(3, [1, 2, 3, 4, 5])).toEqual([undefined, undefined, 2, 3, 4]);
  });

  it("returns only undefined when there is not enough data", () => {
    expect(ema(5, [1, 2, 3])).toEqual([undefined, undefined, undefined]);
  });
});
