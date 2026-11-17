import { epley, isTrustedWorkingSet, partOfMonth, type GoalEta, type HistorySession, type LoggedSet, type SetupType } from "@gain/engine";
import type { StringKey } from "../i18n/strings";
import { countKey } from "./achievementCopy";
import { formatNumber } from "./dateText";
import { localDateText } from "./trendChart";
import { LB_PER_KG, type Unit } from "./units";

/**
 * Pure helpers for the redesigned exercise progression screen (Summary / Rep Max / History). Everything shown there is rounded
 * here: estimated maxes and trends to whole kg (or lb), volumes to whole numbers with thousands separators.
 */

type T = (key: StringKey, params?: Record<string, string | number>) => string;
type Lang = "en" | "ar";
const DAY_MS = 86_400_000;
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** A kilogram value in the lifter's unit, rounded to a whole number ("93", never "93.333"). */
export const wholeInUnit = (kg: number, unit: Unit): number => Math.round(unit === "kg" ? kg : kg * LB_PER_KG);

/** A whole number with thousands separators and Western digits: 1710 → "1,710". */
export const groupedNumber = (n: number, lang: Lang): string => formatNumber(Math.round(n), lang);

/** Signed monthly change in the lifter's unit, whole numbers: "+4", "-2", "0". */
export function signedWhole(kgPerMonth: number, unit: Unit): string {
  const v = wholeInUnit(kgPerMonth, unit);
  return v > 0 ? `+${v}` : v < 0 ? `\u2212${Math.abs(v)}` : "0";
}

/** "Sep 2025" (axis label: month and year). */
export function monthYear(at: number, lang: Lang): string {
  const d = new Date(at);
  return `${(lang === "ar" ? AR_MONTHS : EN_MONTHS)[d.getMonth()]} ${d.getFullYear()}`;
}

/** "early Jan" / "أوائل يناير": the part of the month plus its name. */
export function monthPart(at: number, lang: Lang, t: T): string {
  const month = (lang === "ar" ? AR_MONTHS : EN_MONTHS)[new Date(at).getMonth()]!;
  return t(`trend.goal.part.${partOfMonth(at)}` as StringKey, { month });
}

/** The muted or accent line beside the Goal field. `tone` = accent when the goal has a date or is reached. */
export function goalLine(eta: GoalEta, lang: Lang, t: T): { text: string; tone: "accent" | "muted" } | null {
  switch (eta.kind) {
    case "reached":
      return { text: t("trend.goal.reached"), tone: "accent" };
    case "beyond":
      return { text: t("trend.goal.beyond"), tone: "muted" };
    case "notOnPace":
      return { text: t("trend.goal.notOnPace"), tone: "muted" };
    case "unknown":
      return null;
    case "eta": {
      const when = monthPart(eta.at, lang, t);
      const months = eta.days / 30.4375;
      if (months < 0.75) {
        const weeks = Math.max(1, Math.round(eta.days / 7));
        return { text: t(countKey(weeks, lang, "trend.goal.inWeeks.one", "trend.goal.inWeeks.few"), { n: weeks, when }), tone: "accent" };
      }
      const n = Math.max(1, Math.round(months));
      return { text: t(countKey(n, lang, "trend.goal.inMonths.one", "trend.goal.inMonths.few"), { n, when }), tone: "accent" };
    }
  }
}

/** "1 rep" / "5 reps" (Arabic: singular for 1, 2 and 11+, plural for 3–10). */
export const repsLabel = (n: number, lang: Lang, t: T): string => t(countKey(n, lang, "trend.reps.one", "trend.reps.few"), { n });
/** "1 set" / "2 sets". */
export const setsLabel = (n: number, lang: Lang, t: T): string => t(countKey(n, lang, "trend.sets.one", "trend.sets.few"), { n });

/** Trusted working sets of one session (no warm-ups, drops or unconfirmed outliers), with their index in the session. */
export function workingSets(h: HistorySession): { set: LoggedSet; index: number }[] {
  return h.sets.flatMap((set, index) => (isTrustedWorkingSet(set) && set.reps >= 1 && Number.isFinite(set.load) ? [{ set, index }] : []));
}

/** Total working volume of a session (kg × reps). */
export const sessionVolumeKg = (h: HistorySession): number => workingSets(h).reduce((sum, { set }) => sum + set.load * set.reps, 0);

export interface RepMaxRow {
  reps: number;
  load: number;
  at: number;
  /** Epley estimate (kg), unrounded; round for display. */
  e1rm: number;
  /** Share of the best row's e1RM, 0..1 (bar length). */
  share: number;
  best: boolean;
}

/** Rep counts the Rep Max tab lists: estimates past 15 reps say little about a 1RM. */
export const REP_MAX_LIMIT = 15;

/**
 * Rep Max rows, sorted by rep count (1, 2, 5, 6, 8, 10...), each with its Epley e1RM and a bar relative to the best row.
 * Input is the engine's `repMaxes` (heaviest load at each exact rep count).
 */
export function repMaxRows(repMaxes: { reps: number; set: { load: number; at: number } }[], setup: SetupType): RepMaxRow[] {
  if (setup === "assisted") return [];
  const rows = repMaxes
    .filter((r) => r.reps >= 1 && r.reps <= REP_MAX_LIMIT && r.set.load > 0)
    .map((r) => ({ reps: r.reps, load: r.set.load, at: r.set.at, e1rm: epley(r.set.load, r.reps) }))
    .sort((a, b) => a.reps - b.reps);
  const top = Math.max(0, ...rows.map((r) => r.e1rm));
  const bestIndex = rows.findIndex((r) => r.e1rm === top);
  return rows.map((r, i) => ({ ...r, share: top > 0 ? r.e1rm / top : 0, best: i === bestIndex }));
}

/** Parse a typed goal ("100", "102,5", "١٠٠") in the lifter's unit; null when empty or not a positive number. */
export function parseGoal(text: string): number | null {
  const western = text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) & 0xf)).replace(",", ".").replace(/[^\d.]/g, "");
  if (western === "") return null;
  const n = Number(western);
  return Number.isFinite(n) && n > 0 && n < 10_000 ? n : null;
}

/** The device setting that keeps the Summary goal (stored in kg) for one exercise and setup. */
export const goalSettingKey = (exerciseId: string, setup: SetupType): string => `progress_goal:${exerciseId}:${setup}`;

/** Chart ranges for the Summary chart. */
export type SummaryRange = "3m" | "1y" | "all";
export function rangeStart(range: SummaryRange, now: number): number {
  return range === "all" ? Number.NEGATIVE_INFINITY : now - (range === "3m" ? 90 : 365) * DAY_MS;
}

/** A verified PR set (from the achievements cabinet): the lifter's local date + load + reps. */
export interface PrSetRef {
  setId?: string;
  localDate: string;
  load: number;
  reps: number;
}

/** True when the set logged at `at` matches a verified PR (same local day, load and reps). */
export function isVerifiedPrSet(prSets: readonly PrSetRef[], at: number, set: Pick<LoggedSet, "id" | "load" | "reps">): boolean {
  const day = localDateText(at);
  return prSets.some((r) => r.setId != null && set.id != null ? r.setId === set.id : r.localDate === day && r.load === set.load && r.reps === set.reps);
}
