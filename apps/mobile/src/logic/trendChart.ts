import type { TrendDirection, TrendPoint } from "@gain/engine";
import type { StringKey } from "../i18n/strings";

export const MAX_BARS = 30;

export interface Bar {
  /** 0..1 height of the bar. The scale starts below the lowest shown load, so small gains stay visible. */
  frac: number;
  imported: boolean;
  at: number;
}

/**
 * Bars for the last `MAX_BARS` sessions, oldest first (the chart is drawn left-to-right in both languages).
 * Taller = harder: for assisted lines less assistance is taller. A flat history draws equal mid-height bars.
 */
export function chartBars(points: TrendPoint[], assisted: boolean): Bar[] {
  const shown = points.slice(-MAX_BARS);
  if (shown.length === 0) return [];
  const score = (p: TrendPoint) => (assisted ? -p.load : p.load);
  const lo = Math.min(...shown.map(score));
  const hi = Math.max(...shown.map(score));
  return shown.map((p) => ({ frac: hi === lo ? 0.6 : 0.15 + (0.85 * (score(p) - lo)) / (hi - lo), imported: !!p.imported, at: p.at }));
}

export const directionKey = (d: TrendDirection, assisted: boolean): StringKey =>
  d === "thin" ? "trend.dir.thin"
  : d === "flat" ? "trend.dir.flat"
  : d === "better" ? (assisted ? "trend.dir.betterAssisted" : "trend.dir.better")
  : assisted ? "trend.dir.worseAssisted" : "trend.dir.worse";

/** The lifter's local calendar date, YYYY-MM-DD (not UTC: a 00:30 workout is that day, not the day before). */
export function localDateText(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
