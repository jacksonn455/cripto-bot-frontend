"use client";

import { AlertTriangle, RotateCw, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function describeError(error: unknown): { title: string; message: string; offline: boolean } {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "offline":
        return {
          title: "Backend offline",
          message: "O painel não conseguiu falar com o servidor do Krypto. Verifique se ele está rodando.",
          offline: true,
        };
      case "network":
        return { title: "Sem conexão", message: "O servidor do painel não respondeu.", offline: true };
      case "validation":
        return {
          title: "Resposta inesperada",
          message: "O backend respondeu em um formato que o painel não reconhece. Veja o console para detalhes.",
          offline: false,
        };
      case "http":
        return {
          title: error.status === 404 ? "Não encontrado" : `Erro ${error.status ?? ""} do backend`.trim(),
          message: error.message,
          offline: false,
        };
    }
  }
  return { title: "Erro inesperado", message: error instanceof Error ? error.message : String(error), offline: false };
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorState({ error, onRetry, retrying, className }: ErrorStateProps) {
  const { title, message, offline } = describeError(error);
  const Icon = offline ? ServerOff : AlertTriangle;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center",
        className,
      )}
    >
      <Icon className="size-6 text-loss" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-prose text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RotateCw className={cn(retrying && "animate-spin")} aria-hidden />
          Tentar de novo
        </Button>
      )}
    </div>
  );
}
