import { cn } from "@/lib/utils";

/** Flags trades created by the backend's seed script, so fake data is never mistaken for real. */
export function SeedBadge({ className }: { className?: string }) {
  return (
    <span
      title="Dado fictício gerado pelo script de seed do backend"
      className={cn(
        "inline-flex items-center rounded border border-dashed border-warning px-1 text-[0.65rem] font-semibold tracking-wide text-warning",
        className,
      )}
    >
      SEED
    </span>
  );
}
