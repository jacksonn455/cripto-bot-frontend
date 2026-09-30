import { MODE_META } from "@/lib/mode";
import type { Mode } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";

interface ModeBadgeProps {
  mode: Mode;
  size?: "sm" | "md";
  className?: string;
}

export function ModeBadge({ mode, size = "sm", className }: ModeBadgeProps) {
  const meta = MODE_META[mode];
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex items-center rounded-md font-bold tracking-wide whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[0.7rem]" : "px-2.5 py-1 text-xs",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
