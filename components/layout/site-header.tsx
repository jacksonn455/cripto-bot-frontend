import Link from "next/link";
import type { ReactNode } from "react";
import { LiveIndicator } from "@/components/live/live-indicator";
import { BotModeBadge } from "@/components/mode/bot-mode-badge";
import { DataModeSelect } from "@/components/mode/data-mode-select";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex h-14 items-center gap-2 px-4">
        <MobileNav />
        <Link href="/" aria-label="Krypto, início" className="mr-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <Brand nameClassName="hidden sm:inline" />
        </Link>
        <BotModeBadge />
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <LiveIndicator />
          <DataModeSelect />
          <ThemeToggle />
          {actions}
        </div>
      </div>
    </header>
  );
}
