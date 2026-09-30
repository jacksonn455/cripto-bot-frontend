"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "./error-state";

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  /** Rendered while there is no data yet. */
  loading?: ReactNode;
  /** When true for the loaded data, `empty` is rendered instead of children. */
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

/**
 * Standard loading → error (with retry) → empty → data rendering for a query. Keeps showing
 * the last good data if a background refetch fails, so a blip doesn't blank the screen.
 */
export function QueryState<T>({ query, loading, isEmpty, empty, children }: QueryStateProps<T>) {
  if (query.data === undefined) {
    if (query.isError) {
      return <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
    }
    return <>{loading ?? <Skeleton className="h-32 w-full" />}</>;
  }
  if (isEmpty?.(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
