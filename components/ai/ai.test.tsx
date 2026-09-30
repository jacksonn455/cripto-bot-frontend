import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SideComparison, sideSampleWarning } from "@/components/analytics/side-comparison";
import { RunCosts } from "@/components/backtests/run-costs";
import { metricsSummaryFixture } from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import { AiView } from "./ai-view";

vi.mock("next/navigation", () => ({ usePathname: () => "/ai", useRouter: () => ({ replace: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

const AGENTS = [
  { key: "performance-analyst", name: "Performance Analyst", description: "Avalia PnL", tools: ["get_performance_summary"] },
  { key: "risk-analyst", name: "Risk Analyst", description: "Avalia risco", tools: ["get_bot_status"] },
];
const status = (over: Record<string, unknown> = {}) => ({
  enabled: true,
  configured: true,
  model: "gpt-test",
  tracingEnabled: false,
  agents: AGENTS,
  ...over,
});
const RESULT = {
  agent: "risk-analyst",
  model: "gpt-test",
  output: {
    summary: "Exposição concentrada em BTC e ETH.",
    findings: [{ title: "Correlação alta", detail: "BTC e ETH andam juntos", severity: "warning" }],
    recommendations: [{ action: "Testar limite de risco agregado", rationale: "reduzir drawdown", requiresBacktest: true }],
    confidence: "medium",
    dataUsed: ["get_bot_status"],
  },
  usage: { requests: 2, inputTokens: 900, outputTokens: 300, totalTokens: 1200 },
  durationMs: 8_500,
  advisoryOnly: true,
};

function stub(routes: Parameters<typeof mockApi>[0]) {
  const api = mockApi([{ path: "bot/status", body: { mode: "PAPER" } }, ...routes]);
  vi.stubGlobal("fetch", vi.fn(api.fetchMock));
  return api;
}

describe("AiView", () => {
  it("explains how to enable the agents when the backend has them off, and disables the run button", async () => {
    stub([{ path: "ai/status", body: status({ enabled: false, reason: "OPENAI_AGENTS_ENABLED is not true" }) }]);
    renderWithProviders(<AiView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("OPENAI_AGENTS_ENABLED is not true");
    expect(screen.getByRole("button", { name: /rodar performance analyst/i })).toBeDisabled();
  });

  it("runs the selected agent with the question and data mode, then shows the advisory answer", async () => {
    const api = stub([
      { path: "ai/status", body: status() },
      { method: "POST", path: "ai/agents/risk-analyst/run", body: RESULT },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<AiView />);

    await user.click(await screen.findByRole("radio", { name: /risk analyst/i }));
    await user.type(screen.getByLabelText(/pergunta/i), "Estou concentrado?");
    await user.click(screen.getByRole("button", { name: /rodar risk analyst/i }));

    expect(await screen.findByText("Exposição concentrada em BTC e ETH.")).toBeInTheDocument();
    expect(screen.getByText("Correlação alta")).toBeInTheDocument();
    expect(screen.getByText(/validar em backtest antes/)).toBeInTheDocument();
    expect(screen.getByText(/Nada disso foi executado/)).toBeInTheDocument();
    const call = api.calls.find((c) => c.method === "POST")!;
    expect(JSON.parse(call.body!)).toEqual({ question: "Estou concentrado?", mode: "PAPER" });
  });

  it("shows the backend error (e.g. 503 when misconfigured) instead of breaking", async () => {
    stub([
      { path: "ai/status", body: status() },
      { method: "POST", path: "ai/agents/performance-analyst/run", status: 503, body: { statusCode: 503, message: "AI agents unavailable: OPENAI_API_KEY is not set" } },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<AiView />);

    await user.click(await screen.findByRole("button", { name: /rodar performance analyst/i }));
    expect(await screen.findByText(/OPENAI_API_KEY is not set/)).toBeInTheDocument();
  });
});

describe("SideComparison", () => {
  const side = (tradeCount: number, totalPnl: number) => ({
    tradeCount,
    winCount: Math.round(tradeCount / 2),
    winRate: 0.5,
    totalPnl,
    profitFactor: 1.4,
    expectancy: tradeCount ? totalPnl / tradeCount : 0,
    avgReturnPct: 0.3,
  });

  it("shows long and short columns with gross profit, loss and fees", () => {
    renderWithProviders(
      <SideComparison
        summary={{ ...metricsSummaryFixture, bySide: { LONG: side(40, 120), SHORT: side(35, -30) }, grossProfit: 500, grossLoss: 410, totalFees: 12.5 }}
      />,
    );
    const table = screen.getByRole("table");
    const tradesRow = within(table).getByRole("row", { name: /trades/i });
    expect(tradesRow).toHaveTextContent("40");
    expect(tradesRow).toHaveTextContent("35");
    expect(screen.getByText("Lucro bruto")).toBeInTheDocument();
    expect(screen.getByText("Taxas pagas")).toBeInTheDocument();
  });

  it("renders nothing for backends/runs without per-side metrics", () => {
    const { container } = renderWithProviders(<SideComparison summary={{ ...metricsSummaryFixture, bySide: undefined }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("points out when there are no shorts and warns on small samples", () => {
    renderWithProviders(<SideComparison summary={{ ...metricsSummaryFixture, bySide: { LONG: side(12, 50), SHORT: side(0, 0) } }} />);
    expect(screen.getByText(/Nenhum short neste recorte/)).toBeInTheDocument();
    expect(sideSampleWarning({ LONG: side(12, 50), SHORT: side(0, 0) })).toMatch(/Amostra pequena em LONG/);
    expect(sideSampleWarning({ LONG: side(40, 50), SHORT: side(31, 0) })).toBeNull();
  });
});

describe("RunCosts", () => {
  it("lists fees, slippage, short carry and exposure", () => {
    renderWithProviders(
      <RunCosts
        run={{
          summary: { ...metricsSummaryFixture, grossProfit: 400 },
          costs: { totalFees: 20, feesPctOfCapital: 0.002, totalSlippage: 10, slippagePctOfCapital: 0.001, totalShortCarry: 3, shortBorrowPctPerDay: 0.0003 },
          exposurePct: 0.42,
        }}
      />,
    );
    expect(screen.getByText("Slippage")).toBeInTheDocument();
    expect(screen.getByText("Custo do short (juros/funding)")).toBeInTheDocument();
    expect(screen.getByText("Exposição")).toBeInTheDocument();
    // (20 + 10) / 400 = 7,5%
    expect(screen.getByText("Custos / lucro bruto").nextElementSibling).toHaveTextContent("7,5");
  });
});
