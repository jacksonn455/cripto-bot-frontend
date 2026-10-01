import { PageHeader } from "@/components/layout/page-header";
import { WorkerStatusCard } from "@/components/overview/worker-status";
import { LiveFeed } from "@/components/signals/live-feed";
import { SignalsList } from "@/components/signals/signals-list";
import { WhyNoTrades } from "@/components/signals/why-no-trades";

export const metadata = { title: "Sinais e eventos" };

export default function Page() {
  return (
    <>
      <PageHeader title="Sinais e eventos" description="O que o Krypto está fazendo agora e as decisões do gerenciador de risco." />
      <div className="space-y-6">
        <WorkerStatusCard />
        <WhyNoTrades />
        <LiveFeed />
        <SignalsList />
      </div>
    </>
  );
}
