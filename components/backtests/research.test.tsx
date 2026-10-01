import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RDistribution } from "@/components/analytics/r-distribution";
import { backtestRunFixture, backtestRunResponseFixture, metricsSummaryFixture, runsPage, strategiesFixture } from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import type { BacktestRun, RunComparison } from "@/lib/schemas";
import { BacktestsView } from "./backtests-view";
import { CompareWindows } from "./compare-windows";
import { PboView, pboReading } from "./pbo-view";
import { RunRiskAdjusted } from "./run-risk-adjusted";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/components/charts/equity-chart", () => ({ EquityChart: () => <div data-testid="equity-chart" /> }));

afterEach(() => vi.unstubAllGlobals());

function stub(routes: Parameters<typeof mockApi>[0]) {
  const api = mockApi(routes);
  vi.stubGlobal("fetch", vi.fn(api.fetchMock));
  return api;
}

const riskAdjusted = {
  days: 540,
  totalReturn: 0.18,
  cagr: 0.12,
  annualVolatility: 0.2,
  sharpeDaily: 0.03,
  sharpeAnnualized: 0.57,
  sortinoAnnualized: 0.9,
  maxDrawdown: 0.1,
  calmar: 1.2,
  skewness: 0.4,
  kurtosis: 5,
  probabilisticSharpe: 0.9,
};
const run = (overrides: Partial<BacktestRun> = {}) => ({ ...backtestRunFixture, riskAdjusted, ...overrides }) as unknown as BacktestRun;

describe("backtest form research options", () => {
  const routes = [
    { path: "strategies", body: strategiesFixture },
    { path: "backtest/runs", body: runsPage([]) },
    { method: "POST", path: "backtest/run", body: backtestRunResponseFixture },
    { path: `backtest/runs/${backtestRunResponseFixture.runId}`, body: backtestRunFixture },
  ];

  it("the 2× cost stress preset doubles fees and slippage, with stops slipping twice as much", async () => {
    const api = stub(routes);
    const user = userEvent.setup();
    renderWithProviders(<BacktestsView />);

    await user.click(await screen.findByRole("button", { name: "2×" }, { timeout: 10_000 }));
    expect(screen.getByRole("button", { name: "2×" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Taxa por lado (%)")).toHaveValue("0,2");
    await user.click(screen.getByRole("button", { name: "Rodar backtest" }));

    await waitFor(() => expect(api.calls.some((c) => c.method === "POST")).toBe(true), { timeout: 10_000 });
    const body = JSON.parse(api.calls.find((c) => c.method === "POST")!.body!);
    expect(body.feesPct).toBeCloseTo(0.002);
    expect(body.slippagePct).toBeCloseTo(0.001);
    expect(body.stopSlippagePct).toBeCloseTo(0.002);
  });

  it("portfolio mode sends one shared balance and the same-side risk cap", async () => {
    const api = stub(routes);
    const user = userEvent.setup();
    renderWithProviders(<BacktestsView />);

    expect(screen.queryByLabelText(/risco máximo no mesmo sentido/i)).not.toBeInTheDocument();
    await user.click(await screen.findByRole("checkbox", { name: /carteira única/i }, { timeout: 10_000 }));
    await user.type(screen.getByLabelText(/risco máximo no mesmo sentido/i), "1,5");
    await user.click(screen.getByRole("button", { name: "Rodar backtest" }));

    await waitFor(() => expect(api.calls.some((c) => c.method === "POST")).toBe(true), { timeout: 10_000 });
    const body = JSON.parse(api.calls.find((c) => c.method === "POST")!.body!);
    expect(body.portfolioMode).toBe(true);
    expect(body.maxSameSideRiskPct).toBeCloseTo(0.015);
  });

  it("with three runs selected, offers the PBO but not the two-run comparison", async () => {
    const runs = ["bt_a", "bt_b", "bt_c"].map((runId, i) => ({ ...backtestRunFixture, runId, createdAt: `2026-09-2${i}T12:00:00.000Z` }));
    stub([{ path: "strategies", body: strategiesFixture }, { path: "backtest/runs", body: runsPage(runs) }]);
    const user = userEvent.setup();
    renderWithProviders(<BacktestsView />);

    const boxes = await screen.findAllByRole("checkbox", { name: /selecionar/i });
    for (const box of boxes) await user.click(box);
    expect(screen.getByRole("button", { name: /comparar/i })).toBeDisabled();
    expect(screen.getByRole("link", { name: /risco de overfitting/i })).toHaveAttribute("href", "/backtests/pbo?runs=bt_a,bt_b,bt_c");
  });
});

describe("RunRiskAdjusted", () => {
  it("shows the annualized metrics and flags a DSR below 95%", () => {
    renderWithProviders(
      <RunRiskAdjusted
        run={run({
          overfitting: {
            trials: 12,
            trialsWithSharpe: 12,
            sharpeVariance: 0.001,
            expectedMaxSharpeAnnualized: 1.1,
            deflatedSharpe: 0.62,
            haircutSharpe: 0.2,
            haircut: 0.65,
          },
        })}
      />,
    );
    expect(screen.getByText("Sharpe anualizado")).toBeInTheDocument();
    expect(screen.getByText("0,57")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Sharpe deflacionado (DSR): 62%");
    expect(screen.getByRole("note")).toHaveTextContent("Não use esta variante para mudar a produção");
  });

  it("explains when the DSR can't be computed yet (older runs without a daily Sharpe)", () => {
    renderWithProviders(
      <RunRiskAdjusted
        run={run({
          overfitting: {
            trials: 5,
            trialsWithSharpe: 1,
            sharpeVariance: null,
            expectedMaxSharpeAnnualized: null,
            deflatedSharpe: null,
            haircutSharpe: 0.3,
            haircut: 0.5,
          },
        })}
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent("só 1 têm o Sharpe diário gravado");
  });

  it("renders nothing for runs saved before the daily metrics existed", () => {
    const { container } = renderWithProviders(<RunRiskAdjusted run={run({ riskAdjusted: undefined })} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RDistribution", () => {
  const stats = {
    tradeCount: 40,
    avgR: 0.35,
    medianR: -0.9,
    bestR: 6.2,
    worstR: -1.4,
    tradesAtLeast3R: 5,
    rHistogram: metricsSummaryFixture.pnlHistogram,
    topDecilePnlShare: 0.8,
    kellyFraction: 0.02,
  };

  it("calls out a PnL that depends on the right tail", () => {
    renderWithProviders(<RDistribution stats={stats} />);
    expect(screen.getByText(/Os 10% melhores trades fizeram 80% do lucro bruto/)).toBeInTheDocument();
  });

  it("warns when the configured risk is above a quarter Kelly", () => {
    // ¼ of a 2% Kelly = 0,5%, below the 1% configured.
    renderWithProviders(<RDistribution stats={stats} riskPerTradePct={0.01} />);
    expect(screen.getByText(/acima: agressivo/)).toBeInTheDocument();
  });
});

describe("CompareWindows", () => {
  const side = (returnPct: number) => ({ tradeCount: 12, winCount: 6, lossCount: 6, totalPnl: returnPct * 1e4, returnPct, profitFactor: 1.2, expectancy: 5, avgReturnPct: 0.2 });
  const comparison: RunComparison = {
    baselineRunId: "a",
    variantRunId: "b",
    comparable: true,
    warnings: [],
    windows: [
      { from: "2026-01-01T00:00:00.000Z", to: "2026-04-01T00:00:00.000Z", baseline: side(0.01), variant: side(0.03), variantBetter: { pnl: true, profitFactor: true, expectancy: true } },
      { from: "2026-04-01T00:00:00.000Z", to: "2026-07-01T00:00:00.000Z", baseline: side(0.02), variant: side(-0.01), variantBetter: { pnl: false, profitFactor: false, expectancy: null } },
    ],
    variantWinShare: { windows: 2, pnl: 0.5, profitFactor: 0.5, expectancy: 1, profitFactorAndExpectancy: 1 },
    sample: { baseline: { LONG: 24, SHORT: 0 }, variant: { LONG: 14, SHORT: 10 }, inconclusive: true, minTradesPerSide: 30 },
  };

  it("shows the share of windows won and flags a small sample", async () => {
    stub([{ path: "backtest/compare", body: comparison }]);
    renderWithProviders(<CompareWindows baseline="a" variant="b" />);
    expect(await screen.findByText("B com mais retorno")).toBeInTheDocument();
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
    expect(screen.getByText(/Inconclusivo:/)).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});

describe("PboView", () => {
  it("reads the PBO into a plain-language verdict", () => {
    expect(pboReading(0.1).tone).toBe("good");
    expect(pboReading(0.35).tone).toBe("warn");
    expect(pboReading(0.7).tone).toBe("bad");
  });

  it("asks for runs when fewer than two are given", () => {
    stub([{ path: "backtest/runs", body: runsPage([]) }]);
    renderWithProviders(<PboView runIds={["only"]} />);
    expect(screen.getByText("Escolha as variantes")).toBeInTheDocument();
  });

  it("shows the PBO of the selected variants", async () => {
    const api = stub([
      { path: "backtest/runs", body: runsPage([]) },
      {
        path: "backtest/pbo",
        body: {
          runIds: ["a", "b"],
          windows: 8,
          blocks: 8,
          combinations: 70,
          pbo: 0.64,
          probOosLoss: 0.4,
          meanInSampleReturn: 0.08,
          meanOutOfSampleReturn: -0.01,
          logitHistogram: [{ bucket: "< -2", count: 10 }, { bucket: ">= 2", count: 60 }],
          selected: [{ runId: "a", count: 50 }, { runId: "b", count: 20 }],
          approximated: false,
          warnings: [],
        },
      },
    ]);
    renderWithProviders(<PboView runIds={["a", "b"]} />);
    expect(await screen.findByText(/PBO 64%: Risco de overfitting alto/)).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === "backtest/pbo")).toBeDefined();
  });
});
