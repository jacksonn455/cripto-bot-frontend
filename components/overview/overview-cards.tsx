"use client";

import { Pnl } from "@/components/data/pnl";
import { StatCard } from "@/components/data/stat-card";
import { describeError } from "@/components/states/error-state";
import { useEquityCurve, useSummary, useTrades } from "@/hooks/use-data";
import { useNow } from "@/hooks/use-now";
import { formatFraction, formatMoney, formatNumber, formatRelative, MINUS } from "@/lib/format";
import { POLL_MS } from "@/lib/query";
import type { BotStatus, Mode } from "@/lib/schemas";
import { startOfLocalDay } from "@/lib/positions";

const errorText = (e: unknown) => describeError(e).title;

export function OverviewCards({ mode, status }: { mode: Mode; status: BotStatus | undefined }) {
  const now = useNow(60_000);
  const isBacktest = mode === "BACKTEST";
  // Recomputed each minute so "today" rolls over at local midnight without a reload.
  const todayIso = startOfLocalDay(new Date(now)).toISOString();

  const total = useSummary({ mode });
  const today = useSummary({ mode, from: todayIso, dateField: "exitTime" }, { enabled: !isBacktest });
  const open = useTrades({ mode, status: "OPEN", limit: 1 }, { refetchInterval: POLL_MS.openPositions });
  // Only the latest point is needed; a 24h window keeps the payload small as history grows.
  const dayAgoIso = new Date(Math.floor((now - 86_400_000) / 60_000) * 60_000).toISOString();
  const curve = useEquityCurve({ mode, from: dayAgoIso }, { enabled: !isBacktest });

  const lastSnapshot = curve.data?.[curve.data.length - 1];
  const s = total.data;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      {isBacktest ? (
        <StatCard label="Equity" value="—" hint="Em backtest a equity é por execução (tela Backtests)." />
      ) : lastSnapshot ? (
        <StatCard
          label="Equity"
          value={formatMoney(lastSnapshot.equity)}
          hint={`Caixa + posições · ${formatRelative(lastSnapshot.timestamp, now)}`}
        />
      ) : status && status.mode === mode ? (
        <StatCard
          label="Saldo livre (USDT)"
          value={formatMoney(status.equity)}
          hint="Sem histórico de equity ainda; só o caixa livre."
          loading={curve.isPending}
        />
      ) : (
        <StatCard label="Equity" value="—" hint={`Sem registros de equity em ${mode}.`} loading={curve.isPending} error={curve.isError ? errorText(curve.error) : undefined} />
      )}

      {isBacktest ? (
        <StatCard label="PnL do dia" value="—" hint="Não se aplica a backtest." />
      ) : (
        <StatCard
          label="PnL do dia"
          value={<Pnl value={today.data?.totalPnl} />}
          hint={today.data && `${today.data.tradeCount} trade(s) fechada(s) desde 00:00 (hora local)`}
          loading={today.isPending}
          error={today.isError ? errorText(today.error) : undefined}
        />
      )}

      <StatCard
        label="PnL total"
        value={<Pnl value={s?.totalPnl} />}
        hint={s && `${formatNumber(s.tradeCount, 0)} trade(s) fechada(s)`}
        loading={total.isPending}
        error={total.isError ? errorText(total.error) : undefined}
      />

      <StatCard
        label="Posições abertas"
        value={open.data ? formatNumber(open.data.total, 0) : "—"}
        hint={isBacktest ? "Backtests terminam com as posições fechadas." : "Atualizado a cada 10 s"}
        loading={open.isPending}
        error={open.isError ? errorText(open.error) : undefined}
      />

      <StatCard
        label="Win rate"
        value={s && s.tradeCount > 0 ? formatFraction(s.winRate, 1) : "—"}
        hint={s && (s.tradeCount > 0 ? `${s.winCount} ganho(s) · ${s.lossCount} perda(s)` : "Sem trades fechadas")}
        loading={total.isPending}
        error={total.isError ? errorText(total.error) : undefined}
      />

      <StatCard
        label="Max drawdown"
        value={
          s && s.maxDrawdown > 0 ? (
            <span className="text-loss">{`${MINUS}${formatMoney(s.maxDrawdown)}`}</span>
          ) : (
            "—"
          )
        }
        hint="Sobre o PnL acumulado das trades fechadas"
        loading={total.isPending}
        error={total.isError ? errorText(total.error) : undefined}
      />
    </div>
  );
}
