import { PboView } from "@/components/backtests/pbo-view";

export const metadata = { title: "Risco de overfitting" };

export default async function Page({ searchParams }: PageProps<"/backtests/pbo">) {
  const { runs } = await searchParams;
  const ids = typeof runs === "string" ? runs.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return <PboView runIds={ids} />;
}
