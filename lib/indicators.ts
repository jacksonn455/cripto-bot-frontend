/**
 * EMA for display only, matching the backend's `technicalindicators` EMA: seeded with the SMA of
 * the first `period` values, then k = 2 / (period + 1). Aligned to the input: the first
 * `period − 1` entries are undefined. Nothing here feeds a trading decision.
 */
export function ema(period: number, values: number[]): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(values.length).fill(undefined);
  if (period < 1 || values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (values[i] - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}
