"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RotateCw, ServerOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useBotStatus } from "@/hooks/use-bot-status";
import { ApiError } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * App-wide banner driven by the /bot/status poll; disappears by itself when the backend is back.
 * On that transition it also refetches every query left in error, so screens without polling
 * (e.g. the backtest list) recover without a click.
 */
export function BackendOfflineBanner() {
  const status = useBotStatus();
  const queryClient = useQueryClient();
  const offline = status.error instanceof ApiError && (status.error.kind === "offline" || status.error.kind === "network");

  const wasOffline = useRef(false);
  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
    } else if (wasOffline.current && status.isSuccess) {
      wasOffline.current = false;
      void queryClient.refetchQueries({ predicate: (q) => q.state.status === "error" });
    }
  }, [offline, status.isSuccess, queryClient]);

  if (!offline) return null;

  return (
    <div role="alert" className="border-b border-loss/30 bg-loss/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1">
        <ServerOff className="size-4 shrink-0 text-loss" aria-hidden />
        <span className="font-medium">Backend offline.</span>
        <span className="text-muted-foreground">
          {status.dataUpdatedAt
            ? `Dados exibidos são de ${formatRelative(status.dataUpdatedAt)} e podem estar desatualizados.`
            : "Nenhum dado foi carregado ainda."}{" "}
          Nova tentativa automática a cada 10 s.
        </span>
        <Button
          variant="outline"
          size="xs"
          className="ml-auto"
          onClick={() => void status.refetch()}
          disabled={status.isFetching}
        >
          <RotateCw className={cn(status.isFetching && "animate-spin")} aria-hidden />
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}
