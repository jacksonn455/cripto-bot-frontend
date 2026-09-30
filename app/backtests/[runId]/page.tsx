import { RunDetailView } from "@/components/backtests/run-detail-view";

export const metadata = { title: "Execução de backtest" };

export default async function Page({ params }: PageProps<"/backtests/[runId]">) {
  const { runId } = await params;
  return <RunDetailView runId={decodeURIComponent(runId)} />;
}
