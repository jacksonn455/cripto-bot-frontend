import { formatFraction, formatMoney } from "@/lib/format";
import type { BacktestRun } from "@/lib/schemas";

/**
 * What the simulation charged and how much of the time it was exposed. A strategy whose edge
 * disappears once fees, slippage and short carry are counted has no edge.
 */
export function RunCosts({ run }: { run: Pick<BacktestRun, "costs" | "exposurePct" | "summary" | "stopPauses"> }) {
  const c = run.costs;
  if (!c && run.exposurePct == null) return null;
  const gross = run.summary.grossProfit;
  const costTotal = (c?.totalFees ?? 0) + (c?.totalSlippage ?? 0);
  const items: Array<{ label: string; value: string; hint?: string }> = [];
  if (c) {
    items.push({ label: "Taxas", value: formatMoney(c.totalFees), hint: `${formatFraction(c.feesPctOfCapital, 2)} do capital` });
    if (c.totalSlippage != null) {
      items.push({
        label: "Slippage",
        value: formatMoney(c.totalSlippage),
        hint: c.slippagePctOfCapital != null ? `${formatFraction(c.slippagePctOfCapital, 2)} do capital` : undefined,
      });
    }
    if (c.totalShortCarry != null && c.totalShortCarry !== 0) {
      const funding = c.shortCarryModel === "funding";
      items.push({
        label: funding ? "Funding do short (histórico real)" : "Custo do short (juros/funding)",
        value: c.totalShortCarry < 0 ? `${formatMoney(-c.totalShortCarry)} de receita` : formatMoney(c.totalShortCarry),
        hint: funding
          ? `Funding pago/recebido a cada 8h, já incluso nas taxas${c.fundingFallbackSymbols?.length ? `; taxa fixa para ${c.fundingFallbackSymbols.join(", ")} (sem histórico)` : ""}`
          : c.shortBorrowPctPerDay != null
            ? `${formatFraction(c.shortBorrowPctPerDay, 3)} ao dia, já incluso nas taxas`
            : "já incluso nas taxas",
      });
    }
    if (c.gappedStops != null && c.gappedStops > 0) {
      items.push({
        label: "Stops com gap",
        value: `${c.gappedStops} · ${formatMoney(c.totalGapCost ?? 0)}`,
        hint: "Candle abriu além do stop: saída na abertura, pior que o stop (já no PnL)",
      });
    }
    if (c.stopSlippagePct != null) {
      items.push({ label: "Slippage do stop", value: formatFraction(c.stopSlippagePct, 3), hint: "Aplicado só nas saídas por stop" });
    }
    if (gross != null && gross > 0 && c.totalSlippage != null) {
      items.push({ label: "Custos / lucro bruto", value: formatFraction(costTotal / gross, 1), hint: "Acima de ~50% o resultado depende demais dos custos" });
    }
  }
  if (run.stopPauses != null && run.stopPauses > 0) {
    items.push({ label: "Pausas por stops seguidos", value: String(run.stopPauses), hint: "Cada uma até o dia seguinte (UTC)" });
  }
  if (run.exposurePct != null) {
    items.push({ label: "Exposição", value: formatFraction(run.exposurePct, 1), hint: "Parte do tempo com posição aberta" });
  }
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
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
