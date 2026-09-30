import { useQuery } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { botStatusFixture } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { api } from "@/lib/api/endpoints";
import { BackendOfflineBanner } from "./backend-offline-banner";

afterEach(() => vi.unstubAllGlobals());

/** A screen query without polling, like the backtest list. */
function RunsProbe() {
  const q = useQuery({ queryKey: ["probe"], queryFn: () => api.funding.ranking({}) });
  return <p>{q.isError ? "probe:error" : q.data ? `probe:${q.data.total}` : "probe:loading"}</p>;
}

describe("BackendOfflineBanner", () => {
  it("refetches failed queries when the backend comes back", async () => {
    let online = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (!online) return new Response(JSON.stringify({ error: "BACKEND_OFFLINE", message: "x" }), { status: 503 });
        const body = String(input).includes("bot/status") ? botStatusFixture : { items: [], total: 0, page: 1, limit: 20, scannedAt: null, stats: null, watch: [] };
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
    const { client } = renderWithProviders(
      <>
        <BackendOfflineBanner />
        <RunsProbe />
      </>,
    );

    expect(await screen.findByText("Backend offline.")).toBeInTheDocument();
    expect(await screen.findByText("probe:error")).toBeInTheDocument();

    online = true;
    await client.refetchQueries({ queryKey: ["bot", "status"] }); // what the 10 s poll does
    await waitFor(() => expect(screen.getByText("probe:0")).toBeInTheDocument());
    expect(screen.queryByText("Backend offline.")).not.toBeInTheDocument();
  });
});
