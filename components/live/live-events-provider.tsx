"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/query";
import { SSE_EVENT_TYPES, sseEventSchemas, type SseEventType } from "@/lib/schemas";
import type { z } from "zod";

export type LiveStatus = "connecting" | "open" | "reconnecting";

export type LiveEvent = {
  [K in SseEventType]: {
    type: K;
    data: z.infer<(typeof sseEventSchemas)[K]>;
    /** Backend event id (same in the stream and in the history); absent only on old backends. */
    id?: string;
    /** Epoch ms: when it happened (history) or arrived (stream). */
    receivedAt: number;
  };
}[SseEventType];

type Listener = (event: LiveEvent) => void;

interface LiveEventsContextValue {
  status: LiveStatus;
  /** Returns an unsubscribe function. */
  subscribe: (listener: Listener) => () => void;
  /** Newest first, at most MAX_RECENT: the backend history plus what arrived live. */
  recent: LiveEvent[];
  /** Hides everything received so far (the history is not deleted). */
  clearRecent: () => void;
  /** Times the connection had to be re-established. */
  reconnects: number;
  /** False when the backend has no /events/recent (the feed then starts empty). */
  historyAvailable: boolean;
}

const LiveEventsContext = createContext<LiveEventsContextValue | null>(null);

const MAX_BACKOFF_MS = 30_000;
export const MAX_RECENT = 200;

/** Validates a raw payload for a known event type; null when unknown or malformed. */
export function toLiveEvent(type: string, raw: unknown, receivedAt: number, id?: string): LiveEvent | null {
  if (!(SSE_EVENT_TYPES as string[]).includes(type)) return null;
  const parsed = sseEventSchemas[type as SseEventType].safeParse(raw);
  if (!parsed.success) {
    console.error(`[sse] payload inesperado para ${type}`, parsed.error.issues);
    return null;
  }
  return { type, data: parsed.data, receivedAt, id } as LiveEvent;
}

/** Merges by id (newest first), keeping at most MAX_RECENT and dropping anything before `since`. */
export function mergeEvents(current: LiveEvent[], incoming: LiveEvent[], since = 0): LiveEvent[] {
  const seen = new Set<string>();
  return [...incoming, ...current]
    .filter((e) => e.receivedAt > since)
    .filter((e) => {
      if (!e.id) return true;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .slice(0, MAX_RECENT);
}

/**
 * One EventSource for the whole app. Domain events refresh the affected cached queries, so
 * screens update without waiting for their next poll. On every (re)connect the backend history
 * (GET /events/recent) is merged in, so the feed also shows what happened while the panel was
 * closed or the connection was down. The browser only retries on its own after a dropped
 * connection; a failed (re)connect (e.g. proxy 503) closes the source, so reconnection with
 * backoff is handled here.
 */
export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [recent, setRecent] = useState<LiveEvent[]>([]);
  const [reconnects, setReconnects] = useState(0);
  const [historyAvailable, setHistoryAvailable] = useState(true);
  const clearedAt = useRef(0);
  const [clearRecent] = useState(() => () => {
    clearedAt.current = Date.now();
    setRecent([]);
  });
  const listeners = useRef(new Set<Listener>());
  const [subscribe] = useState<LiveEventsContextValue["subscribe"]>(() => (listener: Listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  });

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let disposed = false;
    let hadConnection = false;

    const invalidate = (type: SseEventType) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.botStatus });
      if (type === "signal.recorded") void queryClient.invalidateQueries({ queryKey: ["signals"] });
      if (type === "backtest.completed") void queryClient.invalidateQueries({ queryKey: ["backtest"] });
      if (type === "trade.opened" || type === "trade.closed" || type === "backtest.completed") {
        void queryClient.invalidateQueries({ queryKey: ["trades"] });
        void queryClient.invalidateQueries({ queryKey: ["reports"] });
        void queryClient.invalidateQueries({ queryKey: ["equity"] });
      }
    };

    const loadHistory = async () => {
      try {
        const stored = await api.events.recent({ limit: MAX_RECENT });
        const events = stored
          .map((e) => toLiveEvent(e.type, e.data, Date.parse(e.at), e.id))
          .filter((e): e is LiveEvent => e !== null);
        if (!disposed) setRecent((list) => mergeEvents(list, events, clearedAt.current));
      } catch {
        // Older backend without history, or offline: the live stream still works.
        if (!disposed) setHistoryAvailable(false);
      }
    };

    const connect = () => {
      if (disposed) return;
      source = new EventSource(api.events.streamUrl());
      source.onopen = () => {
        if (hadConnection) setReconnects((n) => n + 1);
        hadConnection = true;
        attempt = 0;
        setStatus("open");
        // Fills whatever happened while disconnected (and the initial history on first connect).
        void loadHistory();
      };
      source.onerror = () => {
        if (!source || source.readyState !== EventSource.CLOSED) {
          setStatus("reconnecting"); // the browser is retrying by itself
          return;
        }
        setStatus("reconnecting");
        source = null;
        const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
        attempt += 1;
        retryTimer = setTimeout(connect, delay);
      };
      for (const type of SSE_EVENT_TYPES) {
        source.addEventListener(type, (message) => {
          const msg = message as MessageEvent<string>;
          let json: unknown;
          try {
            json = JSON.parse(msg.data);
          } catch {
            return;
          }
          const event = toLiveEvent(type, json, Date.now(), msg.lastEventId || undefined);
          if (!event) return;
          invalidate(type);
          if (event.type === "alert.critical") toast.error("Alerta do bot", { description: event.data.message });
          setRecent((list) => mergeEvents(list, [event], clearedAt.current));
          listeners.current.forEach((l) => l(event));
        });
      }
      // `ping` is the backend heartbeat; receiving anything means the stream is healthy.
      source.addEventListener("ping", () => setStatus("open"));
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [queryClient]);

  return (
    <LiveEventsContext.Provider value={{ status, subscribe, recent, clearRecent, reconnects, historyAvailable }}>
      {children}
    </LiveEventsContext.Provider>
  );
}

export function useLiveEvents(): LiveEventsContextValue {
  const value = useContext(LiveEventsContext);
  if (!value) throw new Error("useLiveEvents must be used inside LiveEventsProvider");
  return value;
}
