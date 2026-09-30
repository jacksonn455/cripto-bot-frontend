import { describe, expect, it } from "vitest";
import { mergeEvents, MAX_RECENT, toLiveEvent, type LiveEvent } from "./live-events-provider";

const ev = (id: string | undefined, at: number): LiveEvent => ({ type: "bot.resumed", data: {}, id, receivedAt: at });

describe("toLiveEvent", () => {
  it("validates known payloads and drops unknown types or malformed data", () => {
    expect(toLiveEvent("bot.cycle", { symbol: "BTCUSDT", action: "HOLD", reason: "x", at: "2026-09-29T12:00:00.000Z", mode: "PAPER" }, 1, "a")).toMatchObject({
      type: "bot.cycle",
      id: "a",
    });
    expect(toLiveEvent("nao.existe", {}, 1)).toBeNull();
    expect(toLiveEvent("trade.closed", { symbol: 1 }, 1)).toBeNull();
  });
});

describe("mergeEvents", () => {
  it("dedupes history and live events by id and sorts newest first", () => {
    const history = [ev("b", 200), ev("a", 100)];
    const live = [ev("b", 205), ev("c", 300)];
    expect(mergeEvents(history, live).map((e) => e.id)).toEqual(["c", "b", "a"]);
  });

  it("drops events from before a clear and caps the list", () => {
    expect(mergeEvents([ev("a", 100)], [ev("b", 200)], 150).map((e) => e.id)).toEqual(["b"]);
    const many = Array.from({ length: MAX_RECENT + 50 }, (_, i) => ev(String(i), i));
    expect(mergeEvents([], many)).toHaveLength(MAX_RECENT);
  });
});
