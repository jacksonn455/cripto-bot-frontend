/**
 * Plain-language reading of perpetual funding rates. Display only: the bot trades spot and never
 * pays or receives funding; this is market context.
 */

/** Binance's default rate when the market is balanced: 0.01% per 8h ≈ 10.95% a year. */
export const BASELINE_ANNUALIZED_PCT = 0.0001 * 3 * 365 * 100;
/** Above this (in magnitude) a rate is clearly above normal. */
export const ELEVATED_ANNUALIZED_PCT = 20;
export const EXTREME_ANNUALIZED_PCT = 50;

export type Payer = "longs" | "shorts" | "none";
export type Intensity = "zero" | "normal" | "elevated" | "extreme";

export const PAYER_LABEL: Record<Payer, string> = {
  longs: "Comprados pagam",
  shorts: "Vendidos pagam",
  none: "Ninguém paga",
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  zero: "Zerada",
  normal: "Normal",
  elevated: "Elevada",
  extreme: "Extrema",
};

export const INTENSITY_HINT: Record<Intensity, string> = {
  zero: "Sem cobrança nesta liquidação. Comum em contratos novos ou pouco negociados.",
  normal: "Perto da taxa padrão da Binance (0,01% a cada 8 h). Mercado equilibrado.",
  elevated: `Acima de ${ELEVATED_ANNUALIZED_PCT}% ao ano: um dos lados está pagando caro para manter a posição.`,
  extreme: `Acima de ${EXTREME_ANNUALIZED_PCT}% ao ano: muita alavancagem de um lado só. Costuma anteceder movimentos bruscos.`,
};

export function interpretRate(rate: number, annualizedPct: number): { payer: Payer; intensity: Intensity } {
  const payer: Payer = rate > 0 ? "longs" : rate < 0 ? "shorts" : "none";
  const abs = Math.abs(annualizedPct);
  const intensity: Intensity =
    rate === 0 ? "zero" : abs >= EXTREME_ANNUALIZED_PCT ? "extreme" : abs >= ELEVATED_ANNUALIZED_PCT ? "elevated" : "normal";
  return { payer, intensity };
}

export interface MarketMood {
  title: string;
  detail: string;
  tone: "neutral" | "warning";
}

/** One-sentence reading of the whole scan, from its median annualized rate. */
export function marketMood(medianAnnualizedPct: number): MarketMood {
  if (medianAnnualizedPct < 0) {
    return {
      title: "Mercado pessimista",
      detail: "Na maioria dos contratos, quem está vendido paga para manter a posição: mais gente apostando na queda.",
      tone: "warning",
    };
  }
  if (medianAnnualizedPct <= BASELINE_ANNUALIZED_PCT + 1) {
    return {
      title: "Mercado equilibrado",
      detail: "A maioria dos contratos paga a taxa padrão ou menos. Não há excesso de alavancagem de um lado só.",
      tone: "neutral",
    };
  }
  if (medianAnnualizedPct < 30) {
    return {
      title: "Otimismo acima do normal",
      detail: "Quem está comprado paga mais que o padrão para manter a posição: apetite por alta com alavancagem.",
      tone: "warning",
    };
  }
  return {
    title: "Euforia com muita alavancagem comprada",
    detail: "Taxas altas na maioria dos contratos. Quedas rápidas podem forçar liquidações em cadeia.",
    tone: "warning",
  };
}

/** The scanner runs hourly; older than this means it probably stopped. */
export const STALE_SCAN_MS = 2 * 3_600_000;
