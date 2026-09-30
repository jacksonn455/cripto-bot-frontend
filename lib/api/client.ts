import type { z } from "zod";
import { BASE_PATH } from "@/lib/base-path";

/** All browser requests go through the Next.js proxy (app/api/backend), never to the backend directly. */
export const API_BASE = `${BASE_PATH}/api/backend`;

export type ApiErrorKind =
  /** Proxy reached, backend unreachable or timed out. */
  | "offline"
  /** Backend answered 4xx/5xx. */
  | "http"
  /** Backend answered 2xx but the body doesn't match the expected schema. */
  | "validation"
  /** The Next.js server itself is unreachable. */
  | "network";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isClientError() {
    return this.kind === "http" && this.status !== undefined && this.status >= 400 && this.status < 500;
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export function buildUrl(path: string, params?: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return `${API_BASE}/${path.replace(/^\/+/, "")}${qs ? `?${qs}` : ""}`;
}

async function request<T extends z.ZodType>(
  schema: T,
  path: string,
  init: RequestInit & { params?: QueryParams } = {},
): Promise<z.infer<T>> {
  const { params, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), {
      ...rest,
      headers: { accept: "application/json", ...(rest.body ? { "content-type": "application/json" } : {}) },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("network", "Sem conexão com o servidor do painel.");
  }

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const { error, message } = parseErrorBody(body);
    if (error === "AUTH_REQUIRED" && typeof window !== "undefined") {
      // Session expired (dashboard login on): back to the login page, then here again.
      // Outside React (no router here); a full navigation also resets the in-memory caches.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    if (error === "BACKEND_OFFLINE" || error === "BACKEND_TIMEOUT") {
      throw new ApiError("offline", message ?? "Backend indisponível.", res.status);
    }
    throw new ApiError("http", message ?? `Erro ${res.status} do backend.`, res.status, body);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error(`[api] Resposta inesperada de ${path}`, parsed.error.issues);
    throw new ApiError("validation", "O backend respondeu em um formato inesperado.", res.status, parsed.error.issues);
  }
  return parsed.data;
}

/** Nest errors look like { statusCode, message: string | string[], error }. */
function parseErrorBody(body: unknown): { error?: string; message?: string } {
  if (!body || typeof body !== "object") return {};
  const { error, message } = body as { error?: unknown; message?: unknown };
  return {
    error: typeof error === "string" ? error : undefined,
    message: Array.isArray(message) ? message.join("; ") : typeof message === "string" ? message : undefined,
  };
}

export function apiGet<T extends z.ZodType>(schema: T, path: string, params?: QueryParams, signal?: AbortSignal) {
  return request(schema, path, { method: "GET", params, signal });
}

export function apiPost<T extends z.ZodType>(schema: T, path: string, body?: unknown) {
  return request(schema, path, { method: "POST", body: JSON.stringify(body ?? {}) });
}
