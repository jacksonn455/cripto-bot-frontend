/**
 * Sub-path the app is served under (e.g. "/bot" for jacksonmagnabosco.dev/bot); "" = domain root.
 * Inlined at build time. Next.js prefixes <Link>, router and redirect() by itself, but plain
 * fetch() and window.location need it explicitly.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/** An app-relative path ("/login") as a browser URL path ("/bot/login"). */
export function withBasePath(path: string): string {
  if (!BASE_PATH) return path;
  return path === "/" ? BASE_PATH : `${BASE_PATH}${path}`;
}
