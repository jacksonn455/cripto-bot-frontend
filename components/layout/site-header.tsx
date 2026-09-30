import Link from "next/link";
import type { ReactNode } from "react";
import { Bot } from "lucide-react";
import { LiveIndicator } from "@/components/live/live-indicator";
import { BotModeBadge } from "@/components/mode/bot-mode-badge";
import { DataModeSelect } from "@/components/mode/data-mode-select";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex h-14 items-center gap-2 px-4">
        <MobileNav />
        <Link href="/" className="mr-2 flex items-center gap-2 font-semibold">
          <Bot className="size-5" aria-hidden />
          <span className="hidden sm:inline">Trade Bot</span>
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
