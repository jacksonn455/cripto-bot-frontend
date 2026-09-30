import { describe, expect, it } from "vitest";
import { formatDuration, formatFraction, formatMoney, formatSignedMoney, formatSignedPercent, MINUS, toneOf } from "./format";

// Intl uses a narrow no-break space in some outputs; normalize for readable assertions.
const n = (s: string) => s.replace(/[  ]/g, " ");

describe("format", () => {
  it("formats money in pt-BR", () => {
    expect(n(formatMoney(1234.5))).toBe("1.234,50 USDT");
  });

  it("always shows the sign on PnL, with a real minus", () => {
    expect(n(formatSignedMoney(54))).toBe("+54,00 USDT");
    expect(n(formatSignedMoney(-54))).toBe(`${MINUS}54,00 USDT`);
    expect(n(formatSignedMoney(0))).toBe("0,00 USDT");
    expect(formatSignedPercent(-2.5)).toBe(`${MINUS}2,50%`);
  });

  it("formats fractions as percent", () => {
    expect(formatFraction(0.6)).toBe("60,00%");
  });

  it("formats durations", () => {
    expect(formatDuration(30_000)).toBe("30 s");
    expect(formatDuration(45 * 60_000)).toBe("45 min");
    expect(formatDuration(3 * 3_600_000 + 15 * 60_000)).toBe("3 h 15 min");
    expect(formatDuration(51 * 3_600_000)).toBe("2 d 3 h");
  });

  it("derives tone from value", () => {
    expect(toneOf(1)).toBe("profit");
    expect(toneOf(-1)).toBe("loss");
    expect(toneOf(0)).toBe("neutral");
    expect(toneOf(undefined)).toBe("neutral");
  });
});
