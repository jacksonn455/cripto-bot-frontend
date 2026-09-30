import { CompareView } from "@/components/backtests/compare-view";

export const metadata = { title: "Comparar backtests" };

export default async function Page({ searchParams }: PageProps<"/backtests/compare">) {
  const { a, b } = await searchParams;
  return <CompareView a={typeof a === "string" ? a : undefined} b={typeof b === "string" ? b : undefined} />;
}
