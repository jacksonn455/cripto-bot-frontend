import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFraction, formatNumber, formatSignedPercent, MINUS } from "@/lib/format";
import { DSR_THRESHOLD, type BacktestRun } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** Fewer daily returns than this and annualized numbers are mostly noise. */
const SHORT_PERIOD_DAYS = 90;

interface Item {
  label: string;
  value: string;
  hint?: string;
}

function Grid({ items }: { items: Item[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="text-sm tabular-nums">{i.value}</dd>
          {i.hint && <dd className="text-xs text-muted-foreground">{i.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** The multiple-testing verdict: does the Sharpe survive the number of variations tried? */
function DsrVerdict({ run }: { run: BacktestRun }) {
  const o = run.overfitting;
  if (!o) return null;
  if (o.deflatedSharpe === null) {
    return (
      <p role="note" className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          Ainda não dá para calcular o Sharpe deflacionado: {o.trials} combinações foram testadas, mas só {o.trialsWithSharpe} têm o Sharpe
          diário gravado (as outras são execuções antigas). Rode as variantes de novo para ter a variância entre elas.
        </span>
      </p>
    );
  }
  const passes = o.deflatedSharpe >= DSR_THRESHOLD;
  const Icon = passes ? CheckCircle2 : AlertTriangle;
  return (
    <p
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        passes ? "border-profit/40 bg-profit/10" : "border-warning/50 bg-warning/10",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", passes ? "text-profit" : "text-warning")} aria-hidden />
      <span>
        <strong>Sharpe deflacionado (DSR): {formatFraction(o.deflatedSharpe, 0)}.</strong>{" "}
        {passes
          ? `Passa no critério de ${formatFraction(DSR_THRESHOLD, 0)}: mesmo descontando as ${o.trials} combinação(ões) testada(s), o Sharpe dificilmente é sorte.`
          : `Abaixo de ${formatFraction(DSR_THRESHOLD, 0)}: com ${o.trials} combinação(ões) testada(s), um Sharpe assim pode sair por sorte. Não use esta variante para mudar a produção.`}
      </span>
    </p>
  );
}

/**
 * Daily, annualized metrics from the equity curve (open positions marked to market), plus the
 * multiple-testing view (Deflated Sharpe, Harvey–Liu haircut). The per-trade Sharpe in the grid
 * above is not annualized and not comparable across runs; these are.
 */
export function RunRiskAdjusted({ run }: { run: BacktestRun }) {
  const r = run.riskAdjusted;
  if (!r) return null;
  const o = run.overfitting;
  const items: Item[] = [
    { label: "Retorno total", value: formatSignedPercent(r.totalReturn * 100), hint: `${formatNumber(r.days, 0)} dias` },
    { label: "Retorno anual (CAGR)", value: formatSignedPercent(r.cagr * 100) },
    { label: "Volatilidade anual", value: formatFraction(r.annualVolatility, 1) },
    { label: "Sharpe anualizado", value: formatNumber(r.sharpeAnnualized, 2), hint: "Retornos diários × √365" },
    { label: "Sortino anualizado", value: formatNumber(r.sortinoAnnualized, 2), hint: "Só os dias de perda contam como risco" },
    { label: "Calmar", value: formatNumber(r.calmar, 2), hint: "Retorno anual ÷ pior queda" },
    {
      label: "Pior queda (curva diária)",
      value: r.maxDrawdown > 0 ? `${MINUS}${formatFraction(r.maxDrawdown, 1)}` : "—",
      hint: "Inclui posições abertas marcadas a mercado",
    },
    {
      label: "Sharpe probabilístico (PSR)",
      value: formatFraction(r.probabilisticSharpe, 0),
      hint: "Chance de o Sharpe real ser maior que 0",
    },
    { label: "Assimetria / curtose", value: `${formatNumber(r.skewness, 2)} / ${formatNumber(r.kurtosis, 1)}`, hint: "Normal = 0 / 3" },
  ];
  if (o) {
    if (o.expectedMaxSharpeAnnualized != null) {
      items.push({
        label: "Sharpe esperado por sorte",
        value: formatNumber(o.expectedMaxSharpeAnnualized, 2),
        hint: `O melhor de ${o.trials} tentativa(s) sem edge nenhum`,
      });
    }
    items.push({
      label: "Sharpe após haircut",
      value: formatNumber(o.haircutSharpe, 2),
      hint: `Harvey & Liu (Bonferroni): ${formatFraction(o.haircut, 0)} descontado`,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métricas ajustadas ao risco</CardTitle>
        <CardDescription>
          Calculadas sobre a curva de capital diária e anualizadas com 365 dias (cripto opera todo dia). Diferente do Sharpe por trade,
          dá para comparar entre execuções.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DsrVerdict run={run} />
        {r.days < SHORT_PERIOD_DAYS && (
          <p className="text-xs text-warning">Período curto ({r.days} dias): números anualizados oscilam muito com poucas semanas de dados.</p>
        )}
        <Grid items={items} />
      </CardContent>
    </Card>
  );
}
