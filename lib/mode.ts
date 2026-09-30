import { MODES, type Mode } from "@/lib/schemas/common";

export const DEFAULT_MODE: Mode = "PAPER";
export const MODE_COOKIE = "painel-data-mode";

export const MODE_META: Record<Mode, { label: string; description: string; className: string }> = {
  PAPER: {
    label: "PAPER",
    description: "Simulação com preços reais, sem dinheiro real",
    className: "bg-mode-paper text-white",
  },
  LIVE: {
    label: "LIVE",
    description: "Dinheiro real",
    className: "bg-mode-live text-white ring-2 ring-mode-live/40 ring-offset-1 ring-offset-background",
  },
  BACKTEST: {
    label: "BACKTEST",
    description: "Simulação sobre dados históricos",
    className: "bg-mode-backtest text-white",
  },
};

export function parseMode(value: string | undefined | null): Mode {
  return MODES.includes(value as Mode) ? (value as Mode) : DEFAULT_MODE;
}
