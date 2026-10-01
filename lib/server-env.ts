import "server-only";

const DEV_API_URL = "http://localhost:8000";

/**
 * Backend base URL. API_URL (runtime, server-only) wins over NEXT_PUBLIC_API_URL (inlined at
 * build time), so a built app can be pointed at another backend just by restarting it.
 * `||` instead of `??`: an empty variable (e.g. `API_URL=` in the Vercel UI) counts as unset.
 *
 * Production (VERCEL_ENV=production) has no fallback: the API key travels in a header, so the
 * backend must be reached over https. Dev and preview fall back to localhost.
 */
export function resolveApiUrl(env: Record<string, string | undefined> = process.env): string {
  const configured = (env.API_URL || env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  if (env.VERCEL_ENV === "production") {
    if (!/^https:\/\/[^/]/i.test(configured)) {
      throw new Error("CONFIG_MISSING: API_URL não configurada ou não é https");
    }
    return configured;
  }
  return configured || DEV_API_URL;
}

/**
 * Server-only configuration. The browser never talks to the backend directly: every request
 * goes through /api/backend/*, so API_KEY stays on the server.
 */
export const serverEnv = {
  get apiUrl() {
    return resolveApiUrl();
  },
  apiKey: process.env.API_KEY || undefined,
};
