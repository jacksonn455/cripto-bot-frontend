import { NextRequest, NextResponse } from "next/server";
import { isAuthorized, SESSION_COOKIE } from "@/lib/auth";
import { serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";

/**
 * Only the backend endpoints the dashboard uses are proxied. Anything else returns 404, so this
 * route can't be used to reach arbitrary backend paths (e.g. /docs) with the API key attached.
 */
const ALLOWED_GET = [
  /^bot\/status$/,
  /^trades$/,
  /^trades\/export\.csv$/,
  /^trades\/[A-Za-z0-9]+$/,
  /^reports\/(summary|equity-curve|by-strategy|by-symbol|by-hour|compare-modes)$/,
  /^backtest\/runs$/,
  /^backtest\/runs\/[\w-]+$/,
  /^funding\/ranking$/,
  /^exchange\/(balance|candles)$/,
  /^events\/(stream|recent)$/,
  /^health$/,
  /^signals$/,
  /^strategies$/,
];
const ALLOWED_POST = [/^bot\/(pause|resume|kill-switch)$/, /^backtest\/run$/];

const DEFAULT_TIMEOUT_MS = 15_000;
// A backtest fetches historical candles and simulates the whole period synchronously.
const BACKTEST_TIMEOUT_MS = 5 * 60_000;

const PASSTHROUGH_RESPONSE_HEADERS = ["content-type", "content-disposition", "cache-control"];

type Ctx = RouteContext<"/api/backend/[...path]">;

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx, ALLOWED_GET);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx, ALLOWED_POST);
}

async function proxy(request: NextRequest, ctx: Ctx, allowed: RegExp[]) {
  // Defense in depth: proxy.ts already blocks, but this route is what can send bot commands.
  if (!(await isAuthorized(request.cookies.get(SESSION_COOKIE)?.value))) {
    return errorResponse(401, "AUTH_REQUIRED", "Entre com a senha do painel.");
  }
  const { path: segments } = await ctx.params;
  const path = segments.map(encodeURIComponent).join("/");
  if (!allowed.some((re) => re.test(path))) {
    return errorResponse(404, "NOT_PROXIED", "Endpoint não disponível pelo painel.");
  }

  const isStream = path === "events/stream";
  const target = `${serverEnv.apiUrl}/${path}${request.nextUrl.search}`;

  const headers = new Headers({ accept: request.headers.get("accept") ?? "application/json" });
  if (serverEnv.apiKey) headers.set("x-control-api-key", serverEnv.apiKey);

  let body: string | undefined;
  if (request.method === "POST") {
    body = await request.text();
    headers.set("content-type", "application/json");
  }

  // SSE lives as long as the browser keeps the connection; everything else gets a timeout.
  const signal = isStream
    ? request.signal
    : AbortSignal.any([
        request.signal,
        AbortSignal.timeout(path === "backtest/run" ? BACKTEST_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
      ]);

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: request.method, headers, body: body || undefined, signal, cache: "no-store" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return errorResponse(504, "BACKEND_TIMEOUT", "O backend demorou demais para responder.");
    }
    return errorResponse(503, "BACKEND_OFFLINE", "Não foi possível conectar ao backend.");
  }

  const responseHeaders = new Headers();
  for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  if (isStream) {
    responseHeaders.set("cache-control", "no-cache, no-transform");
    responseHeaders.set("x-accel-buffering", "no");
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ statusCode: status, error, message }, { status });
}
