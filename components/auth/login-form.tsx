"use client";

import { Loader2, LogIn } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND_NAME, BrandMark } from "@/components/layout/brand";
import { withBasePath } from "@/lib/base-path";

/** Only same-app relative paths, so ?next= can't send the user to another site. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/auth/login"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Full navigation: the layout re-renders with the session and starts the data providers.
        window.location.assign(withBasePath(safeNext(params.get("next"))));
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? "Não foi possível entrar.");
    } catch {
      setError("Sem conexão com o servidor do painel.");
    }
    setPending(false);
  };

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <BrandMark size={96} decorative={false} className="mx-auto mb-2 ring-2" />
          <CardTitle className="text-xl">{BRAND_NAME}</CardTitle>
          <CardDescription>
            Inteligência de mercado cripto e acompanhamento das suas estratégias. Este painel pode pausar as operações e
            acionar o kill switch: entre com a senha configurada no servidor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? "login-error" : undefined}
              />
              {error && (
                <p id="login-error" role="alert" className="text-sm text-loss">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={pending || password.length === 0}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
