import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BotStatusPanel } from "@/components/overview/bot-status-panel";
import { buildBacktestInput, type BacktestFormValues } from "@/lib/backtest-form";
import { botStatusFixture, strategiesFixture } from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import { CandidateFunnel } from "./candidate-funnel";
import { PauseHistory } from "./pause-history";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const shadow = (measured: number, wins: number, avgR: number | null, pending = 0) => ({
  measured, wins, losses: measured - wins, pending, avgR, sumR: avgR === null ? 0 : avgR * measured,
});

/** GET /candidates/funnel as the backend's summarizeFunnel serializes it (BTC+ETH, 21 months, long+short). */
const funnelFixture = {
  total: 625,
  bySide: { LONG: 312, SHORT: 313 },
  bySetup: { EMA_CROSS: 625 },
  strategyAccepted: 265,
  steps: [
    { step: "SIDE", entering: 625, rejected: 0, remaining: 625, rejectedShadow: shadow(0, 0, null) },
    { step: "REGIME", entering: 625, rejected: 326, remaining: 299, rejectedShadow: shadow(325, 93, -0.27, 1) },
    { step: "RSI", entering: 299, rejected: 34, remaining: 265, rejectedShadow: shadow(34, 10, -0.37) },
    { step: "ADX", entering: 265, rejected: 0, remaining: 265, rejectedShadow: shadow(0, 0, null) },
    { step: "INDICATORS", entering: 265, rejected: 0, remaining: 265, rejectedShadow: shadow(0, 0, null) },
    { step: "PAUSE", entering: 265, rejected: 4, remaining: 261, rejectedShadow: shadow(4, 2, 0.5) },
    { step: "RISK", entering: 261, rejected: 2, remaining: 259, rejectedShadow: shadow(2, 0, -1) },
    { step: "EXECUTION", entering: 259, rejected: 0, remaining: 259, rejectedShadow: shadow(0, 0, null) },
  ],
  entered: 259,
  riskRejectReasons: { CONSECUTIVE_STOPS_LIMIT: 2 },
  paused: { candidatesWhileBotPaused: 9, blockedByPause: 4, wouldTradeIfResumed: 3, blockedShadow: shadow(4, 2, 0.5) },
  shadow: { entered: shadow(259, 67, -0.21), rejected: shadow(365, 105, -0.28, 1), rejectedWinners: 105, rejectedLosers: 260 },
};

function stub(routes: Parameters<typeof mockApi>[0]) {
  const api = mockApi(routes);
  vi.stubGlobal("fetch", vi.fn(api.fetchMock));
  return api;
}

describe("CandidateFunnel", () => {
  it("shows every stage with what it removed and the shadow outcome of the removed candidates", async () => {
    const api = stub([{ path: "candidates/funnel", body: funnelFixture }]);
    renderWithProviders(<CandidateFunnel />);

    expect(await screen.findByText(/oportunidades \(312 long, 313 short\)/)).toBeInTheDocument();
    const regime = screen.getByText("Regime (EMA200 4h)").closest("tr")!;
    expect(within(regime).getByText("326")).toBeInTheDocument();
    expect(within(regime).getByText(/93 V \/ 232 D/)).toBeInTheDocument();
    expect(within(regime).getByText("média −0,27R")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("4 entradas foram bloqueadas porque o bot estava pausado; 3 teriam sido aprovadas");
    expect(screen.getByText(/Limite de stops consecutivos \(2\)/)).toBeInTheDocument();

    expect(api.calls.map((c) => c.path)).toEqual(["candidates/funnel"]);
  });

  it("for a backtest run, asks for that run's ledger and explains how to record one when it is empty", async () => {
    const empty = { ...funnelFixture, total: 0, bySide: { LONG: 0, SHORT: 0 }, strategyAccepted: 0, entered: 0, steps: [] };
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify(empty), { status: 200 });
      }),
    );
    renderWithProviders(<CandidateFunnel runId="bt_1" />);

    expect(await screen.findByText(/Rode o backtest com “Registrar candidatos” marcado/)).toBeInTheDocument();
    expect(calls[0]).toContain("runId=bt_1");
    expect(calls[0]).toContain("mode=BACKTEST");
    expect(screen.queryByRole("group", { name: "Período" })).not.toBeInTheDocument();
  });

  it("says the funnel is unavailable on a backend without the ledger (404)", async () => {
    stub([{ path: "candidates/funnel", status: 404, body: { message: "Not Found" } }]);
    renderWithProviders(<CandidateFunnel />);
    expect(await screen.findByText("Funil indisponível")).toBeInTheDocument();
  });
});

describe("PauseHistory", () => {
  it("lists each pause with its duration, reasons and the entries it blocked", async () => {
    stub([
      {
        path: "candidates/pauses",
        body: [
          {
            pausedAt: "2026-09-30T10:00:00.000Z",
            resumedAt: null,
            durationMs: 26 * 3_600_000,
            reason: "CONSECUTIVE_STOPS_LIMIT",
            additionalReasons: [{ reason: "DAILY_LOSS_LIMIT", at: "2026-09-30T12:00:00.000Z" }],
            candidates: 5,
            blockedByPause: 2,
            wouldTradeIfResumed: 2,
            blockedShadow: shadow(2, 1, 0.75),
          },
        ],
      },
    ]);
    renderWithProviders(<PauseHistory />);

    const row = (await screen.findByText("em andamento")).closest("tr")!;
    expect(within(row).getByText(/^\+ /)).toBeInTheDocument();
    expect(within(row).getByText("+1,50R")).toBeInTheDocument();
    expect(within(row).getAllByText("2")).toHaveLength(2);
  });

  it("hides itself on backends without the endpoint", async () => {
    stub([{ path: "candidates/pauses", status: 404, body: {} }]);
    const { container } = renderWithProviders(<PauseHistory />);
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe("pause visibility in the status panel", () => {
  it("shows how long the bot has been paused and since when", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-09-29T15:35:00.000Z"));
    stub([{ path: "health", body: { status: "ok", uptimeSeconds: 1, mongo: { ok: true, latencyMs: 1 }, redis: { ok: true, latencyMs: 1, status: "ready" } } }]);
    const status = { ...botStatusFixture, pausedAt: "2026-09-29T12:05:00.000Z", pausedForMs: 3.5 * 3_600_000 } as never;
    renderWithProviders(<BotStatusPanel status={status} />);
    expect(screen.getByText(/novas entradas bloqueadas até retomar/)).toHaveTextContent("há 3 h 30 min");
  });
});

describe("buildBacktestInput recordCandidates", () => {
  const values: BacktestFormValues = {
    strategy: "TrendRegimeStrategy", symbols: "BTCUSDT", timeframe: "1h", regimeTimeframe: "4h", from: "2026-06-01", to: "2026-06-30",
    initialBalance: "10000", feesPct: "0,1", slippagePct: "0,05", walkForwardDays: "", includeShort: false, shortBorrowPctPerDay: "0,03",
    shortCarryModel: "fixed", stopSlippagePct: "", portfolioMode: false, maxSameSideRiskPct: "", params: {},
  };
  const params = strategiesFixture.strategies[0].params;

  it("is only sent when checked (the request stays identical otherwise)", () => {
    expect(buildBacktestInput(values, params, Date.now()).input).not.toHaveProperty("recordCandidates");
    expect(buildBacktestInput({ ...values, recordCandidates: true }, params, Date.now()).input).toMatchObject({ recordCandidates: true });
  });
});
