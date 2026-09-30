import { formatSignedMoney, formatSignedPercent, toneOf } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE_CLASS = { profit: "text-profit", loss: "text-loss", neutral: "text-muted-foreground" } as const;

/** Signed, colored PnL. The +/− sign always carries the meaning; color only reinforces it. */
export function Pnl({
  value,
  percent,
  className,
}: {
  value: number | null | undefined;
  /** Already in percent (2.5 = 2,5%). */
  percent?: number | null;
  className?: string;
}) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("tabular-nums", TONE_CLASS[toneOf(value)], className)}>
      {formatSignedMoney(value)}
      {percent !== undefined && percent !== null && <span className="ml-1 text-xs">({formatSignedPercent(percent)})</span>}
    </span>
  );
}

export function PnlPercent({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("tabular-nums", TONE_CLASS[toneOf(value)], className)}>{formatSignedPercent(value)}</span>;
}
