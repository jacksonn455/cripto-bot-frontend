import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { botStateFixture, botStatusFixture, killSwitchFixture } from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import { botStatusSchema } from "@/lib/schemas";
import { BotControls, KillSwitchDialog } from "./bot-controls";
import { BotStatusPanel } from "./bot-status-panel";
import { OpenPositions } from "./open-positions";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const status = botStatusSchema.parse({ ...botStatusFixture, paused: false, pauseReason: undefined });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("KillSwitchDialog", () => {
  it("only enables the action after typing CONFIRMAR, then shows the backend result", async () => {
    const api = mockApi([{ method: "POST", path: "bot/kill-switch", body: killSwitchFixture }]);
    vi.stubGlobal("fetch", vi.fn(api.fetchMock));
    const user = userEvent.setup();
    renderWithProviders(<KillSwitchDialog open onClose={() => {}} status={status} />);

    const action = screen.getByRole("button", { name: "Acionar kill switch" });
    expect(action).toBeDisabled();

    const input = screen.getByLabelText(/para continuar/i);
    await user.type(input, "confirmar");
    expect(action).toBeDisabled(); // case-sensitive

    await user.clear(input);
    await user.type(input, "CONFIRMAR");
    expect(action).toBeEnabled();
    expect(api.calls).toHaveLength(0);

    await user.click(action);
    expect(await screen.findByText("Kill switch executado")).toBeInTheDocument();
    expect(screen.getByText("Ordens canceladas").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Posições fechadas").nextSibling).toHaveTextContent("1");
    expect(api.calls.filter((c) => c.path === "bot/kill-switch")).toHaveLength(1);
  });

  it("shows the backend error and keeps the dialog open", async () => {
    const api = mockApi([
      { method: "POST", path: "bot/kill-switch", status: 403, body: { statusCode: 403, message: "Invalid or missing X-Control-Api-Key header" } },
    ]);
    vi.stubGlobal("fetch", vi.fn(api.fetchMock));
    const user = userEvent.setup();
    renderWithProviders(<KillSwitchDialog open onClose={() => {}} status={status} />);

    await user.type(screen.getByLabelText(/para continuar/i), "CONFIRMAR");
    await user.click(screen.getByRole("button", { name: "Acionar kill switch" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or missing X-Control-Api-Key header");
    expect(screen.getByRole("button", { name: "Acionar kill switch" })).toBeInTheDocument();
  });
});

describe("BotControls", () => {
  it("asks for confirmation before pausing and sends the reason", async () => {
    const api = mockApi([{ method: "POST", path: "bot/pause", body: botStateFixture }]);
    vi.stubGlobal("fetch", vi.fn(api.fetchMock));
    const user = userEvent.setup();
    renderWithProviders(<BotControls status={status} />);

    await user.click(screen.getByRole("button", { name: /pausar/i }));
    expect(api.calls).toHaveLength(0);
    await user.type(screen.getByLabelText(/motivo/i), "revisar estratégia");
    await user.click(screen.getByRole("button", { name: "Pausar operações" }));

    await waitFor(() => expect(api.calls.find((c) => c.path === "bot/pause")).toBeDefined());
    expect(JSON.parse(api.calls.find((c) => c.path === "bot/pause")!.body!)).toEqual({ reason: "revisar estratégia" });
  });

  it("offers resume instead of pause when paused, and disables everything without status", () => {
    const { unmount } = renderWithProviders(<BotControls status={{ ...status, paused: true }} />);
    expect(screen.getByRole("button", { name: /retomar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pausar/i })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<BotControls status={undefined} />);
    expect(screen.getByRole("button", { name: /pausar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /kill switch/i })).toBeDisabled();
  });
});

describe("BotStatusPanel", () => {
  it("alerts when the loop heartbeat is late", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T12:20:00.000Z")); // 15 min after lastPollAt, interval 60 s
    renderWithProviders(<BotStatusPanel status={status} />);
    expect(screen.getByText(/loop possivelmente parado/i)).toBeInTheDocument();
  });

  it("shows the pause reason only when paused", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T12:05:30.000Z"));
    renderWithProviders(<BotStatusPanel status={{ ...status, paused: true, pauseReason: "DAILY_LOSS_LIMIT" }} />);
    expect(screen.getByText(/limite de perda diária atingido/i)).toBeInTheDocument();
    expect(screen.queryByText(/loop possivelmente parado/i)).not.toBeInTheDocument();
  });

  it("shows which dependency is down when /health answers 503 with details", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T12:05:30.000Z"));
    const api = mockApi([
      {
        path: "health",
        status: 503,
        body: { status: "down", uptimeSeconds: 10, mongo: { ok: false, latencyMs: null }, redis: { ok: true, latencyMs: 2, status: "ready" } },
      },
    ]);
    vi.stubGlobal("fetch", api.fetchMock);
    renderWithProviders(<BotStatusPanel status={status} />);
    expect(await screen.findByText(/MongoDB: fora do ar/)).toBeInTheDocument();
    expect(screen.getByText(/Redis \(cache\) OK/)).toBeInTheDocument();
  });
});

describe("OpenPositions", () => {
  it("explains the empty state instead of showing an empty table", async () => {
    const api = mockApi([{ path: "trades", body: { items: [], total: 0, page: 1, limit: 50 } }]);
    vi.stubGlobal("fetch", vi.fn(api.fetchMock));
    renderWithProviders(<OpenPositions mode="PAPER" />);
    expect(await screen.findByText("Nenhuma posição aberta")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error with retry when the backend is offline", async () => {
    const api = mockApi([{ path: "trades", status: 503, body: { error: "BACKEND_OFFLINE", message: "x" } }]);
    vi.stubGlobal("fetch", vi.fn(api.fetchMock));
    renderWithProviders(<OpenPositions mode="PAPER" />);
    expect(await screen.findByText("Backend offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentar de novo/i })).toBeInTheDocument();
  });
});
