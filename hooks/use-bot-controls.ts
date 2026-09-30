"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/query";

/** pause / resume / kill-switch. Every success refreshes the bot status and anything trade-derived. */
export function useBotControls() {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.botStatus }),
      queryClient.invalidateQueries({ queryKey: ["trades"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
      queryClient.invalidateQueries({ queryKey: ["equity"] }),
    ]);
  };

  return {
    pause: useMutation({ mutationFn: (reason?: string) => api.bot.pause(reason), onSettled: refresh }),
    resume: useMutation({ mutationFn: () => api.bot.resume(), onSettled: refresh }),
    killSwitch: useMutation({ mutationFn: () => api.bot.killSwitch(), onSettled: refresh }),
  };
}
