"use client";

import { AlertTriangle, Eye, Gauge, HelpCircle, Percent, Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { QueryState } from "@/components/states/query-state";
import { Pagination } from "@/components/trades/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFundingRanking, useStrategies } from "@/hooks/use-data";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatDuration, formatNumber, formatRelative, formatSignedPercent } from "@/lib/format";
import {
  BASELINE_ANNUALIZED_PCT,
  INTENSITY_HINT,
  INTENSITY_LABEL,
  interpretRate,
  marketMood,
  PAYER_LABEL,
  STALE_SCAN_MS,
  type Intensity,
} from "@/lib/funding";
import type { FundingOrder, FundingPage, FundingRankingItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const ORDERS: Array<{ key: FundingOrder; label: string }> = [
  { key: "desc", label: "Maiores" },
  { key: "asc", label: "Menores (negativas)" },
  { key: "abs", label: "Maior magnitude" },
];
const PAGE_SIZES = [25, 50, 100] as const;

const INTENSITY_CLASS: Record<Intensity, string> = {
  zero: "border-border text-muted-foreground",
  normal: "border-border text-foreground",
  elevated: "border-warning/60 text-warning",
  extreme: "border-mode-live/60 bg-mode-live/10 text-mode-live font-semibold",
};

function IntensityChip({ intensity }: { intensity: Intensity }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("inline-flex cursor-help rounded-md border px-1.5 py-0.5 text-xs whitespace-nowrap", INTENSITY_CLASS[intensity])}>
          {INTENSITY_LABEL[intensity]}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{INTENSITY_HINT[intensity]}</TooltipContent>
    </Tooltip>
  );
}

function NextFunding({ at, now }: { at: string; now: number }) {
  const ms = Date.parse(at) - now;
  return <span title={formatDateTime(at)}>{ms > 0 ? `em ${formatDuration(ms)}` : formatDateTime(at)}</span>;
}

// ---------------------------------------------------------------------------------------------

function Explainer() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="size-4" aria-hidden /> O que é funding e para que serve esta tela
        </CardTitle>
        <CardDescription className="flex items-start gap-2 pt-1">
          <Eye className="mt-0.5 size-4 shrink-0 text-mode-paper" aria-hidden />
          <span>
            <strong className="text-foreground">Somente leitura.</strong> O Krypto opera no mercado à vista (spot) e não paga
            nem recebe funding. Nada aqui gera ordens: é um termômetro do mercado.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-3">
        <section className="space-y-1">
          <h3 className="font-medium">O que é</h3>
          <p className="text-muted-foreground">
            Nos contratos futuros “perpétuos” não há data de vencimento. Para o preço deles não se afastar do preço à vista,
            a cada 8 horas quem está comprado e quem está vendido trocam uma pequena taxa: o <em>funding</em>.
          </p>
        </section>
        <section className="space-y-1">
          <h3 className="font-medium">Como ler</h3>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Positiva:</strong> comprados pagam vendidos (mais gente apostando na alta).{" "}
            <strong className="text-foreground">Negativa:</strong> vendidos pagam comprados (mais gente apostando na queda).
            A taxa padrão da Binance, com o mercado equilibrado, é 0,01% a cada 8 h, cerca de{" "}
            {formatNumber(BASELINE_ANNUALIZED_PCT, 0)}% ao ano.
          </p>
        </section>
        <section className="space-y-1">
          <h3 className="font-medium">Para que serve aqui</h3>
          <p className="text-muted-foreground">
            Taxas muito altas mostram excesso de alavancagem de um lado, o que costuma vir antes de movimentos bruscos
            (liquidações em cadeia). É contexto para entender o momento do mercado, não um sinal de compra ou venda.
          </p>
        </section>
        <details className="text-muted-foreground md:col-span-3">
          <summary className="cursor-pointer hover:text-foreground">Saiba mais: dá para ganhar com funding?</summary>
          <p className="mt-2 max-w-prose">
            Existe a estratégia de “cash and carry”: comprar à vista e vender o perpétuo na mesma quantidade, recebendo o
            funding enquanto ele for positivo. Ela tem riscos reais (a taxa muda a cada 8 h e pode virar negativa, exige
            margem nos futuros, custos de entrada e saída, risco de liquidação da ponta vendida) e este projeto não a executa.
            A taxa anualizada da tabela supõe a taxa atual constante por um ano, o que quase nunca acontece.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Thermometer({ data, botSymbols, now }: { data: FundingPage; botSymbols: string[]; now: number }) {
  const { stats } = data;
  if (!stats || !data.scannedAt) return null;
  const mood = marketMood(stats.medianAnnualizedPct);
  const stale = now - Date.parse(data.scannedAt) > STALE_SCAN_MS;
  const missing = botSymbols.filter((s) => !data.watch.some((w) => w.symbol === s));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4" aria-hidden /> Termômetro do mercado
        </CardTitle>
        <CardDescription>
          Resumo de todos os {formatNumber(stats.count, 0)} contratos do último scan ({formatRelative(data.scannedAt, now)},{" "}
          {formatDateTime(data.scannedAt)}). O backend atualiza de hora em hora.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stale && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            O último scan tem mais de 2 horas. O scanner pode estar desligado (FUNDING_SCAN_ENABLED) ou sem acesso à Binance.
          </p>
        )}
        <div className={cn("rounded-lg border px-4 py-3", mood.tone === "warning" && "border-warning/50 bg-warning/10")}>
          <p className="font-medium">{mood.title}</p>
          <p className="text-sm text-muted-foreground">
            {mood.detail} Taxa mediana: {formatSignedPercent(stats.medianAnnualizedPct, 1)} ao ano (padrão ≈{" "}
            {formatNumber(BASELINE_ANNUALIZED_PCT, 0)}%).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Comprados pagam" value={formatNumber(stats.positive, 0)} hint={`de ${formatNumber(stats.count, 0)} contratos`} />
          <StatTile label="Vendidos pagam" value={formatNumber(stats.negative, 0)} hint="taxa negativa" />
          <StatTile label="Taxa zerada" value={formatNumber(stats.zero, 0)} hint="comum em contratos novos ou pouco negociados" />
          <StatTile
            label={`Extremas (≥ ${stats.extremeThresholdPct}% a.a.)`}
            value={formatNumber(stats.extremeCount, 0)}
            hint="alavancagem concentrada de um lado"
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Moedas que o Krypto opera</h3>
          <p className="text-xs text-muted-foreground">
            O funding delas não afeta as trades do Krypto (ele opera à vista), mas mostra como o mercado de futuros está
            posicionado nessas moedas.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {data.watch.map((w) => {
              const { payer, intensity } = interpretRate(w.rate, w.annualizedRatePct);
              return (
                <div key={w.symbol} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <p className="font-semibold">{w.symbol}</p>
                    <p className="text-xs text-muted-foreground">
                      {PAYER_LABEL[payer]} · próximo pagamento <NextFunding at={w.nextFundingTime} now={now} />
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatSignedPercent(w.annualizedRatePct, 2)} a.a.</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatSignedPercent(w.rate * 100, 4)} a cada 8 h · <IntensityChip intensity={intensity} />
                    </p>
                  </div>
                </div>
              );
            })}
            {missing.map((s) => (
              <p key={s} className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {s}: sem contrato perpétuo com esse nome no último scan.
              </p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RankingTable({ items, offset, botSymbols, now }: { items: FundingRankingItem[]; offset: number; botSymbols: string[]; now: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-right">#</TableHead>
            <TableHead>Contrato</TableHead>
            <TableHead className="text-right">Taxa a cada 8 h</TableHead>
            <TableHead className="text-right">Anualizada</TableHead>
            <TableHead>Quem paga</TableHead>
            <TableHead>Intensidade</TableHead>
            <TableHead className="text-right">Próximo pagamento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r, i) => {
            const { payer, intensity } = interpretRate(r.rate, r.annualizedRatePct);
            return (
              <TableRow key={r.symbol}>
                <TableCell className="text-right text-muted-foreground tabular-nums">{offset + i + 1}</TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {r.symbol}
                    {botSymbols.includes(r.symbol) && (
                      <span className="rounded border border-mode-paper/50 px-1 text-[0.65rem] font-semibold text-mode-paper">moeda do Krypto</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatSignedPercent(r.rate * 100, 4)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatSignedPercent(r.annualizedRatePct, 2)}</TableCell>
                <TableCell className="whitespace-nowrap">{PAYER_LABEL[payer]}</TableCell>
                <TableCell><IntensityChip intensity={intensity} /></TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  <NextFunding at={r.nextFundingTime} now={now} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function FundingView() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<FundingOrder>("desc");
  const [paging, setPaging] = useState<{ page: number; limit: number }>({ page: 1, limit: 25 });
  const now = useNow(30_000);
  const strategies = useStrategies();
  const botSymbols = strategies.data?.live.symbols ?? [];

  const cleaned = draft.replace(/[^a-z0-9]/gi, "").slice(0, 20);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(cleaned);
      setPaging((p) => (p.page === 1 ? p : { ...p, page: 1 }));
    }, 350);
    return () => clearTimeout(t);
  }, [cleaned]);

  const ranking = useFundingRanking({ ...paging, order, search: search || undefined });

  return (
    <>
      <PageHeader title="Funding" showDataMode={false} description="Taxas de funding dos contratos perpétuos da Binance, do último scan do backend." />
      <div className="space-y-6">
        <Explainer />

        {ranking.data && <Thermometer data={ranking.data} botSymbols={botSymbols} now={now} />}

        <Card>
          <CardHeader>
            <CardTitle>Ranking de contratos</CardTitle>
            <CardDescription>Todos os contratos do último scan. Busque pelo nome ou mude a ordem para ver as taxas negativas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtros de funding">
              <div className="w-48 space-y-1.5">
                <Label htmlFor="fd-search" className="text-xs">Buscar contrato</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input id="fd-search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="BTC, DOGE…" className="h-8 pl-7 uppercase placeholder:normal-case" autoComplete="off" />
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="block text-xs font-medium" id="fd-order-label">Ordenar por</span>
                <div role="group" aria-labelledby="fd-order-label" className="flex flex-wrap rounded-lg border p-0.5">
                  {ORDERS.map((o) => (
                    <Button
                      key={o.key}
                      size="xs"
                      variant="ghost"
                      aria-pressed={order === o.key}
                      onClick={() => {
                        setOrder(o.key);
                        setPaging((p) => ({ ...p, page: 1 }));
                      }}
                      className={cn(order === o.key && "bg-accent text-accent-foreground")}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <QueryState
              query={ranking}
              loading={<Skeleton className="h-96 w-full" />}
              isEmpty={(d) => d.items.length === 0}
              empty={
                <EmptyState
                  icon={Percent}
                  title={search ? `Nenhum contrato com “${search.toUpperCase()}”` : "Sem dados de funding"}
                  description={search ? "Tente outro trecho do nome." : "O scanner de funding ainda não rodou ou está desligado (FUNDING_SCAN_ENABLED=false)."}
                />
              }
            >
              {(data) => (
                <div className={cn("space-y-3 transition-opacity", ranking.isPlaceholderData && "opacity-60")}>
                  <RankingTable items={data.items} offset={(data.page - 1) * data.limit} botSymbols={botSymbols} now={now} />
                  <Pagination
                    page={data.page}
                    limit={data.limit}
                    total={data.total}
                    pageSizes={PAGE_SIZES}
                    onChange={(p) => setPaging((cur) => ({ ...cur, ...p }))}
                    busy={ranking.isPlaceholderData}
                  />
                </div>
              )}
            </QueryState>
            <p className="text-xs text-muted-foreground">
              Anualizada = taxa × 3 pagamentos por dia × 365, sem juros compostos. É só uma referência: a taxa muda a cada
              pagamento.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
