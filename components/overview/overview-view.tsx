"use client";

import { SeedNotice } from "@/components/data/seed-notice";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/states/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBotStatus } from "@/hooks/use-bot-status";
import { useDataMode } from "@/hooks/use-data-mode";
import { BotStatusPanel } from "./bot-status-panel";
import { EquitySection } from "./equity-section";
import { LastSignals } from "./last-signals";
import { OpenPositions } from "./open-positions";
import { OverviewCards } from "./overview-cards";

export function OverviewView() {
  const { mode } = useDataMode();
  const status = useBotStatus();

  return (
    <>
      <PageHeader title="Visão geral" description="Mercado, operações e desempenho do Krypto em um só lugar." />
      <div className="space-y-6">
        <SeedNotice mode={mode} />
        <OverviewCards mode={mode} status={status.data} />

        <div className="grid gap-6 xl:grid-cols-2">
          {status.data ? (
            <>
              <BotStatusPanel status={status.data} />
              <LastSignals status={status.data} />
            </>
          ) : status.isError ? (
            <ErrorState
              className="xl:col-span-2"
              error={status.error}
              onRetry={() => void status.refetch()}
              retrying={status.isFetching}
            />
          ) : (
            <>
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </>
          )}
        </div>

        <EquitySection mode={mode} />
        <OpenPositions mode={mode} />
      </div>
    </>
  );
}
