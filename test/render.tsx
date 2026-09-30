import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataModeProvider } from "@/hooks/use-data-mode";
import type { Mode } from "@/lib/schemas";

/** Renders with a fresh, retry-free QueryClient and the data-mode context. */
export function renderWithProviders(ui: ReactElement, { mode = "PAPER" as Mode } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <DataModeProvider initialMode={mode}>
          <TooltipProvider>{ui}</TooltipProvider>
        </DataModeProvider>
      </QueryClientProvider>,
    ),
  };
}

type Route = { method?: string; path: string; status?: number; body: unknown };

/** Stubs fetch for proxy calls ("/api/backend/<path>"); unmatched calls fail loudly. */
export function mockApi(routes: Route[]) {
  const calls: Array<{ method: string; path: string; body?: string }> = [];
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://painel");
    const path = url.pathname.replace(/^\/api\/backend\//, "");
    const method = init?.method ?? "GET";
    calls.push({ method, path, body: init?.body as string | undefined });
    const route = routes.find((r) => r.path === path && (r.method ?? "GET") === method);
    if (!route) return new Response(JSON.stringify({ message: `unmocked ${method} ${path}` }), { status: 500 });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  };
  return { fetchMock, calls };
}
