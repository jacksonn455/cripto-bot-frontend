"use client";

import Link from "next/link";
import { LineChart } from "lucide-react";
import { useState } from "react";
import { EquityChart } from "@/components/charts/equity-chart";
import { ModeBadge } from "@/components/mode/mode-badge";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEquityCurve } from "@/hooks/use-data";
import type { Mode } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "all", label: "Tudo", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function rangeFrom(key: RangeKey): string | undefined {
  const days = RANGES.find((r) => r.key === key)?.days;
  if (!days) return undefined;
  // Rounded to the minute so the query key (and backend cache key) is stable between polls.
  const ms = Math.floor((Date.now() - days * 86_400_000) / 60_000) * 60_000;
  return new Date(ms).toISOString();
}

export function EquitySection({ mode }: { mode: Mode }) {
  const [range, setRange] = useState<RangeKey>("30d");
  const isBacktest = mode === "BACKTEST";
  const curve = useEquityCurve({ mode, from: rangeFrom(range) }, { enabled: !isBacktest });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Curva de capital <ModeBadge mode={mode} />
        </CardTitle>
        <CardDescription>Equity = caixa em USDT + posições abertas pelo último preço. Um ponto a cada 5 min.</CardDescription>
        {!isBacktest && (
          <CardAction>
            <div role="group" aria-label="Período" className="flex rounded-lg border p-0.5">
              {RANGES.map((r) => (
                <Button
                  key={r.key}
                  size="xs"
                  variant="ghost"
                  aria-pressed={range === r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(range === r.key && "bg-accent text-accent-foreground")}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isBacktest ? (
          <EmptyState
            icon={LineChart}
            title="A curva de backtest é por execução"
            description="Juntar execuções diferentes numa curva só não faz sentido. Abra uma execução para ver a curva dela."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/backtests">Ver backtests</Link>
              </Button>
            }
          />
        ) : (
          <QueryState
            query={curve}
            loading={<Skeleton className="h-90 w-full" />}
            isEmpty={(d) => d.length < 2}
            empty={
              <EmptyState
                icon={LineChart}
                title={curve.data?.length === 1 ? "Coletando pontos…" : `Ainda não há histórico de equity em ${mode}`}
                description={
                  <>
                    O backend grava um ponto a cada 5 min enquanto o loop de execução está ligado
                    (EXECUTION_ENABLED=true) e o Krypto roda em {mode}.
                    {range !== "all" && " Tente também o período “Tudo”."}
                  </>
                }
              />
            }
          >
            {(data) => <EquityChart series={data} label={`Curva de capital ${mode}`} />}
          </QueryState>
        )}
      </CardContent>
    </Card>
  );
}
