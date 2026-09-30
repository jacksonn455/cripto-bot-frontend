"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, FlaskConical, Info, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { describeError } from "@/components/states/error-state";
import { QueryState } from "@/components/states/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAiStatus } from "@/hooks/use-data";
import { useDataMode } from "@/hooks/use-data-mode";
import { api } from "@/lib/api/endpoints";
import { formatDuration, formatNumber } from "@/lib/format";
import type { AgentKey, AgentRunResult, AiStatus, AnalysisOutput } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const SEVERITY: Record<AnalysisOutput["findings"][number]["severity"], { label: string; className: string }> = {
  info: { label: "Info", className: "border-border text-muted-foreground" },
  warning: { label: "Atenção", className: "border-warning/60 text-warning" },
  critical: { label: "Crítico", className: "border-loss/60 text-loss" },
};

const CONFIDENCE: Record<AnalysisOutput["confidence"], string> = { low: "baixa", medium: "média", high: "alta" };

/** Suggested questions per agent, to make the first use obvious. */
const EXAMPLES: Partial<Record<AgentKey, string>> = {
  "performance-analyst": "O resultado em PAPER está coerente com os backtests? Long e Short se comportam diferente?",
  "trade-reviewer": "Os últimos stops foram ruído ou a entrada estava errada?",
  "signal-explainer": "Por que o bot não entrou em nenhum trade hoje?",
  "risk-analyst": "Estou concentrado demais em BTC e ETH ao mesmo tempo?",
  "market-analyst": "Qual o regime atual de cada símbolo e o que isso significa para a estratégia?",
};

export function AiView() {
  const status = useAiStatus();
  return (
    <>
      <PageHeader
        title="Análise com IA"
        description="Agentes da OpenAI que leem os dados do bot e explicam, avaliam e recomendam. Eles nunca abrem, fecham ou alteram trades."
      />
      <QueryState query={status} loading={<Skeleton className="h-64 w-full" />}>
        {(s) => <AiContent status={s} />}
      </QueryState>
    </>
  );
}

function AiContent({ status }: { status: AiStatus }) {
  const { mode } = useDataMode();
  const [agent, setAgent] = useState<AgentKey>((status.agents[0]?.key as AgentKey) ?? "performance-analyst");
  const [question, setQuestion] = useState("");
  const [symbol, setSymbol] = useState("");
  const run = useMutation({
    mutationFn: () =>
      api.ai.run(agent, {
        question: question.trim() || undefined,
        symbol: symbol.trim().toUpperCase() || undefined,
        mode,
      }),
  });
  const ready = status.enabled && status.configured && !status.reason;
  const selected = status.agents.find((a) => a.key === agent);

  return (
    <div className="space-y-6">
      <SafetyNote status={status} />

      {!ready && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            Agentes desligados no backend: {status.reason ?? "não configurado"}. Para ligar, defina{" "}
            <code>OPENAI_AGENTS_ENABLED=true</code> e <code>OPENAI_API_KEY</code> no ambiente do backend e reinicie.
          </span>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Escolha o agente</CardTitle>
          <CardDescription>Cada um tem um papel e só enxerga as ferramentas de leitura listadas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div role="radiogroup" aria-label="Agente" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {status.agents.map((a) => (
              <button
                key={a.key}
                type="button"
                role="radio"
                aria-checked={a.key === agent}
                onClick={() => setAgent(a.key as AgentKey)}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50",
                  a.key === agent && "border-primary ring-1 ring-primary",
                )}
              >
                <span className="block font-medium">{a.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{a.description}</span>
              </button>
            ))}
          </div>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) run.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ai-question">Pergunta (opcional)</Label>
              <Textarea
                id="ai-question"
                value={question}
                maxLength={2000}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={EXAMPLES[agent] ?? "Sem pergunta, o agente faz a análise padrão do papel dele."}
                rows={3}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40 space-y-1.5">
                <Label htmlFor="ai-symbol" className="text-xs">Símbolo (opcional)</Label>
                <Input id="ai-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="Todos" className="h-8 uppercase placeholder:normal-case" autoComplete="off" />
              </div>
              <p className="pb-1 text-xs text-muted-foreground">Modo analisado: {mode} (o seletor de dados no topo).</p>
              <Button type="submit" disabled={!ready || run.isPending} className="ml-auto">
                {run.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                {run.isPending ? "Analisando… (pode levar até 1–2 min)" : `Rodar ${selected?.name ?? "agente"}`}
              </Button>
            </div>
            {selected && (
              <p className="text-xs text-muted-foreground">
                Ferramentas: {selected.tools.map((t) => <code key={t} className="mr-1">{t}</code>)}
              </p>
            )}
          </form>

          {run.isError && (
            <p role="alert" className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm">
              <strong>{describeError(run.error).title}:</strong> {describeError(run.error).message}
            </p>
          )}
        </CardContent>
      </Card>

      {run.data && <AnalysisResult result={run.data} />}
    </div>
  );
}

function SafetyNote({ status }: { status: AiStatus }) {
  return (
    <p className="flex flex-wrap items-start gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Somente leitura: os agentes consultam trades, sinais, relatórios, parâmetros e mercado, mas não têm como enviar ordens
        nem pausar o bot. Toda recomendação é para você avaliar. Modelo: <code>{status.model}</code>
        {status.tracingEnabled ? " · tracing ligado (dados vão ao painel da OpenAI)" : ""}. Não é recomendação financeira.
      </span>
    </p>
  );
}

export function AnalysisResult({ result }: { result: AgentRunResult }) {
  const o = result.output;
  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Resultado <span className="text-sm font-normal text-muted-foreground">confiança {CONFIDENCE[o.confidence]}</span>
        </CardTitle>
        <CardDescription>
          {formatDuration(result.durationMs)} · {formatNumber(result.usage.totalTokens, 0)} tokens · {result.usage.requests} chamada(s) ao modelo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed">{o.summary}</p>

        {o.findings.length > 0 && (
          <section aria-labelledby="ai-findings" className="space-y-2">
            <h3 id="ai-findings" className="text-sm font-semibold">Achados</h3>
            <ul className="space-y-2">
              {o.findings.map((f, i) => (
                <li key={i} className="rounded-md border p-3 text-sm">
                  <span className={cn("mr-2 inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium", SEVERITY[f.severity].className)}>
                    {SEVERITY[f.severity].label}
                  </span>
                  <strong>{f.title}</strong>
                  <p className="mt-1 text-muted-foreground">{f.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {o.recommendations.length > 0 && (
          <section aria-labelledby="ai-recs" className="space-y-2">
            <h3 id="ai-recs" className="text-sm font-semibold">Recomendações (para você avaliar)</h3>
            <ul className="space-y-2">
              {o.recommendations.map((r, i) => (
                <li key={i} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{r.action}</strong>
                    {r.requiresBacktest && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-warning/60 px-1.5 py-0.5 text-xs text-warning">
                        <FlaskConical className="size-3" aria-hidden /> validar em backtest antes
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground">{r.rationale}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Dados usados: {o.dataUsed.length ? o.dataUsed.join(", ") : "não informado"}. Nada disso foi executado: é só análise.
        </p>
      </CardContent>
    </Card>
  );
}
