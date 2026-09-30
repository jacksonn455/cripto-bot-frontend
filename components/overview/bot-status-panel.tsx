"use client";

import { AlertTriangle, CheckCircle2, CirclePause, CirclePlay, PowerOff, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { ModeBadge } from "@/components/mode/mode-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHealth } from "@/hooks/use-data";
import { useNow } from "@/hooks/use-now";
import { loopHealth, pauseReasonLabel } from "@/lib/bot-health";
import { formatDateTime, formatDuration, formatRelative } from "@/lib/format";
import type { BotStatus } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { BotControls } from "./bot-controls";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[11rem_1fr] sm:gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function When({ iso, now }: { iso: string; now: number }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {formatRelative(iso, now)} <span className="text-muted-foreground">({formatDateTime(iso)})</span>
    </time>
  );
}

function Service({ name, ok, latencyMs, down }: { name: string; ok: boolean; latencyMs: number | null; down: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1.5">
      <CheckCircle2 className="size-4 text-profit" aria-hidden /> {name} OK
      {latencyMs != null && <span className="text-muted-foreground">({latencyMs} ms)</span>}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 font-medium text-loss">
      <XCircle className="size-4" aria-hidden /> {name}: {down}
    </span>
  );
}

/** /health: Mongo is required; Redis is only a cache (reports keep working without it, slower). */
function ServicesHealth() {
  const health = useHealth();
  if (!health.data) {
    return <span className="text-muted-foreground">{health.isError ? "Não foi possível verificar" : "Verificando…"}</span>;
  }
  const { mongo, redis } = health.data;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <Service name="MongoDB" ok={mongo.ok} latencyMs={mongo.latencyMs} down="fora do ar" />
      <Service name="Redis (cache)" ok={redis.ok} latencyMs={redis.latencyMs} down="indisponível — relatórios sem cache, o painel continua funcionando" />
    </span>
  );
}

export function BotStatusPanel({ status }: { status: BotStatus }) {
  const now = useNow(5_000);
  const health = loopHealth(status, now);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Status do bot <ModeBadge mode={status.mode} />
        </CardTitle>
        <CardDescription>Estado atual da execução. Os comandos agem sobre o modo em que o bot está rodando.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <BotControls status={status} />
        <dl className="divide-y">
          <Row label="Estado">
            {status.paused ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 font-medium text-warning">
                <CirclePause className="size-4" aria-hidden /> Pausado
                <span className="font-normal text-foreground">· {pauseReasonLabel(status.pauseReason)}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-profit">
                <CirclePlay className="size-4" aria-hidden /> Ativo
              </span>
            )}
          </Row>
          <Row label="Loop de execução">
            {health.state === "disabled" && (
              <span className="inline-flex items-center gap-1.5 text-warning">
                <PowerOff className="size-4" aria-hidden /> Desligado (EXECUTION_ENABLED=false no backend)
              </span>
            )}
            {health.state === "starting" && <span className="text-muted-foreground">Iniciando, aguardando o primeiro ciclo…</span>}
            {health.state === "ok" && status.lastPollAt && (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <CheckCircle2 className="size-4 text-profit" aria-hidden /> Rodando · última verificação{" "}
                <When iso={status.lastPollAt} now={now} />
              </span>
            )}
            {health.state === "stale" && status.lastPollAt && (
              <span role="alert" className="inline-flex flex-wrap items-center gap-1.5 font-medium text-loss">
                <AlertTriangle className="size-4" aria-hidden />
                Loop possivelmente parado: sem verificação há {formatDuration(health.lagMs)} (esperado a cada{" "}
                {formatDuration(status.pollIntervalSeconds * 1000)})
              </span>
            )}
          </Row>
          <Row label="Último candle avaliado">
            {status.lastCycleAt ? (
              <When iso={status.lastCycleAt} now={now} />
            ) : (
              <span className="text-muted-foreground">Nenhum desde que o backend iniciou</span>
            )}
          </Row>
          <Row label="Última reconciliação">
            {status.lastReconciliationAt ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {status.lastReconciliationOk ? (
                  <>
                    <CheckCircle2 className="size-4 text-profit" aria-hidden /> OK
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-medium text-loss">
                    <XCircle className="size-4" aria-hidden /> Divergência encontrada
                  </span>
                )}
                <span aria-hidden>·</span> <When iso={status.lastReconciliationAt} now={now} />
              </span>
            ) : (
              <span className="text-muted-foreground">Ainda não executada</span>
            )}
          </Row>
          <Row label="Serviços do backend">
            <ServicesHealth />
          </Row>
          <Row label="Último erro">
            {status.lastError ? (
              <span className={cn("font-mono text-xs break-words text-loss")}>{status.lastError}</span>
            ) : (
              <span className="text-muted-foreground">Nenhum desde que o backend iniciou</span>
            )}
          </Row>
        </dl>
      </CardContent>
    </Card>
  );
}
