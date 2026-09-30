export interface EquityPoint {
  /** Epoch ms. */
  t: number;
  equity: number;
  /** Fraction ≤ 0 from the running peak (−0.05 = 5% below the peak). */
  drawdown: number;
}

/** Adds running-peak drawdown to an equity series (expects ascending time). */
export function withDrawdown(series: Array<{ timestamp: string; equity: number }>): EquityPoint[] {
  let peak = -Infinity;
  return series.map(({ timestamp, equity }) => {
    peak = Math.max(peak, equity);
    return { t: new Date(timestamp).getTime(), equity, drawdown: peak > 0 ? equity / peak - 1 : 0 };
  });
}

/**
 * Reduces a long series for display. Each bucket keeps its deepest-drawdown point and its last
 * point (in time order), so the worst dip and the final value are never smoothed away.
 */
export function downsample(points: EquityPoint[], maxBuckets = 400): EquityPoint[] {
  if (points.length <= maxBuckets * 2) return points;
  const size = Math.ceil(points.length / maxBuckets);
  const out: EquityPoint[] = [];
  for (let i = 0; i < points.length; i += size) {
    const bucket = points.slice(i, i + size);
    const last = bucket[bucket.length - 1];
    const worst = bucket.reduce((a, b) => (b.drawdown < a.drawdown ? b : a));
    if (worst !== last) out.push(worst);
    out.push(last);
  }
  return out;
}

export interface EquityStats {
  first: EquityPoint;
  last: EquityPoint;
  max: EquityPoint;
  min: EquityPoint;
  worstDrawdown: EquityPoint;
}

export function equityStats(points: EquityPoint[]): EquityStats | null {
  if (points.length === 0) return null;
  const pick = (better: (a: EquityPoint, b: EquityPoint) => boolean) =>
    points.reduce((acc, p) => (better(p, acc) ? p : acc));
  return {
    first: points[0],
    last: points[points.length - 1],
    max: pick((a, b) => a.equity > b.equity),
    min: pick((a, b) => a.equity < b.equity),
    worstDrawdown: pick((a, b) => a.drawdown < b.drawdown),
  };
}
