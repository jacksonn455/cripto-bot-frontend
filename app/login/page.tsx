import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { authEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export const metadata = { title: "Entrar" };

export default async function Page() {
  // Nothing to do here when login is off or the session is already valid.
  if (!authEnabled() || (await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) redirect("/");
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
