import { z } from "zod";

/** Data modes as stored by the backend (trades.mode, equity_snapshots.mode, signals.mode). */
export const MODES = ["PAPER", "LIVE", "BACKTEST"] as const;
export const modeSchema = z.enum(MODES);
export type Mode = z.infer<typeof modeSchema>;

/** Mongo dates serialize as ISO strings; kept as strings and formatted at display time. */
export const isoDate = z.iso.datetime({ offset: true });

/** Mongo `_id` from `.lean()` serializes as a 24-char hex string. */
export const objectId = z.string().min(1);

/**
 * Optional backend fields are omitted from JSON when unset; `nullish` also accepts `null` so a
 * backend change from "omit" to "null" doesn't break the dashboard.
 */
export const opt = <T extends z.ZodType>(schema: T) => schema.nullish();
