import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backtestRunFixture,
  byHourFixture,
  compareModesFixture,
  emptyMetricsSummaryFixture,
  groupedMetricPageFixture,
  metricsSummaryFixture,
  runsPage,
} from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import { toHistogramBins } from "./distribution-charts";
import { AnalyticsView } from "./analytics-view";

// Recharts needs layout/ResizeObserver; the data handed to the charts is what's under test.
const barProps = vi.fn();
vi.mock("@/components/charts/bar-metric-chart", () => ({
  BarMetricChart: (p: { ariaLabel: string }) => {
    barProps(p);
    return <div data-testid="bar-chart" aria-label={p.ariaLabel} />;
  },
}));
vi.mock("@/components/charts/histogram", () => ({ Histogram: () => <div data-testid="histogram" /> }));

afterEach(() => {
  vi.unstubAllGlobals();
  barProps.mockClear();
});

function stub(overrides: Parameters<typeof mockApi>[0] = []) {
  const api = mockApi([
    ...overrides,
    { path: "reports/summary", body: metricsSummaryFixture },
    { path: "reports/by-strategy", body: groupedMetricPageFixture },
    { path: "reports/by-symbol", body: groupedMetricPageFixture },
    { path: "reports/by-hour", body: byHourFixture },
    { path: "reports/compare-modes", body: compareModesFixture },
    { path: "backtest/runs", body: runsPage([backtestRunFixture]) },
    { path: "trades", body: { items: [], total: 0, page: 1, limit: 1 } },
  ]);
  const fetchSpy = vi.fn(api.fetchMock);
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

const urlsFor = (spy: ReturnType<typeof vi.fn>, path: string) =>
  spy.mock.calls.map(([u]) => new URL(String(u), "http://x")).filter((u) => u.pathname === `/api/backend/${path}`);

describe("AnalyticsView", () => {
  it("shows the metrics and feeds the breakdown charts", async () => {
    stub();
    renderWithProviders(<AnalyticsView />);

    expect(await screen.findAllByText("Retorno médio por trade")).toHaveLength(2); // grid + comparison
    expect(screen.getAllByText("60,0%").length).toBeGreaterThan(0); // win rate (grid + comparison)
    // strategy, symbol, hour, weekday, exit reason
    await waitFor(() => expect(screen.getAllByTestId("bar-chart")).toHaveLength(5));

    const hourChart = barProps.mock.calls.map(([p]) => p).find((p) => p.ariaLabel === "PnL por hora do dia");
    expect(hourChart.data).toHaveLength(24);
    expect(hourChart.data[14]).toMatchObject({ label: "14h", value: -20 });
    expect(screen.getAllByText(/no fuso America\/Sao_Paulo/)).toHaveLength(2);
  });

  it("sends the browser time zone and filters PAPER by exit date for the period", async () => {
    const spy = stub();
    renderWithProviders(<AnalyticsView />);
    await screen.findAllByText("Retorno médio por trade");

    const byHour = urlsFor(spy, "reports/by-hour")[0];
    expect(byHour.searchParams.get("tz")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const summary = urlsFor(spy, "reports/summary")[0];
    expect(summary.searchParams.get("mode")).toBe("PAPER");
    expect(summary.searchParams.get("dateField")).toBe("exitTime");
    expect(summary.searchParams.get("from")).not.toBeNull();
  });

  it("compares against the latest backtest run by default and highlights divergences", async () => {
    const spy = stub();
    renderWithProviders(<AnalyticsView />);

    const table = await screen.findByRole("table");
    await within(table).findByText("−18,0 p.p. vs backtest"); // win rate 42% vs 60%
    expect(within(table).getByText("−55% vs backtest")).toBeInTheDocument(); // profit factor 1,1 vs 2,47
    expect(within(table).getAllByText("sem trades")).toHaveLength(1); // LIVE column
    const cmp = urlsFor(spy, "reports/compare-modes").at(-1)!;
    expect(cmp.searchParams.get("runId")).toBe(backtestRunFixture.runId);
  });

  it("explains an empty mode instead of showing zeros", async () => {
    stub([{ path: "reports/summary", body: emptyMetricsSummaryFixture }]);
    renderWithProviders(<AnalyticsView />);
    expect(await screen.findByText("Sem trades fechadas em PAPER neste período")).toBeInTheDocument();
    expect(await screen.findAllByText("Retorno médio por trade")).toHaveLength(1); // only the comparison table
    expect(screen.queryAllByTestId("bar-chart")).toHaveLength(0);
  });
});

describe("toHistogramBins", () => {
  it("colors bins by side of zero and uses a real minus", () => {
    const bins = toHistogramBins(metricsSummaryFixture.pnlHistogram);
    expect(bins.map((b) => b.tone)).toEqual(["loss", "loss", "loss", "profit", "profit", "profit"]);
    expect(bins[1].label).toBe("−5% a −2%");
  });
});
