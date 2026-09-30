import { Suspense } from "react";
import { TradesView } from "@/components/trades/trades-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Trades" };

export default function Page() {
  // useSearchParams (filters in the URL) needs a Suspense boundary.
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TradesView />
    </Suspense>
  );
}
