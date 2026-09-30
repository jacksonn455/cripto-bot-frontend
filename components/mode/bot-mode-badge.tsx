"use client";

import { AlertOctagon, CirclePause } from "lucide-react";
import { useBotStatus } from "@/hooks/use-bot-status";
import { MODE_META } from "@/lib/mode";
import { cn } from "@/lib/utils";

/** The mode the bot is actually executing in (from /bot/status), always in the header. */
export function BotModeBadge() {
  const { data } = useBotStatus();

  if (!data) {
    return (
      <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
        BOT: MODO DESCONHECIDO
      </span>
    );
  }

  const live = data.mode === "LIVE";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        role="status"
        aria-label={`Bot rodando em modo ${data.mode}${live ? ", dinheiro real" : ""}`}
        title={MODE_META[data.mode].description}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold tracking-wide whitespace-nowrap",
          MODE_META[data.mode].className,
          live && "animate-pulse motion-reduce:animate-none",
        )}
      >
        {live && <AlertOctagon className="size-3.5" aria-hidden />}
        BOT: {data.mode}
        {live && <span className="hidden sm:inline">· DINHEIRO REAL</span>}
      </span>
      {data.paused && (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-warning/50 px-2 py-1 text-xs font-semibold text-warning"
          title={data.pauseReason ? `Motivo: ${data.pauseReason}` : undefined}
        >
          <CirclePause className="size-3.5" aria-hidden />
          PAUSADO
        </span>
      )}
    </span>
  );
}
