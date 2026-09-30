/**
 * Bar with a 4px rounded data end and a square baseline end, for positive and negative values
 * in either orientation (Recharts' `radius` is fixed per corner, so negatives would round the
 * baseline side).
 */
export function roundedBarShape(orientation: "vertical" | "horizontal", fill: (value: number, index: number) => string) {
  function RoundedBar(props: unknown) {
    const { x = 0, y = 0, width = 0, height = 0, value, index = 0 } = props as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      value?: number | number[];
      index?: number;
    };
    const v = Array.isArray(value) ? value[1] - value[0] : (value ?? 0);
    const x0 = Math.min(x, x + width);
    const y0 = Math.min(y, y + height);
    const w = Math.abs(width);
    const h = Math.abs(height);
    if (w === 0 || h === 0) return <g />;

    const r = Math.min(4, (orientation === "vertical" ? w : h) / 2, orientation === "vertical" ? h : w);
    let d: string;
    if (orientation === "vertical") {
      // Columns: data end is the top for positive values, the bottom for negative ones.
      d =
        v >= 0
          ? `M${x0},${y0 + h} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + w - r} Q${x0 + w},${y0} ${x0 + w},${y0 + r} V${y0 + h} Z`
          : `M${x0},${y0} V${y0 + h - r} Q${x0},${y0 + h} ${x0 + r},${y0 + h} H${x0 + w - r} Q${x0 + w},${y0 + h} ${x0 + w},${y0 + h - r} V${y0} Z`;
    } else {
      // Rows: data end is the right for positive values, the left for negative ones.
      d =
        v >= 0
          ? `M${x0},${y0} H${x0 + w - r} Q${x0 + w},${y0} ${x0 + w},${y0 + r} V${y0 + h - r} Q${x0 + w},${y0 + h} ${x0 + w - r},${y0 + h} H${x0} Z`
          : `M${x0 + w},${y0} H${x0 + r} Q${x0},${y0} ${x0},${y0 + r} V${y0 + h - r} Q${x0},${y0 + h} ${x0 + r},${y0 + h} H${x0 + w} Z`;
    }
    return <path d={d} fill={fill(v, index)} />;
  }
  return RoundedBar;
}
