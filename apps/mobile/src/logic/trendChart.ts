import { epley, type HistorySession, type TrendDirection, type TrendPoint } from "@gain/engine";
import type { StringKey } from "../i18n/strings";

export type ChartMetric = "weight" | "e1rm" | "volume";
export type ChartRange = "3m" | "1y" | "all";
const DAY_MS = 86_400_000;

/** Visible points only. Does not recompute the underlying trend. */
export function filterTrendPoints(points: TrendPoint[], range: ChartRange, now: number): TrendPoint[] {
  if (range === "all") return points;
  const from = now - (range === "3m" ? 90 : 365) * DAY_MS;
  return points.filter((p) => p.at >= from);
}

/** Remap each existing top-set point to the chart metric. Weight keeps the original load. */
export function metricTrendPoints(points: TrendPoint[], metric: ChartMetric): TrendPoint[] {
  if (metric === "weight") return points;
  return points.map((p) => ({
    ...p,
    load: metric === "e1rm" ? epley(p.load, p.reps) : p.load * (p.quantity ?? p.reps),
    quantity: undefined,
  }));
}

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
  // A hold / carry line at one constant load is drawn by its seconds / metres; once the load changed it is drawn by load, like a reps line.
  const byQuantity = shown.every((p) => p.quantity !== undefined) && shown.every((p) => p.load === shown[0]!.load);
  const score = (p: TrendPoint) => (byQuantity ? p.quantity! : assisted ? -p.load : p.load);
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

/** Consecutive sessions on the same local date share a header. Does not sort; pass newest-first. */
export function groupSessionsByDate(sessions: HistorySession[]): { date: string; data: HistorySession[] }[] {
  const groups: { date: string; data: HistorySession[] }[] = [];
  for (const h of sessions) {
    const at = Date.parse(h.performedAt);
    const date = Number.isFinite(at) ? localDateText(at) : h.performedAt;
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.data.push(h);
    else groups.push({ date, data: [h] });
  }
  return groups;
}
