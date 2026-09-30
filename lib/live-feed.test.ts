import { describe, expect, it } from "vitest";
import { describeEvent } from "./live-feed";

const at = Date.UTC(2026, 8, 30, 12);

describe("describeEvent (Long/Short payloads)", () => {
  it("titles a closed trade with its side, pnl and %, and shows prices and the detail", () => {
    const item = describeEvent({
      type: "trade.closed",
      receivedAt: at,
      data: {
        symbol: "BTCUSDT",
        side: "SHORT",
        pnl: 15,
        pnlPct: 1.6,
        reason: "SIGNAL",
        mode: "PAPER",
        entryPrice: 62000,
        exitPrice: 61000,
        reasonDetail: "EMA20 cruzou acima da EMA50",
      },
    } as never);
    expect(item.title).toMatch(/^SHORT fechado em BTCUSDT: \+15,00 USDT \(\+1,60\s?%\)$/);
    expect(item.detail).toContain("62.000,00 → 61.000,00");
    expect(item.detail).toContain("EMA20 cruzou acima da EMA50");
    expect(item.tone).toBe("profit");
  });

  it("keeps working with the older, minimal payload", () => {
    const item = describeEvent({ type: "trade.closed", receivedAt: at, data: { symbol: "ETHUSDT", pnl: -3, reason: "SL", mode: "PAPER" } } as never);
    expect(item.title).toMatch(/^Saída em ETHUSDT: /);
    expect(item.detail).toBe("Stop loss");
  });

  it("adds timeframe and signal reason to an entry", () => {
    const item = describeEvent({
      type: "trade.opened",
      receivedAt: at,
      data: { symbol: "BTCUSDT", side: "SHORT", qty: 0.01, entryPrice: 62000, stopLoss: 63000, mode: "PAPER", timeframe: "1h", signalReason: "cruzou abaixo" },
    } as never);
    expect(item.title).toBe("Entrada SHORT em BTCUSDT");
    expect(item.detail).toContain("1h");
    expect(item.detail).toContain("cruzou abaixo");
  });
});
