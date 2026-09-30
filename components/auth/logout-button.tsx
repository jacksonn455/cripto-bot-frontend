"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";

export function LogoutButton() {
  const logout = async () => {
    await fetch(withBasePath("/api/auth/logout"), { method: "POST" }).catch(() => undefined);
    // Full navigation on purpose: the server layout must re-render without the session.
    window.location.assign(withBasePath("/login"));
  };
  return (
    <Button variant="ghost" size="icon" onClick={logout} aria-label="Sair do painel" title="Sair">
      <LogOut />
    </Button>
  );
}
