import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fundingPageFixture, strategiesFixture } from "@/test/fixtures";
import { mockApi, renderWithProviders } from "@/test/render";
import { FundingView } from "./funding-view";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stub(page = fundingPageFixture) {
  const spy = vi.fn(
    mockApi([
      { path: "funding/ranking", body: page },
      { path: "strategies", body: strategiesFixture },
    ]).fetchMock,
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}
const fundingUrls = (spy: ReturnType<typeof vi.fn>) =>
  spy.mock.calls.map(([u]) => new URL(String(u), "http://x")).filter((u) => u.pathname.endsWith("funding/ranking"));

describe("FundingView", () => {
  it("explains what funding is, that it is read-only, and reads the market", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-09-29T12:30:00.000Z"));
    stub();
    renderWithProviders(<FundingView />);

    expect(screen.getByText("O que é funding e para que serve esta tela")).toBeInTheDocument();
    expect(screen.getByText("Somente leitura.")).toBeInTheDocument();
    expect(await screen.findByText("Mercado equilibrado")).toBeInTheDocument(); // median 5,5% a.a.
    expect(screen.getByText("618")).toBeInTheDocument(); // longs paying
    // The bot's coin, highlighted, with its reading.
    const btc = screen.getByText("BTCUSDT", { selector: "p" }).closest("div")!.parentElement!;
    expect(within(btc).getByText("+6,63% a.a.")).toBeInTheDocument();
    expect(within(btc).getByText(/Comprados pagam/)).toBeInTheDocument();
    expect(screen.getByText(/ETHUSDT: sem contrato perpétuo/)).toBeInTheDocument();
  });

  it("interprets each row and paginates on the server", async () => {
    const spy = stub();
    const user = userEvent.setup();
    renderWithProviders(<FundingView />);

    const row = (await screen.findByText("DOGEUSDT")).closest("tr")!;
    expect(within(row).getByText("+32,85%")).toBeInTheDocument();
    expect(within(row).getByText("Comprados pagam")).toBeInTheDocument();
    expect(within(row).getByText("Elevada")).toBeInTheDocument();
    expect(screen.getByText("1–50 de 922")).toBeInTheDocument(); // what the server answered

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(fundingUrls(spy).at(-1)!.searchParams.get("page")).toBe("2"));
    expect(fundingUrls(spy).at(-1)!.searchParams.get("limit")).toBe("25");
  });

  it("warns when the last scan is old", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-09-29T15:30:00.000Z")); // 3h30 after the scan
    stub();
    renderWithProviders(<FundingView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("mais de 2 horas");
  });

  it("goes back to page 1 when the order changes", async () => {
    const spy = stub();
    const user = userEvent.setup();
    renderWithProviders(<FundingView />);
    await screen.findByText("DOGEUSDT");
    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await user.click(screen.getByRole("button", { name: "Menores (negativas)" }));
    await waitFor(() => {
      const last = fundingUrls(spy).at(-1)!;
      expect(last.searchParams.get("order")).toBe("asc");
      expect(last.searchParams.get("page")).toBe("1");
    });
  });
});
