import { TradeDetailView } from "@/components/trades/trade-detail-view";

export const metadata = { title: "Detalhe da trade" };

export default async function Page({ params }: PageProps<"/trades/[id]">) {
  const { id } = await params;
  return <TradeDetailView id={id} />;
}
