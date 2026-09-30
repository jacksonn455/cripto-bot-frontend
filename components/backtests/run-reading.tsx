import { AlertTriangle, CheckCircle2, Info, Lightbulb, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readRun, type FindingTone } from "@/lib/backtest-explain";
import type { BacktestRun } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export const TONE_ICON = { good: CheckCircle2, bad: XCircle, warn: AlertTriangle, neutral: Info } as const;
export const TONE_TEXT: Record<FindingTone, string> = {
  good: "text-profit",
  bad: "text-loss",
  warn: "text-warning",
  neutral: "text-muted-foreground",
};
const TONE_BOX: Record<FindingTone, string> = {
  good: "border-profit/40 bg-profit/10",
  bad: "border-loss/40 bg-loss/10",
  warn: "border-warning/50 bg-warning/10",
  neutral: "",
};

/** "O que esse resultado quer dizer": verdict + findings in plain language. */
export function RunReading({ run, compact = false }: { run: BacktestRun; compact?: boolean }) {
  const reading = readRun(run);
  const VerdictIcon = TONE_ICON[reading.verdict.tone];
  const verdict = (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", TONE_BOX[reading.verdict.tone])}>
      <VerdictIcon className={cn("mt-0.5 size-5 shrink-0", TONE_TEXT[reading.verdict.tone])} aria-hidden />
      <div>
        <p className="font-semibold">Veredito: {reading.verdict.title}</p>
        <p className="text-sm text-muted-foreground">{reading.verdict.text}</p>
      </div>
    </div>
  );
  const findings = (
    <ul className="grid gap-3 md:grid-cols-2">
      {reading.findings.map((f) => {
        const Icon = TONE_ICON[f.tone];
        return (
          <li key={f.key} className="flex items-start gap-2.5 text-sm">
            <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[f.tone])} aria-hidden />
            <div>
              <p className="font-medium">{f.title}</p>
              <p className="text-muted-foreground">{f.text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );

  if (compact) {
    return (
      <div className="space-y-3">
        {verdict}
        {findings}
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-4" aria-hidden /> O que esse resultado quer dizer
        </CardTitle>
        <CardDescription>Leitura automática dos números abaixo, em linguagem simples. Não é recomendação de investimento.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verdict}
        {findings}
      </CardContent>
    </Card>
  );
}
