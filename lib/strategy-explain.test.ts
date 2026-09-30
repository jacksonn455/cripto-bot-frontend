import { describe, expect, it } from "vitest";
import { conditionsFrom, formatCountdown, nextCandleClose, rangesFromParams, summarize, translateReason } from "./strategy-explain";

describe("translateReason", () => {
  it("translates each technical fragment the strategy emits", () => {
    expect(translateReason("sem cruzamento EMA rapida/lenta")).toBe("Média rápida ainda não cruzou a lenta");
    expect(translateReason("regime nao esta em alta; sem cruzamento EMA rapida/lenta; RSI fora da faixa")).toBe(
      "Tendência maior não está de alta · Média rápida ainda não cruzou a lenta · RSI fora da faixa de 45 a 70",
    );
    expect(translateReason("regime não está em alta")).toBe("Tendência maior não está de alta"); // accented variant
    expect(translateReason("strategy evaluation failed or not enough candle history yet")).toMatch(/histórico suficiente/);
  });

  it("uses the configured RSI range and passes unknown text through", () => {
    expect(translateReason("RSI fora da faixa", { ...rangesFromParams(undefined), rsiMin: 40, rsiMax: 65 })).toBe("RSI fora da faixa de 40 a 65");
    expect(translateReason("EMA20 cruzou acima da EMA50")).toBe("EMA20 cruzou acima da EMA50");
  });
});

describe("conditionsFrom + summarize", () => {
  it("only the cross missing", () => {
    const c = conditionsFrom("HOLD", "sem cruzamento EMA rapida/lenta");
    expect(c).toEqual({ kind: "waiting", side: "long", cross: false, regime: true, rsi: true });
    expect(summarize(c)).toBe("O bot está funcionando e esperando o cruzamento das médias. Tendência e RSI estão ok.");
  });

  it("several missing", () => {
    const c = conditionsFrom("HOLD", "regime nao esta em alta; sem cruzamento EMA rapida/lenta");
    expect(summarize(c)).toBe("O bot está funcionando e esperando o cruzamento das médias e a tendência maior de alta. RSI está ok.");
  });

  it("entry, open position, no data and nothing yet", () => {
    expect(conditionsFrom("ENTER_LONG", "EMA20 cruzou…").kind).toBe("entry");
    expect(conditionsFrom("HOLD", "Posição aberta, sem gatilho de saída").kind).toBe("position");
    expect(conditionsFrom("SKIP", "strategy evaluation failed or not enough candle history yet").kind).toBe("no-data");
    expect(summarize(conditionsFrom(undefined, undefined))).toMatch(/Ainda não há avaliação/);
  });
});

describe("countdown", () => {
  it("finds the next 1h close and formats it", () => {
    const now = Date.parse("2026-09-29T12:34:56.000Z");
    expect(new Date(nextCandleClose(now, 3_600_000)).toISOString()).toBe("2026-09-29T13:00:00.000Z");
    expect(formatCountdown(25 * 60_000 + 4_000)).toBe("25:04");
    expect(formatCountdown(3 * 3_600_000 + 5_000)).toBe("3:00:05");
  });
});

describe("candle time labels", () => {
  it("reads closes as round hours and shows the day only when it is not today", async () => {
    const { candleEnd, formatCandleRange, formatWhen } = await import("./strategy-explain");
    const close = new Date(2026, 8, 29, 21, 59, 59, 999).getTime();
    const now = new Date(2026, 8, 29, 22, 10).getTime();
    expect(new Date(candleEnd(close)).getHours()).toBe(22);
    expect(formatCandleRange(close, 3_600_000, now)).toBe("de 21:00 a 22:00");
    expect(formatWhen(new Date(2026, 8, 28, 6, 0).getTime(), now)).toBe("28/09 às 06:00");
  });
});

describe("short side", () => {
  const ranges = rangesFromParams([{ key: "allowShort", value: 1 }]);

  it("reads allowShort from the strategy params", () => {
    expect(ranges.allowShort).toBe(true);
    expect(rangesFromParams(undefined).allowShort).toBe(false);
  });

  it("translates the short reasons with the mirrored RSI band", () => {
    expect(translateReason("short: sem cruzamento EMA rapida abaixo da lenta; short: RSI fora da faixa", ranges)).toBe(
      "Short: média rápida ainda não cruzou para baixo da lenta · Short: RSI fora da faixa de 30 a 55",
    );
    expect(translateReason("regime indefinido (nem alta nem baixa)")).toMatch(/indefinida/);
  });

  it("evaluates the short checklist when the backend reported short reasons", () => {
    const c = conditionsFrom("HOLD", "short: sem cruzamento EMA rapida abaixo da lenta");
    expect(c).toEqual({ kind: "waiting", side: "short", cross: false, regime: true, rsi: true });
    expect(summarize(c)).toBe(
      "A tendência maior não está de alta, então o bot avalia o short: está esperando o cruzamento das médias para baixo. Tendência e RSI estão ok.",
    );
    expect(conditionsFrom("ENTER_SHORT", "EMA20 cruzou abaixo")).toMatchObject({ kind: "entry", side: "short" });
    expect(summarize(conditionsFrom("ENTER_SHORT", "x"))).toMatch(/venda a descoberto/);
  });
});
