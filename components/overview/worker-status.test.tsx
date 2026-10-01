import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { botStatusFixture } from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import type { WorkerStatus } from "@/lib/schemas";
import { WorkerStatusCard, WorkerStatusView } from "./worker-status";

const NOW = Date.parse("2026-10-01T12:30:20.000Z");

const online: WorkerStatus = {
  state: "ONLINE",
  reason: null,
  instanceId: "srv:1:abc",
  startedAt: "2026-10-01T00:00:00.000Z",
  uptimeSeconds: 45_020,
  lastHeartbeatAt: "2026-10-01T12:30:12.000Z",
  lastEvaluationAt: "2026-10-01T12:00:40.000Z",
  nextEvaluationAt: "2026-10-01T13:00:00.000Z",
  lastErrorAt: null,
  lastError: null,
  stoppedAt: null,
  stopReason: null,
  heartbeatTimeoutSeconds: 300,
  lastDowntime: null,
};

const offline: WorkerStatus = {
  ...online,
  state: "OFFLINE",
  reason: "worker heartbeat expired",
  uptimeSeconds: null,
  nextEvaluationAt: null,
  lastHeartbeatAt: "2026-10-01T10:16:00.000Z",
  lastEvaluationAt: "2026-10-01T10:00:30.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("WorkerStatusView", () => {
  it("ONLINE: uptime, last heartbeat, last and next evaluation", () => {
    render(<WorkerStatusView worker={online} now={NOW} />);
    expect(screen.getByTestId("worker-state")).toHaveTextContent("ONLINE");
    expect(screen.getByText("Uptime")).toBeInTheDocument();
    expect(screen.getByText("Último heartbeat").nextSibling).toHaveTextContent("agora");
    expect(screen.getByText("Próxima avaliação").nextSibling).toHaveTextContent(/em 29 min/);
    expect(screen.queryByText("Motivo")).not.toBeInTheDocument();
  });

  it("OFFLINE: says so, with the backend's reason and how old the heartbeat is", () => {
    render(<WorkerStatusView worker={offline} now={NOW} />);
    expect(screen.getByTestId("worker-state")).toHaveTextContent("OFFLINE");
    expect(screen.getByText("Motivo").nextSibling).toHaveTextContent("heartbeat do worker expirou");
    expect(screen.getByText("Último heartbeat").nextSibling).toHaveTextContent(/há 2 h 14 min/);
    expect(screen.queryByText("Próxima avaliação")).not.toBeInTheDocument();
  });

  it("shows the last outage the worker detected when it came back", () => {
    render(
      <WorkerStatusView
        worker={{
          ...online,
          lastDowntime: {
            from: "2026-10-01T01:45:00.000Z",
            to: "2026-10-01T12:02:00.000Z",
            durationSeconds: 37_020,
            lastEvaluationAt: "2026-10-01T01:00:00.000Z",
            previousStopReason: null,
          },
        }}
        now={NOW}
      />,
    );
    expect(screen.getByText("Última queda detectada").nextSibling).toHaveTextContent(/10 h 17 min sem rodar/);
    expect(screen.getByText("Última queda detectada").nextSibling).toHaveTextContent(/hibernação/);
  });
});

describe("WorkerStatusCard", () => {
  it('"sem entrada" is not "offline": no trades + HOLD signals still shows ONLINE', async () => {
    const api = mockApi([
      { path: "bot/status", body: { ...botStatusFixture, paused: false, openTrades: 0, worker: { ...online, lastHeartbeatAt: new Date().toISOString() } } },
    ]);
    vi.stubGlobal("fetch", api.fetchMock);
    renderWithProviders(<WorkerStatusCard />);
    expect(await screen.findByTestId("worker-state")).toHaveTextContent("ONLINE");
  });

  it("opening the panel only reads state (GET), it never starts or drives the worker", async () => {
    const api = mockApi([{ path: "bot/status", body: { ...botStatusFixture, worker: online } }]);
    vi.stubGlobal("fetch", api.fetchMock);
    renderWithProviders(<WorkerStatusCard />);
    await screen.findByTestId("worker-state");
    expect(api.calls.length).toBeGreaterThan(0);
    expect(api.calls.every((c) => c.method === "GET" && c.path === "bot/status")).toBe(true);
  });

  it("an unreachable backend is reported as such, never guessed as OFFLINE/ONLINE", async () => {
    const api = mockApi([{ path: "bot/status", status: 503, body: { message: "down" } }]);
    vi.stubGlobal("fetch", api.fetchMock);
    renderWithProviders(<WorkerStatusCard />);
    await waitFor(() => expect(screen.getByText(/Backend inacessível/)).toBeInTheDocument());
    expect(screen.queryByTestId("worker-state")).not.toBeInTheDocument();
  });
});

/** Static guard: no frontend code may start/drive the strategy (no "keep the bot alive" pings). */
describe("frontend never drives the worker", () => {
  const roots = ["app", "components", "hooks", "lib"];
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return files(p);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
    });

  it("has no calls to start/evaluate/run-strategy style endpoints", () => {
    const offenders = roots
      .flatMap(files)
      // Endpoint-shaped strings only (comments may name backend methods like runCycle).
      .filter((f) => /["'`/](bot\/start|evaluate|run-strategy|tick|bot\/wake|keep-?alive)["'`/?]/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
