const LOCALE = "pt-BR";
/** U+2212: typographic minus, visibly distinct from a hyphen. */
export const MINUS = "−";

const numberFmt = (digits: number) =>
  new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });

const money = numberFmt(2);
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { dateStyle: "short", timeStyle: "short" });
const dateFmt = new Intl.DateTimeFormat(LOCALE, { dateStyle: "short" });

/** Balances are USDT (every configured pair is USDT-quoted in the backend). */
export function formatMoney(value: number, asset = "USDT"): string {
  return `${money.format(value)} ${asset}`;
}

export function formatNumber(value: number, digits = 2): string {
  return numberFmt(digits).format(value);
}

/** Always prefixes + or − so the sign never depends on color alone. Zero gets no sign. */
export function withSign(value: number, format: (abs: number) => string): string {
  if (value > 0) return `+${format(value)}`;
  if (value < 0) return `${MINUS}${format(Math.abs(value))}`;
  return format(0);
}

export function formatSignedMoney(value: number, asset = "USDT"): string {
  return withSign(value, (abs) => formatMoney(abs, asset));
}

/** For fractions (0.125 → "12,50%"), e.g. winRate and maxDrawdownPct. */
export function formatFraction(value: number, digits = 2): string {
  return `${numberFmt(digits).format(value * 100)}%`;
}

/** For values already in percent (2.5 → "+2,50%"), e.g. trade.pnlPct. */
export function formatSignedPercent(value: number, digits = 2): string {
  return withSign(value, (abs) => `${numberFmt(digits).format(abs)}%`);
}

export function formatDateTime(iso: string | number | Date): string {
  return dateTimeFmt.format(new Date(iso));
}

export function formatDate(iso: string | number | Date): string {
  return dateFmt.format(new Date(iso));
}

/** "2 d 3 h", "3 h 15 min", "45 min", "30 s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** "agora", "há 5 min", "há 2 h". */
export function formatRelative(iso: string | number | Date, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 45_000) return "agora";
  return `há ${formatDuration(diff)}`;
}

export type Tone = "profit" | "loss" | "neutral";

export function toneOf(value: number | null | undefined): Tone {
  if (value === null || value === undefined || value === 0) return "neutral";
  return value > 0 ? "profit" : "loss";
}
