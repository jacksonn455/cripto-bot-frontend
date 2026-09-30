"use client";

import { cn } from "@/lib/utils";
import { useLiveEvents } from "./live-events-provider";

const LABEL = {
  open: "Tempo real conectado",
  connecting: "Conectando ao tempo real…",
  reconnecting: "Tempo real desconectado, reconectando…",
} as const;

export function LiveIndicator() {
  const { status } = useLiveEvents();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status" title={LABEL[status]}>
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          status === "open" ? "bg-profit" : "animate-pulse bg-warning motion-reduce:animate-none",
        )}
      />
      <span className="hidden md:inline">{status === "open" ? "Ao vivo" : "Reconectando"}</span>
      <span className="sr-only md:hidden">{LABEL[status]}</span>
    </span>
  );
}
