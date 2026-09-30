"use client";

import { useEffect, useState } from "react";

/** Current time, re-rendering every `intervalMs`, for "há 2 min" labels and staleness checks. */
export function useNow(intervalMs = 10_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
