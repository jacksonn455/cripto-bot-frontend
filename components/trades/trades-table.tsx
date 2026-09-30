"use client";

import {
  createColumnHelper,
  flexRender,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Pnl, PnlPercent } from "@/components/data/pnl";
import { SeedBadge } from "@/components/data/seed-badge";
import { ModeBadge } from "@/components/mode/mode-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { TRADE_SORT_FIELDS, type Trade } from "@/lib/schemas";
import { exitReasonLabel, priceDigits, tradeDurationMs } from "@/lib/trades";
import { cn } from "@/lib/utils";

type SortField = (typeof TRADE_SORT_FIELDS)[number];

// TanStack Table v9: features are declared once, statically, and typed into the column helper.
const features = tableFeatures({ rowSortingFeature });
const col = createColumnHelper<typeof features, Trade>();

function PriceAt({ price, at }: { price: number | null | undefined; at: string | null | undefined }) {
  if (price == null) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="text-right">
      <div className="tabular-nums">{formatNumber(price, priceDigits(price))}</div>
      {at && <div className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(at)}</div>}
    </div>
  );
}

interface Props {
  trades: Trade[];
  sortBy: SortField;
  sortOrder: "asc" | "desc";
  onSortChange: (sortBy: SortField, sortOrder: "asc" | "desc") => void;
}

/** Sorting and paging happen on the server; only entryTime/exitTime/pnl/pnlPct are sortable there. */
export function TradesTable({ trades, sortBy, sortOrder, onSortChange }: Props) {
  const now = useNow(30_000);

  const columns = useMemo(
    () =>
      col.columns([
      col.accessor("symbol", {
        header: "Símbolo",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Link href={`/trades/${row.original._id}`} className="underline-offset-4 hover:underline focus-visible:underline">
              {row.original.symbol}
            </Link>
            {row.original.isSeed && <SeedBadge />}
          </span>
        ),
      }),
      col.accessor("side", { header: "Lado", enableSorting: false }),
      col.accessor("strategy", {
        header: "Estratégia",
        enableSorting: false,
        cell: (c) => <span className="text-muted-foreground">{c.getValue()}</span>,
      }),
      col.accessor("mode", { header: "Modo", enableSorting: false, cell: (c) => <ModeBadge mode={c.getValue()} /> }),
      col.accessor("entryTime", {
        id: "entryTime",
        header: "Entrada",
        cell: ({ row }) => <PriceAt price={row.original.entryPrice} at={row.original.entryTime} />,
      }),
      col.accessor("exitTime", {
        id: "exitTime",
        header: "Saída",
        cell: ({ row }) =>
          row.original.status === "OPEN" ? (
            <span className="block text-right text-xs font-medium text-mode-paper">Aberta</span>
          ) : (
            <PriceAt price={row.original.exitPrice} at={row.original.exitTime} />
          ),
      }),
      col.accessor("qty", {
        header: "Qtd",
        enableSorting: false,
        cell: (c) => <span className="block text-right tabular-nums">{formatNumber(c.getValue(), 6)}</span>,
      }),
      col.accessor("pnl", {
        id: "pnl",
        header: "PnL",
        cell: (c) => <span className="block text-right"><Pnl value={c.getValue()} /></span>,
      }),
      col.accessor("pnlPct", {
        id: "pnlPct",
        header: "PnL %",
        cell: (c) => <span className="block text-right"><PnlPercent value={c.getValue()} /></span>,
      }),
      col.accessor("exitReason", {
        header: "Motivo de saída",
        enableSorting: false,
        cell: (c) => exitReasonLabel(c.getValue()),
      }),
      col.display({
        id: "duration",
        header: "Duração",
        cell: ({ row }) => (
          <span className="block text-right whitespace-nowrap tabular-nums">
            {formatDuration(tradeDurationMs(row.original, now))}
            {row.original.status === "OPEN" && <span className="text-muted-foreground"> (aberta)</span>}
          </span>
        ),
      }),
      ]),
    [now],
  );

  const sorting: SortingState = [{ id: sortBy, desc: sortOrder === "desc" }];

  const table = useTable({
    features,
    data: trades,
    columns,
    getRowId: (t) => t._id,
    manualSorting: true,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      if (first && (TRADE_SORT_FIELDS as readonly string[]).includes(first.id)) {
        onSortChange(first.id as SortField, first.desc ? "desc" : "asc");
      }
    },
  });

  const RIGHT = new Set(["entryTime", "exitTime", "qty", "pnl", "pnlPct", "duration"]);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                const label = flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <TableHead
                    key={header.id}
                    className={cn(RIGHT.has(header.column.id) && "text-right")}
                    aria-sort={dir ? (dir === "asc" ? "ascending" : "descending") : canSort ? "none" : undefined}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                          RIGHT.has(header.column.id) && "flex-row-reverse",
                        )}
                      >
                        {label}
                        {dir === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : dir === "desc" ? (
                          <ArrowDown className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                        )}
                        <span className="sr-only">(ordenar)</span>
                      </button>
                    ) : (
                      label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className="align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
