import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** From this many variations on, the best result is increasingly likely to be luck. */
const HIGH_RISK = 10;

/**
 * Overfitting warning: how many distinct parameter combinations were already backtested for the
 * strategy (from the backend's params hash). Picking the best of many tries on the same history
 * tends to select noise, not edge.
 */
export function OverfittingNotice({ strategy, variations, className }: { strategy: string; variations: number; className?: string }) {
  const high = variations >= HIGH_RISK;
  const Icon = variations > 1 ? AlertTriangle : Info;
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        variations > 1 ? "border-warning/50 bg-warning/10" : "bg-muted/40",
        high && "border-loss/50 bg-loss/10",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", high ? "text-loss" : variations > 1 ? "text-warning" : "text-muted-foreground")} aria-hidden />
      <p>
        <strong>
          {variations} {variations === 1 ? "combinação de parâmetros testada" : "combinações de parâmetros testadas"}
        </strong>{" "}
        para {strategy}.{" "}
        {variations <= 1
          ? "Cada variação nova que você testar aumenta o risco de overfitting."
          : high
            ? "Risco alto de overfitting: com tantas tentativas no mesmo histórico, o melhor resultado provavelmente reflete ruído. Valide em paper e em período fora da amostra (walk-forward)."
            : "Quanto mais variações você testa no mesmo histórico, maior a chance de o melhor resultado ser sorte. Confirme em paper e com walk-forward."}
      </p>
    </div>
  );
}
