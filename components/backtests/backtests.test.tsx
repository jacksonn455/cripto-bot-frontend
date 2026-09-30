import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { backtestRunFixture, backtestRunResponseFixture, candlesFixture, runsPage, strategiesFixture } from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import { MarketView } from "@/components/market/market-view";
import { BacktestsView } from "./backtests-view";
import { CompareView } from "./compare-view";
import { OverfittingNotice } from "./overfitting-notice";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
const chartProps = vi.fn();
vi.mock("@/components/charts/candle-chart", () => ({
  CHART_PALETTE: { light: { entry: "#2a78d6", exit: "#eb6834" }, dark: { entry: "#3987e5", exit: "#d95926" } },
  CandleChart: (p: unknown) => {
    chartProps(p);
    return <div data-testid="candle-chart" />;
  },
}));
vi.mock("@/components/charts/equity-chart", () => ({ EquityChart: () => <div data-testid="equity-chart" /> }));

afterEach(() => {
  vi.unstubAllGlobals();
  chartProps.mockClear();
});

function stub(routes: Parameters<typeof mockApi>[0]) {
  const api = mockApi(routes);
  vi.stubGlobal("fetch", vi.fn(api.fetchMock));
  return api;
}

describe("OverfittingNotice", () => {
  it("escalates with the number of tested variations", () => {
    const { rerender } = renderWithProviders(<OverfittingNotice strategy="S" variations={1} />);
    expect(screen.getByRole("note")).toHaveTextContent("1 combinação de parâmetros testada");
    rerender(<OverfittingNotice strategy="S" variations={12} />);
    expect(screen.getByRole("note")).toHaveTextContent("12 combinações de parâmetros testadas");
    expect(screen.getByRole("note")).toHaveTextContent("Risco alto de overfitting");
  });
});

describe("BacktestsView", () => {
  it("runs a backtest sending only changed strategy params and shows the overfitting count", async () => {
    const api = stub([
      { path: "strategies", body: strategiesFixture },
      { path: "backtest/runs", body: runsPage([backtestRunFixture]) },
      { path: `backtest/runs/${backtestRunResponseFixture.runId}`, body: backtestRunFixture },
      { method: "POST", path: "backtest/run", body: { ...backtestRunResponseFixture, paramVariationsTestedForStrategy: 4 } },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<BacktestsView />);

    // Banner from the runs list.
    expect(await screen.findByText(/3 combinações de parâmetros testadas/)).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /parâmetros da estratégia/i }));
    await user.type(screen.getByLabelText("EMA rápida (períodos)"), "10");
    await user.type(screen.getByLabelText("EMA lenta (períodos)"), "50"); // same as configured → not sent
    await user.click(screen.getByRole("button", { name: "Rodar backtest" }));

    await screen.findByText("Resultado", { selector: "p" });
    const body = JSON.parse(api.calls.find((c) => c.path === "backtest/run")!.body!);
    expect(body).toMatchObject({ strategy: "TrendRegimeStrategy", symbols: ["BTCUSDT"], timeframe: "1h", regimeTimeframe: "4h", feesPct: 0.001, slippagePct: 0.0005 });
    expect(body.strategyParams).toEqual({ emaFast: 10 });
    expect(screen.getByText(/4 combinações de parâmetros testadas/)).toBeInTheDocument();
    // Plain-language reading of the stored run (10 trades → inconclusive).
    expect(await screen.findByText("Veredito: Inconclusivo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver execução" })).toHaveAttribute("href", `/backtests/${backtestRunResponseFixture.runId}`);
  });

  it("fills the bot's symbols with one click and sends them all", async () => {
    const api = stub([
      { path: "strategies", body: strategiesFixture },
      { path: "backtest/runs", body: runsPage([]) },
      { method: "POST", path: "backtest/run", body: backtestRunResponseFixture },
      { path: `backtest/runs/${backtestRunResponseFixture.runId}`, body: backtestRunFixture },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<BacktestsView />);

    await user.click(await screen.findByRole("button", { name: "Usar os do bot" }));
    expect(screen.getByLabelText("Símbolos")).toHaveValue("BTCUSDT, ETHUSDT");
    await user.click(screen.getByRole("button", { name: "Rodar backtest" }));
    await screen.findByText("Resultado", { selector: "p" });
    expect(JSON.parse(api.calls.find((c) => c.path === "backtest/run")!.body!).symbols).toEqual(["BTCUSDT", "ETHUSDT"]);
  });

  it("blocks invalid input without calling the backend", async () => {
    const api = stub([
      { path: "strategies", body: strategiesFixture },
      { path: "backtest/runs", body: runsPage([]) },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<BacktestsView />);

    const symbols = await screen.findByLabelText("Símbolos");
    await user.clear(symbols);
    await user.type(symbols, "BTC");
    await user.click(screen.getByRole("button", { name: "Rodar backtest" }));

    expect(screen.getByText(/Formato inválido: BTC/)).toBeInTheDocument();
    expect(api.calls.some((c) => c.path === "backtest/run")).toBe(false);
    expect(screen.getByText("Nenhum backtest ainda")).toBeInTheDocument();
  });

  it("'Incluir Short' sends allowShort=1 plus the short carry cost", async () => {
    const api = stub([
      { path: "strategies", body: strategiesFixture },
      { path: "backtest/runs", body: runsPage([backtestRunFixture]) },
      { path: `backtest/runs/${backtestRunResponseFixture.runId}`, body: backtestRunFixture },
      { method: "POST", path: "backtest/run", body: backtestRunResponseFixture },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<BacktestsView />);

    await user.click(await screen.findByRole("checkbox", { name: /incluir short/i }));
    expect(screen.getByLabelText(/custo do short/i)).toHaveValue("0,03");
    await user.click(screen.getByRole("button", { name: /rodar backtest/i }));

    await waitFor(() => expect(api.calls.some((c) => c.method === "POST")).toBe(true));
    const body = JSON.parse(api.calls.find((c) => c.method === "POST")!.body!);
    expect(body.strategyParams).toEqual({ allowShort: 1 });
    expect(body.shortBorrowPctPerDay).toBeCloseTo(0.0003);
  });

  it("enables comparing only with two runs selected", async () => {
    const second = { ...backtestRunFixture, runId: "bt_2", createdAt: "2026-09-29T12:00:00.000Z" };
    stub([
      { path: "strategies", body: strategiesFixture },
      { path: "backtest/runs", body: runsPage([second, backtestRunFixture]) },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<BacktestsView />);

    // Only the run-selection boxes (the form also has an "Incluir Short" checkbox).
    const boxes = await screen.findAllByRole("checkbox", { name: /selecionar/i });
    expect(screen.getByRole("button", { name: /comparar/i })).toBeDisabled();
    await user.click(boxes[0]);
    await user.click(boxes[1]);
    expect(screen.getByRole("link", { name: /comparar/i })).toHaveAttribute("href", `/backtests/compare?a=bt_2&b=${backtestRunFixture.runId}`);
  });
});

describe("CompareView", () => {
  it("highlights parameters that differ between the two runs", async () => {
    const a = { ...backtestRunFixture, runId: "a", params: { ...backtestRunFixture.params, strategyParams: { emaFast: 20, emaSlow: 50 } } };
    const b = { ...backtestRunFixture, runId: "b", timeframe: "4h", params: { ...backtestRunFixture.params, strategyParams: { emaFast: 10, emaSlow: 50 } } };
    stub([
      { path: "backtest/runs/a", body: a },
      { path: "backtest/runs/b", body: b },
      { path: "reports/equity-curve", body: [] },
    ]);
    renderWithProviders(<CompareView a="a" b="b" />);

    expect(await screen.findByText("(2 diferente(s))")).toBeInTheDocument();
    const row = screen.getByText("emaFast").closest("tr")!;
    expect(within(row).getByText("(diferente)")).toBeInTheDocument();
    expect(within(screen.getByText("emaSlow").closest("tr")!).queryByText("(diferente)")).not.toBeInTheDocument();
  });
});

describe("MarketView", () => {
  it("draws EMAs with the strategy's periods and marks trades of the data mode", async () => {
    const candles = Array.from({ length: 60 }, (_, i) => ({ ...candlesFixture[0], openTime: 1_790_000_000_000 + i * 3_600_000, close: 100 + i }));
    const trade = { ...(await import("@/test/fixtures")).closedTradeFixture, entryTime: new Date(candles[10].openTime).toISOString(), exitTime: new Date(candles[20].openTime).toISOString() };
    const fetchSpy = vi.fn(
      mockApi([
        { path: "strategies", body: { ...strategiesFixture, strategies: [{ ...strategiesFixture.strategies[0], params: [{ ...strategiesFixture.strategies[0].params[0], value: 5 }, strategiesFixture.strategies[0].params[1]] }] } },
        { path: "exchange/candles", body: candles },
        { path: "trades", body: { items: [trade], total: 1, page: 1, limit: 200 } },
      ]).fetchMock,
    );
    vi.stubGlobal("fetch", fetchSpy);
    renderWithProviders(<MarketView />, { mode: "PAPER" });

    await waitFor(() => {
      const last = chartProps.mock.lastCall?.[0] as { overlays: Array<{ title: string; points: unknown[] }>; markers: unknown[] } | undefined;
      expect(last?.markers).toHaveLength(2);
    });
    const props = chartProps.mock.lastCall![0] as { overlays: Array<{ title: string; points: unknown[] }> };
    // emaFast from /strategies (5), emaSlow (50), emaRegime falls back to 200.
    expect(props.overlays.map((o) => o.title)).toEqual(["EMA5", "EMA50", "EMA200"]);
    expect(props.overlays.map((o) => o.points.length)).toEqual([56, 11, 0]);

    const tradesUrl = new URL(String(fetchSpy.mock.calls.find(([u]) => String(u).includes("/trades?"))![0]), "http://x");
    expect(tradesUrl.searchParams.get("mode")).toBe("PAPER");
    expect(tradesUrl.searchParams.get("symbol")).toBe("BTCUSDT");
    expect(screen.getByText(/1 trade\(s\) de PAPER marcadas/)).toBeInTheDocument();
  });
});
