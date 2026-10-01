"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBotStatus } from "@/hooks/use-bot-status";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatDuration, formatRelative } from "@/lib/format";
import type { WorkerStatus } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const STATE = {
  ONLINE: { label: "ONLINE", dot: "bg-profit", text: "text-profit" },
  OFFLINE: { label: "OFFLINE", dot: "bg-loss", text: "text-loss" },
  STARTING: { label: "INICIANDO", dot: "bg-warning animate-pulse motion-reduce:animate-none", text: "text-warning" },
  DISABLED: { label: "DESLIGADO", dot: "bg-muted-foreground", text: "text-muted-foreground" },
} as const;

const REASONS: Record<string, string> = {
  "worker heartbeat expired": "heartbeat do worker expirou (worker heartbeat expired)",
  "no heartbeat recorded yet": "nenhum heartbeat registrado ainda",
  "EXECUTION_ENABLED=false": "loop desligado no backend (EXECUTION_ENABLED=false)",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-1.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Ago({ iso, now }: { iso: string | null; now: number }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {formatRelative(iso, now)} <span className="text-muted-foreground">({formatDateTime(iso)})</span>
    </time>
  );
}

/** Pure view of the backend's WorkerStatus — exported for tests. */
export function WorkerStatusView({ worker, now }: { worker: WorkerStatus; now: number }) {
  const s = STATE[worker.state];
  return (
    <dl className="divide-y">
      <Row label="Estado">
        <span className={cn("inline-flex items-center gap-2 font-semibold", s.text)} data-testid="worker-state">
          <span className={cn("size-2.5 rounded-full", s.dot)} aria-hidden /> {s.label}
        </span>
      </Row>
      {worker.state !== "ONLINE" && worker.reason && (
        <Row label="Motivo">{REASONS[worker.reason] ?? worker.reason}</Row>
      )}
      {worker.state === "ONLINE" && worker.uptimeSeconds != null && (
        <Row label="Uptime">{formatDuration(worker.uptimeSeconds * 1000)}</Row>
      )}
      <Row label="Último heartbeat">
        <Ago iso={worker.lastHeartbeatAt} now={now} />
      </Row>
      <Row label="Última avaliação">
        <Ago iso={worker.lastEvaluationAt} now={now} />
      </Row>
      {worker.state === "ONLINE" && worker.nextEvaluationAt && (
        <Row label="Próxima avaliação">
          em {formatDuration(Math.max(0, new Date(worker.nextEvaluationAt).getTime() - now))}{" "}
          <span className="text-muted-foreground">(fechamento do candle, {formatDateTime(worker.nextEvaluationAt)})</span>
        </Row>
      )}
      {worker.lastDowntime && (
        <Row label="Última queda detectada">
          {formatDateTime(worker.lastDowntime.from)} → {formatDateTime(worker.lastDowntime.to)}{" "}
          <span className="text-muted-foreground">
            ({formatDuration(worker.lastDowntime.durationSeconds * 1000)} sem rodar
            {worker.lastDowntime.previousStopReason
              ? ` · encerrado pela plataforma: ${worker.lastDowntime.previousStopReason}`
              : " · sem parada registrada: crash ou hibernação da instância"}
            )
          </span>
        </Row>
      )}
      {worker.lastError && worker.lastErrorAt && (
        <Row label="Último erro do worker">
          <span className="font-mono text-xs break-words text-loss">{worker.lastError}</span>{" "}
          <span className="text-muted-foreground">({formatRelative(worker.lastErrorAt, now)})</span>
        </Row>
      )}
    </dl>
  );
}

/**
 * Whether the execution worker is alive, as reported by the backend from its persisted heartbeat.
 * Independent of trades: "sem entrada" never means "worker offline". Reading this never starts,
 * wakes or keeps anything alive in the worker — it is a plain GET of persisted state.
 */
export function WorkerStatusCard() {
  const status = useBotStatus();
  const now = useNow(5_000);
  const worker = status.data?.worker;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Krypto worker</CardTitle>
        <CardDescription>
          Processo do backend que avalia BTCUSDT e ETHUSDT a cada candle fechado, com ou sem o painel aberto. O estado vem do heartbeat
          que o próprio worker grava.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {worker ? (
          <WorkerStatusView worker={worker} now={now} />
        ) : status.isError ? (
          <p className="text-sm text-loss">Backend inacessível: não é possível confirmar o estado do worker agora.</p>
        ) : status.data ? (
          <p className="text-sm text-muted-foreground">Este backend ainda não publica o heartbeat do worker.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Verificando…</p>
        )}
      </CardContent>
    </Card>
  );
}
