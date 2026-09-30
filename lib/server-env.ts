import "server-only";

/**
 * Server-only configuration. The browser never talks to the backend directly: every request
 * goes through /api/backend/*, so API_KEY stays on the server.
 *
 * API_URL (runtime, server-only) wins over NEXT_PUBLIC_API_URL (inlined at build time), so a
 * built app can be pointed at another backend just by restarting it with a different API_URL.
 */
export const serverEnv = {
  apiUrl: (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, ""),
  apiKey: process.env.API_KEY || undefined,
};
