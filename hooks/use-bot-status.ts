"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/endpoints";
import { POLL_MS, queryKeys } from "@/lib/query";

export function useBotStatus() {
  return useQuery({
    queryKey: queryKeys.botStatus,
    queryFn: ({ signal }) => api.bot.status(signal),
    refetchInterval: POLL_MS.botStatus,
  });
}
