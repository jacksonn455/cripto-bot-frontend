import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Context line: period, count, freshness. */
  hint?: ReactNode;
  loading?: boolean;
  /** Replaces value/hint with a short error line. */
  error?: string;
  className?: string;
}

export function StatCard({ label, value, hint, loading, error, className }: StatCardProps) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="space-y-1 px-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3.5 w-20" />
          </>
        ) : error ? (
          <p className="text-sm text-loss">{error}</p>
        ) : (
          <>
            <div className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</div>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
