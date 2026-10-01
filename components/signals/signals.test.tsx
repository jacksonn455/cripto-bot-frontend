import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signalsPageFixture } from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import { LiveEventsProvider } from "@/components/live/live-events-provider";
import { describeEvent } from "@/lib/live-feed";
import { LiveFeed } from "./live-feed";
import { SignalsList } from "./signals-list";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

/** Minimal EventSource double: tests push named events through `emit`. */
class FakeEventSource {
  static last: FakeEventSource | null = null;
  static CLOSED = 2;
  readyState = 1;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private handlers = new Map<string, Array<(m: { data: string }) => void>>();
  constructor(readonly url: string) {
    FakeEventSource.last = this;
    queueMicrotask(() => this.onopen?.());
  }
  addEventListener(type: string, fn: (m: { data: string }) => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }
  emit(type: string, data: unknown) {
    this.handlers.get(type)?.forEach((fn) => fn({ data: JSON.stringify(data) }));
  }
  emitWithId(type: string, data: unknown, lastEventId: string) {
    this.handlers.get(type)?.forEach((fn) => fn({ data: JSON.stringify(data), lastEventId } as never));
  }
  close() {
    this.readyState = 2;
  }
}

beforeEach(() => {
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal("fetch", vi.fn(mockApi([]).fetchMock));
});
afterEach(() => vi.unstubAllGlobals());

describe("describeEvent", () => {
  it("labels a risk veto with the translated reason and keeps the mode", () => {
    const item = describeEvent({
      type: "signal.recorded",
      receivedAt: 1,
      data: { symbol: "BTCUSDT", strategy: "S", signal: "ENTER_LONG", reason: "cruzou", price: 1, approved: false, rejectReason: "RR_TOO_LOW", mode: "PAPER", candleTime: "2026-09-29T13:59:59.999Z" },
    });
    expect(item).toMatchObject({ kind: "veto", title: "Sinal ENTER_LONG vetado em BTCUSDT", detail: "Risco/retorno abaixo do mínimo · cruzou", mode: "PAPER" });
  });

  it("signs exits and never relies on color alone", () => {
    const item = describeEvent({ type: "trade.closed", receivedAt: 1, data: { symbol: "ETHUSDT", pnl: -12.5, reason: "SL", mode: "LIVE" } });
    expect(item.title).toBe("Saída em ETHUSDT: −12,50 USDT");
    expect(item.detail).toBe("Stop loss");
    expect(item.tone).toBe("loss");
  });
});

describe("LiveFeed", () => {
  it("shows events as they arrive, newest first, and filters by kind", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LiveEventsProvider>
        <LiveFeed />
      </LiveEventsProvider>,
    );
    expect(screen.getByText("Nenhum evento ainda")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Conectado")).toBeInTheDocument());

    act(() => {
      FakeEventSource.last!.emit("trade.opened", { symbol: "BTCUSDT", side: "LONG", qty: 0.1, entryPrice: 60000, stopLoss: 58000, mode: "PAPER" });
      FakeEventSource.last!.emit("bot.error", { message: "Binance timeout", at: "2026-09-29T13:59:59.999Z" });
      FakeEventSource.last!.emit("ping", {});
      FakeEventSource.last!.emit("trade.opened", { symbol: "BAD" }); // invalid payload: ignored
    });

    const list = screen.getByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Erro no loop de execução");
    expect(rows[1]).toHaveTextContent("Entrada LONG em BTCUSDT");

    await user.click(screen.getByRole("button", { name: /^Erros/ }));
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
  });

  it("paginates long feeds, 20 per page", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LiveEventsProvider>
        <LiveFeed />
      </LiveEventsProvider>,
    );
    await waitFor(() => expect(screen.getByText("Conectado")).toBeInTheDocument());
    act(() => {
      for (let i = 0; i < 25; i++) FakeEventSource.last!.emit("bot.error", { message: `falha ${i}`, at: new Date(Date.UTC(2026, 8, 29, 12, i)).toISOString() });
    });

    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(20);
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(5);
  });
});

describe("LiveFeed history", () => {
  it("loads the backend history on connect and does not duplicate the same event arriving live", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        mockApi([
          {
            path: "events/recent",
            body: [
              { id: "e2", type: "bot.cycle", data: { symbol: "ETHUSDT", action: "HOLD", reason: "sem cruzamento", at: "2026-09-29T12:00:00.000Z", mode: "PAPER" }, at: "2026-09-29T12:00:00.000Z" },
              { id: "e1", type: "bot.paused", data: { reason: "MANUAL" }, at: "2026-09-29T11:00:00.000Z" },
            ],
          },
        ]).fetchMock,
      ),
    );
    renderWithProviders(
      <LiveEventsProvider>
        <LiveFeed />
      </LiveEventsProvider>,
    );
    await waitFor(() => expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(2));
    expect(screen.getByText("ETHUSDT: sem entrada")).toBeInTheDocument();
    expect(screen.getByText("Média rápida ainda não cruzou a lenta")).toBeInTheDocument();
    expect(screen.getByText("Operações pausadas")).toBeInTheDocument();

    // Same id arriving on the stream (e.g. history loaded right after it was sent): shown once.
    act(() => {
      const src = FakeEventSource.last!;
      src.emitWithId("bot.paused", { reason: "MANUAL" }, "e1");
    });
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("SignalsList", () => {
  it("lists vetoed and approved signals with the translated reason", async () => {
    vi.stubGlobal("fetch", vi.fn(mockApi([{ path: "signals", body: signalsPageFixture }]).fetchMock));
    renderWithProviders(<SignalsList />);
    expect(await screen.findByText("Vetado")).toBeInTheDocument();
    expect(screen.getByText("Risco/retorno abaixo do mínimo")).toBeInTheDocument();
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
    expect(screen.getByText("EMA20 cruzou acima da EMA50")).toBeInTheDocument();
  });

  it("shows 'endpoint indisponível' instead of breaking on an older backend", async () => {
    vi.stubGlobal("fetch", vi.fn(mockApi([{ path: "signals", status: 404, body: { statusCode: 404, message: "Cannot GET /signals" } }]).fetchMock));
    renderWithProviders(<SignalsList />);
    expect(await screen.findByText("Endpoint indisponível")).toBeInTheDocument();
  });
});
