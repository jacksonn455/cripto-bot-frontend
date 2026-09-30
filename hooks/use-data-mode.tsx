"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { MODE_COOKIE } from "@/lib/mode";
import type { Mode } from "@/lib/schemas/common";

interface DataModeContextValue {
  /** Which mode's data the screens show. Independent from the mode the bot is running in. */
  mode: Mode;
  setMode: (mode: Mode) => void;
}

const DataModeContext = createContext<DataModeContextValue | null>(null);

export function DataModeProvider({ initialMode, children }: { initialMode: Mode; children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(initialMode);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    // Cookie (not localStorage) so the server renders the same mode on the next load.
    document.cookie = `${MODE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
}

export function useDataMode(): DataModeContextValue {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error("useDataMode must be used inside DataModeProvider");
  return ctx;
}
