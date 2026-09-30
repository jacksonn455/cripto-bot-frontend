import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Optimistic auth check (only when DASHBOARD_PASSWORD is set): pages redirect to /login and the
 * backend proxy answers 401. The backend proxy route verifies the session again itself, since
 * it is the one that can send commands (pause, kill switch).
 */
export async function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ statusCode: 401, error: "AUTH_REQUIRED", message: "Entre com a senha do painel." }, { status: 401 });
  }
  // clone() keeps the basePath (/bot), so the redirect lands on /bot/login; pathname here excludes it.
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the login page, its API, and static assets.
  // "/" listed on its own: with a basePath the pattern below becomes /bot/(...) and misses bare /bot.
  matcher: ["/", "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
