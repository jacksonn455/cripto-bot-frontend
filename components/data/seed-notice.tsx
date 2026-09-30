"use client";

import { FlaskConical } from "lucide-react";
import { useTrades } from "@/hooks/use-data";
import type { Mode } from "@/lib/schemas";
import { SeedBadge } from "./seed-badge";

/** Warns when the metrics of a mode include trades created by the backend seed script. */
export function SeedNotice({ mode }: { mode: Mode }) {
  const seed = useTrades({ mode, isSeed: true, limit: 1 });
  const count = seed.data?.total ?? 0;
  if (count === 0) return null;

  return (
    <p className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-warning/60 bg-warning/10 px-3 py-2 text-sm">
      <FlaskConical className="size-4 shrink-0 text-warning" aria-hidden />
      <span>
        <strong>{count}</strong> trade(s) em {mode} são dados fictícios do seed (marcadas <SeedBadge />) e entram nas
        métricas abaixo. Para removê-las: <code className="text-xs">pnpm seed -- --reset</code> no backend.
      </span>
    </p>
  );
}
