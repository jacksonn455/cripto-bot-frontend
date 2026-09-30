import { Activity, BarChart3, CandlestickChart, FlaskConical, LayoutDashboard, List, Percent, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: List },
  { href: "/analytics", label: "Análises", icon: BarChart3 },
  { href: "/market", label: "Mercado", icon: CandlestickChart },
  { href: "/backtests", label: "Backtests", icon: FlaskConical },
  { href: "/funding", label: "Funding", icon: Percent },
  { href: "/signals", label: "Sinais e eventos", icon: Activity },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
