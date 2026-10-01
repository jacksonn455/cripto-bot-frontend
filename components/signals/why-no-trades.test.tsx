import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { botStatusFixture, candlesFixture, signalsPageFixture, strategiesFixture } from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import { SignalsList } from "./signals-list";
import { WhyNoTrades } from "./why-no-trades";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const NOW = Date.parse("2026-09-29T12:34:30.000Z");

function status(snapshots: Record<string, unknown>) {
  return { ...botStatusFixture, paused: false, pauseReason: undefined, lastPollAt: new Date(NOW - 20_000).toISOString(), lastSignalBySymbol: snapshots };
}

/** 60 closed 1h candles, rising at the end so EMA20 ends above EMA50 after crossing. */
function rising() {
  return Array.from({ length: 60 }, (_, i) => ({
    ...candlesFixture[0],
    openTime: NOW - (61 - i) * 3_600_000,
    closeTime: NOW - (60 - i) * 3_600_000 - 1,
    close: i < 40 ? 100 - i * 0.1 : 96 + (i - 40) * 0.5,
  }));
}

function stub(snapshots: Record<string, unknown>, candles = rising()) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      mockApi([
        { path: "bot/status", body: status(snapshots) },
        { path: "strategies", body: { ...strategiesFixture, strategies: [{ ...strategiesFixture.strategies[0], params: [...strategiesFixture.strategies[0].params, { key: "rsiMin", description: "", min: 0, max: 100, integer: false, value: 45 }, { key: "rsiMax", description: "", min: 0, max: 100, integer: false, value: 70 }] }] } },
        { path: "exchange/candles", body: candles },
      ]).fetchMock,
    ),
  );
}

const waitingSnapshot = {
  action: "HOLD",
  reason: "sem cruzamento EMA rapida/lenta",
  at: new Date(NOW - 34 * 60_000).toISOString(),
  candleTime: new Date(NOW - 35 * 60_000).toISOString(),
  price: 101,
  indicators: { emaFast: 99.9, emaSlow: 100, rsi: 57.7, atr: 1, emaRegime: 90 },
};

describe("WhyNoTrades", () => {
  it("summarizes, checks each condition with its number and counts down to the next candle", async () => {
    stub({ BTCUSDT: waitingSnapshot, ETHUSDT: waitingSnapshot });
    renderWithProviders(<WhyNoTrades />);

    const btc = (await screen.findByRole("heading", { name: "BTCUSDT" })).closest("section")!;
    expect(within(btc).getByText("O Krypto está funcionando e esperando o cruzamento das médias. Tendência e RSI estão ok.")).toBeInTheDocument();
    expect(within(btc).getByText(/EMA20 está 0,10% abaixo da EMA50, falta subir 0,10%/)).toBeInTheDocument();
    expect(within(btc).getByText(/RSI atual 57,7 \(faixa aceita: 45 a 70\)/)).toBeInTheDocument();
    expect(within(btc).getByText("(aguardando)")).toBeInTheDocument();
    expect(within(btc).getAllByText("(atendida)")).toHaveLength(2);
    expect(screen.getByText("25:30")).toBeInTheDocument(); // 12:34:30 → 13:00:00
    expect(within(btc).getByText(/há 34 min/)).toBeInTheDocument();
  });

  it("explains 'already crossed' when the fast average is above the slow one", async () => {
    stub({ BTCUSDT: { ...waitingSnapshot, indicators: { ...waitingSnapshot.indicators, emaFast: 100.1, emaSlow: 100 } }, ETHUSDT: waitingSnapshot });
    renderWithProviders(<WhyNoTrades />);
    const btc = (await screen.findByRole("heading", { name: "BTCUSDT" })).closest("section")!;
    expect(await within(btc).findByText(/Já cruzou no candle que fechou .* precisa cair e cruzar de novo/)).toBeInTheDocument();
  });

  it("warns when the loop is paused", async () => {
    stub({ BTCUSDT: waitingSnapshot });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        mockApi([
          { path: "bot/status", body: { ...status({ BTCUSDT: waitingSnapshot }), paused: true, pauseReason: "MANUAL" } },
          { path: "strategies", body: strategiesFixture },
          { path: "exchange/candles", body: rising() },
        ]).fetchMock,
      ),
    );
    renderWithProviders(<WhyNoTrades />);
    expect(await screen.findByRole("alert")).toHaveTextContent("O Krypto está pausado");
  });
});

describe("SignalsList empty state", () => {
  it("explains why the list is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(mockApi([{ path: "signals", body: { items: [], total: 0, page: 1, limit: 50 } }]).fetchMock));
    renderWithProviders(<SignalsList />);
    expect(await screen.findByText("Nenhum sinal de entrada ainda")).toBeInTheDocument();
    expect(screen.getByText(/Enquanto o Krypto só diz “sem entrada”, esta lista fica vazia, e isso é esperado/)).toBeInTheDocument();
  });

  it("shows the last signal when filters hide everything", async () => {
    const spy = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://x");
      const body = url.searchParams.get("symbol") === "SOLUSDT" ? { items: [], total: 0, page: 1, limit: 50 } : { ...signalsPageFixture, items: [signalsPageFixture.items[0]] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", spy);
    const user = (await import("@testing-library/user-event")).default.setup();
    renderWithProviders(<SignalsList />);
    await screen.findByText("Vetado");
    await user.type(screen.getByLabelText("Símbolo"), "SOLUSDT");
    expect(await screen.findByText(/Último sinal \(sem filtros\): .* BTCUSDT · vetado/)).toBeInTheDocument();
  });
});

describe("WhyNoTrades - persisted evaluation states", () => {
  const structured = {
    ...waitingSnapshot,
    at: "2026-09-29T12:00:30.000Z",
    candleTime: "2026-09-29T11:59:59.999Z",
    source: "cycle",
    side: "LONG",
    conditions: [
      { key: "cross", ok: false, value: 99.9, threshold: "EMA50 100.00", message: "x" },
      { key: "regime", ok: true, value: 101, threshold: "EMA200 (4h) 90.00", message: "y" },
      { key: "rsi", ok: true, value: 57.7, threshold: "45 a 70", message: "z" },
    ],
    decision: { outcome: "NOT_ENTERED", reason: "sem cruzamento EMA rapida/lenta" },
  };

  function stubStatus(extra: Record<string, unknown>) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        mockApi([
          { path: "bot/status", body: { ...status({}), ...extra } },
          { path: "strategies", body: strategiesFixture },
          { path: "exchange/candles", body: rising() },
        ]).fetchMock,
      ),
    );
  }

  it("shows the stored snapshot with its date and the structured conditions", async () => {
    stubStatus({ lastSignalBySymbol: { BTCUSDT: structured, ETHUSDT: { ...structured, source: "reconciliation" } } });
    renderWithProviders(<WhyNoTrades />);

    const btc = (await screen.findByRole("heading", { name: "BTCUSDT" })).closest("section")!;
    expect(within(btc).getByText(/Última avaliação:/)).toHaveTextContent(/29\/09\/2026, \d{2}:00/);
    expect(within(btc).getByText(/RSI atual 57,7/)).toBeInTheDocument();
    expect(within(btc).getAllByText("(atendida)")).toHaveLength(2);
    expect(within(btc).queryByText(/Sem dado ainda/)).not.toBeInTheDocument();
    expect(screen.queryByText(/desde que o backend iniciou/)).not.toBeInTheDocument();
    const eth = screen.getByRole("heading", { name: "ETHUSDT" }).closest("section")!;
    expect(within(eth).getByText(/reavaliado após reinício/)).toBeInTheDocument();
  });

  it("says it is loading the history while the worker is up and nothing is stored yet", async () => {
    stubStatus({ lastSignalBySymbol: {} });
    renderWithProviders(<WhyNoTrades />);

    const btc = (await screen.findByRole("heading", { name: "BTCUSDT" })).closest("section")!;
    expect(within(btc).getAllByText(/Carregando dados históricos…/).length).toBeGreaterThan(0);
    expect(within(btc).queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows the exchange error instead of a misleading empty state", async () => {
    stubStatus({ lastSignalBySymbol: {}, symbolErrors: { BTCUSDT: { message: "HTTP 451", at: "2026-09-29T12:30:00.000Z" } } });
    renderWithProviders(<WhyNoTrades />);

    const btc = (await screen.findByRole("heading", { name: "BTCUSDT" })).closest("section")!;
    expect(within(btc).getByRole("alert")).toHaveTextContent(/Erro ao obter dados da exchange .*HTTP 451/);
    expect(within(btc).queryByText(/Carregando dados históricos/)).not.toBeInTheDocument();
  });
});
