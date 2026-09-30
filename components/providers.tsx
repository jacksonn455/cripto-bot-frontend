"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { LiveEventsProvider } from "@/components/live/live-events-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataModeProvider } from "@/hooks/use-data-mode";
import { makeQueryClient } from "@/lib/query";
import type { Mode } from "@/lib/schemas/common";

export function Providers({ initialMode, children }: { initialMode: Mode; children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <DataModeProvider initialMode={initialMode}>
          <LiveEventsProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster richColors closeButton position="top-right" />
            </TooltipProvider>
          </LiveEventsProvider>
        </DataModeProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
