"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { ModeBadge } from "@/components/mode/mode-badge";
import { useBotStatus } from "@/hooks/use-bot-status";
import { useDataMode } from "@/hooks/use-data-mode";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Set false on screens whose data isn't tied to a mode (e.g. funding). */
  showDataMode?: boolean;
}

export function PageHeader({ title, description, actions, showDataMode = true }: PageHeaderProps) {
  const { mode } = useDataMode();
  const { data: status } = useBotStatus();
  const mismatch = showDataMode && status && status.mode !== mode;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {title}
            {showDataMode && <ModeBadge mode={mode} size="md" />}
          </h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {mismatch && (
        <p className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <Info className="size-4 shrink-0 text-warning" aria-hidden />
          <span>
            Exibindo dados de <strong>{mode}</strong>. O bot está rodando em <strong>{status.mode}</strong>.
          </span>
        </p>
      )}
    </div>
  );
}
