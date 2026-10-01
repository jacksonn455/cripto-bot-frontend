"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";

interface Props {
  page: number;
  limit: number;
  total: number;
  pageSizes: readonly number[];
  onChange: (patch: { page?: number; limit?: number }) => void;
  busy?: boolean;
  /** Prefix for the page-size control id, so two paginations can share a page. */
  id?: string;
}

export function Pagination({ page, limit, total, pageSizes, onChange, busy, id = "page" }: Props) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground" aria-live="polite">
        {formatNumber(first, 0)}–{formatNumber(last, 0)} de {formatNumber(total, 0)}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-size`} className="text-xs text-muted-foreground">Por página</Label>
          <Select value={String(limit)} onValueChange={(v) => onChange({ limit: Number(v), page: 1 })}>
            <SelectTrigger id={`${id}-size`} size="sm" className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground">Página {page} de {pages}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => onChange({ page: page - 1 })} disabled={page <= 1 || busy} aria-label="Página anterior">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => onChange({ page: page + 1 })} disabled={page >= pages || busy} aria-label="Próxima página">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </nav>
  );
}
