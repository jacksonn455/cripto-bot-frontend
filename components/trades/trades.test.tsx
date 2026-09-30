import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { candlesFixture, closedTradeFixture, openTradeFixture, tradesPageFixture } from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import { TradeDetailView } from "./trade-detail-view";
import { TradesView } from "./trades-view";

// URL state: a mutable search string the mocked router writes to.
let search = "";
const replace = vi.fn((url: string) => {
  search = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
});
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ replace }),
  usePathname: () => "/trades",
}));
// Canvas charts don't run in jsdom; the props they receive are what matters here.
const candleChartProps = vi.fn();
vi.mock("@/components/charts/candle-chart", () => ({
  CandleChart: (props: unknown) => {
    candleChartProps(props);
    return <div data-testid="candle-chart" />;
  },
}));

beforeEach(() => {
  search = "";
  replace.mockClear();
  candleChartProps.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

const emptyGroups = { items: [], total: 0 };

function stubApi(routes: Parameters<typeof mockApi>[0]) {
  const api = mockApi([
    ...routes,
    { path: "reports/by-symbol", body: emptyGroups },
    { path: "reports/by-strategy", body: emptyGroups },
  ]);
  vi.stubGlobal("fetch", vi.fn(api.fetchMock));
  return api;
}

describe("TradesView", () => {
  it("lists trades from the server with the current mode and links to the detail", async () => {
    stubApi([{ path: "trades", body: tradesPageFixture }]);
    renderWithProviders(<TradesView />);

    const link = await screen.findByRole("link", { name: "BTCUSDT" });
    expect(link).toHaveAttribute("href", `/trades/${closedTradeFixture._id}`);
    expect(screen.getByText("Alvo (TP)")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("SEED")).toBeInTheDocument(); // open fixture is a seed trade
    expect(screen.getByText("1–20 de 42")).toBeInTheDocument();
  });

  it("sends mode, filters, sort and page from the URL to the backend and the CSV export", async () => {
    search = "symbol=ETHUSDT&status=CLOSED&page=2&sortBy=pnl&sortOrder=asc";
    const fetchSpy = vi.fn(stubApi([{ path: "trades", body: tradesPageFixture }]).fetchMock);
    vi.stubGlobal("fetch", fetchSpy);
    renderWithProviders(<TradesView />, { mode: "LIVE" });

    await screen.findByRole("link", { name: "BTCUSDT" });
    const url = new URL(String(fetchSpy.mock.calls.find(([u]) => String(u).includes("/trades?") && !String(u).includes("isSeed"))![0]), "http://x");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      mode: "LIVE",
      symbol: "ETHUSDT",
      status: "CLOSED",
      page: "2",
      sortBy: "pnl",
      sortOrder: "asc",
    });

    const csv = new URL(screen.getByRole("link", { name: /exportar csv/i }).getAttribute("href")!, "http://x");
    expect(csv.pathname).toBe("/api/backend/trades/export.csv");
    expect(csv.searchParams.get("symbol")).toBe("ETHUSDT");
    expect(csv.searchParams.has("page")).toBe(false);
  });

  it("changes sorting through the URL and resets to page 1", async () => {
    search = "page=3";
    stubApi([{ path: "trades", body: { ...tradesPageFixture, total: 100 } }]);
    const user = userEvent.setup();
    renderWithProviders(<TradesView />);

    await user.click(await screen.findByRole("button", { name: /^PnL %/ }));
    expect(replace).toHaveBeenLastCalledWith("/trades?sortBy=pnlPct", { scroll: false });
  });

  it("explains an empty mode, and offers to clear filters when filtered", async () => {
    stubApi([{ path: "trades", body: { items: [], total: 0, page: 1, limit: 20 } }]);
    const { unmount } = renderWithProviders(<TradesView />);
    expect(await screen.findByText("Nenhuma trade em PAPER ainda")).toBeInTheDocument();
    unmount();

    search = "status=OPEN";
    renderWithProviders(<TradesView />);
    expect(await screen.findByText("Nenhuma trade com esses filtros")).toBeInTheDocument();
    const empty = screen.getByText("Nenhuma trade com esses filtros").closest("div")!.parentElement!;
    await userEvent.click(within(empty).getByRole("button", { name: /limpar filtros/i }));
    expect(replace).toHaveBeenLastCalledWith("/trades", { scroll: false });
  });
});

describe("TradeDetailView", () => {
  it("shows the trade data and feeds the chart with entry/exit markers and stop/target lines", async () => {
    stubApi([
      { path: `trades/${closedTradeFixture._id}`, body: closedTradeFixture },
      { path: "exchange/candles", body: candlesFixture },
    ]);
    renderWithProviders(<TradeDetailView id={closedTradeFixture._id} />);

    expect(await screen.findByText("BTCUSDT · LONG")).toBeInTheDocument();
    await screen.findByTestId("candle-chart");

    const props = candleChartProps.mock.lastCall![0] as {
      markers: Array<{ tone: string; time: number }>;
      priceLines: Array<{ tone: string; price: number }>;
    };
    expect(props.markers.map((m) => m.tone)).toEqual(["entry", "exit"]);
    expect(props.priceLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tone: "stop", price: closedTradeFixture.stopLoss }),
        expect.objectContaining({ tone: "target", price: closedTradeFixture.takeProfit }),
      ]),
    );
  });

  it("requests candles covering the trade period", async () => {
    const fetchSpy = vi.fn(
      stubApi([
        { path: `trades/${closedTradeFixture._id}`, body: closedTradeFixture },
        { path: "exchange/candles", body: candlesFixture },
      ]).fetchMock,
    );
    vi.stubGlobal("fetch", fetchSpy);
    renderWithProviders(<TradeDetailView id={closedTradeFixture._id} />);
    await screen.findByTestId("candle-chart");

    const url = new URL(String(fetchSpy.mock.calls.find(([u]) => String(u).includes("exchange/candles"))![0]), "http://x");
    expect(url.searchParams.get("symbol")).toBe("BTCUSDT");
    expect(Number(url.searchParams.get("startTime"))).toBeLessThan(Date.parse(closedTradeFixture.entryTime));
    expect(Number(url.searchParams.get("endTime"))).toBeGreaterThan(Date.parse(closedTradeFixture.exitTime));
  });

  it("flags seed trades and explains an open position", async () => {
    stubApi([
      { path: `trades/${openTradeFixture._id}`, body: openTradeFixture },
      { path: "exchange/candles", body: candlesFixture },
    ]);
    renderWithProviders(<TradeDetailView id={openTradeFixture._id} />);
    expect(await screen.findByText(/trade fictícia do seed/i)).toBeInTheDocument();
    expect(screen.getByText("Em aberto")).toBeInTheDocument();
    expect(screen.getByText(/esta trade é de/i)).toHaveTextContent("BACKTEST");
  });

  it("shows a clear not-found state without retry", async () => {
    stubApi([{ path: "trades/nope", status: 404, body: { statusCode: 404, message: "Trade nope not found" } }]);
    renderWithProviders(<TradeDetailView id="nope" />);
    expect(await screen.findByText("Essa trade não existe ou foi apagada.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tentar de novo/i })).not.toBeInTheDocument();
  });
});
