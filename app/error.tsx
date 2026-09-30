"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/states/error-state";

/** Route-level boundary: a render error in one screen keeps header, nav and footer usable. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState error={error} onRetry={reset} className="mt-8" />;
}
