import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { BASE_PATH } from "@/lib/base-path";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: BASE_PATH || "/", maxAge: 0 });
  return response;
}
