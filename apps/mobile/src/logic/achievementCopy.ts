/**
 * Achievements round 2: the words around the showcase art (plate caption, sleeve line, stat values, a11y labels).
 * Pure (no React Native), so EN and AR output can be checked to the code point. Numbers are isolated by `t` (translate), the
 * Arabic count nouns follow arPluralKey (3–10 plural, otherwise singular), and Arabic never uses a slash fraction.
 */
import { isolateLtr, NBSP, type Lang } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import type { AchievementEvidence } from "@gain/engine";
import { arPluralKey, daysToNext, nextPlate, plateTier, prDelta, prStair, type MedalState, type PlateTier } from "./achievementShowcase";
import { formatSetEvidence } from "./achievementEvidence";
import type { Unit } from "./units";
import { prestigeForBadge, type SurfaceBadge } from "./achievementSurface";
import { formatDay } from "./dateText";

type T = (key: StringKey, params?: Record<string, string | number>) => string;

/** Count noun key: English singular only for 1; Arabic by arPluralKey. */
export const countKey = <K extends StringKey>(n: number, lang: Lang, one: K, few: K): K => (lang === "ar" ? arPluralKey(n, one, few) : n === 1 ? one : few);

export const plateName = (tier: PlateTier, t: T): string => t(`achv.r2.plate.${tier}` as StringKey);

export interface PlateCopy {
  /** The numeral in the collar: digits only ("412", "1000+"). */
  numeral: string;
  /** "training days" / "يوم تمرين" under the numeral. */
  label: string;
  /** Line under the plate, or the empty-state title. */
  caption: string;
  /** Empty state only: how a day counts. */
  body: string | null;
  empty: boolean;
  /** One spoken element for the whole plate. */
  a11y: string;
}

export function plateCopy(days: number | null, floor: boolean, lang: Lang, t: T): PlateCopy {
  const n = days ?? 0;
  const numeral = floor ? `${n}+` : String(n);
  const label = t(countKey(n, lang, "achv.r2.plate.days.one", "achv.r2.plate.days.few"));
  if (n <= 0) {
    const caption = t("achv.r2.plate.first");
    return { numeral, label, caption, body: t("achv.r2.plate.firstBody"), empty: true, a11y: t("achv.r2.plate.a11y", { days: `${numeral} ${label}`, caption }) };
  }
  const tier = plateTier(n);
  const next = nextPlate(n);
  const left = daysToNext(n);
  const caption =
    next && left !== null
      ? t(countKey(left, lang, "achv.r2.plate.toNext.one", "achv.r2.plate.toNext.few"), { plate: plateName(tier, t), n: left, next: t(`achv.r2.plate.to.${next}` as StringKey) })
      : t("achv.r2.plate.top", { plate: plateName(tier, t) });
  return { numeral, label, caption, body: null, empty: false, a11y: t("achv.r2.plate.a11y", { days: `${numeral} ${label}`, caption }) };
}

export interface SleeveCopy {
  line: string;
  a11y: string;
}

export function sleeveCopy(done: number, goal: number, t: T): SleeveCopy {
  return {
    line: done >= goal ? t("achv.pulse.qualified") : t("achv.r2.week.line", { done, goal }),
    a11y: t("achv.r2.week.a11y", { done: Math.min(done, goal), goal }),
  };
}

/** "11 / 17" in English, "11 من 17" in Arabic (no slash fractions in Arabic). */
export const medalsValue = (earned: number, total: number, t: T): string => t("achv.r2.stat.medalsValue", { earned, total });

/** What a medal slot says about itself: enough to rebuild its state line and spoken label. */
export interface MedalSlotInfo {
  badgeId: string;
  state: MedalState;
  row: Pick<SurfaceBadge, "earnedLocalDate" | "earnedAtUtc" | "progressCurrent" | "progressTarget"> | null;
  count: number;
  repeatable: boolean;
}

const earnedDay = (row: MedalSlotInfo["row"], lang: Lang, now?: number): string => {
  const when = row?.earnedLocalDate ?? row?.earnedAtUtc;
  return when === null || when === undefined ? "" : formatDay(when, lang, now, true);
};

/**
 * The line under a medal: earn date (short, the year only outside this year), "×37" as one isolated run for a repeatable stack,
 * "38 of 50" in progress (no slash fractions in Arabic), "Locked" / "لسه".
 */
export function medalStateLine(item: MedalSlotInfo, lang: Lang, t: T, now?: number): string {
  if (item.state === "earned") return item.repeatable ? isolateLtr(`\u00d7${item.count}`) : earnedDay(item.row, lang, now);
  if (item.state === "in_progress") return t("achv.r2.medal.of", { x: item.row?.progressCurrent ?? 0, y: item.row?.progressTarget ?? 0 });
  return t("achv.r2.medal.locked");
}

/** Spoken label per spec §9: "{name}, {prestige}, earned {date}" · "{name}, in progress, {x} of {y}" · "{name}, locked". */
export function medalA11y(item: MedalSlotInfo, name: string, lang: Lang, t: T, now?: number): string {
  if (item.state === "earned") {
    const prestige = t(`achv.prestige.${prestigeForBadge(item.badgeId)}` as StringKey);
    const date = earnedDay(item.row, lang, now);
    if (item.repeatable && item.count > 1) {
      return t(countKey(item.count, lang, "achv.r2.medal.a11y.times.one", "achv.r2.medal.a11y.times.few"), { name, prestige, n: item.count, date });
    }
    return t("achv.r2.medal.a11y.earned", { name, prestige, date });
  }
  if (item.state === "in_progress") return t("achv.r2.medal.a11y.progress", { name, x: item.row?.progressCurrent ?? 0, y: item.row?.progressTarget ?? 0 });
  return t("achv.r2.medal.a11y.locked", { name });
}

type PrRow = SurfaceBadge & { evidence: Extract<AchievementEvidence, { kind: "strength_pr" }> };

export const exerciseName = (row: Pick<SurfaceBadge, "exerciseNameEn" | "exerciseNameAr">, lang: Lang): string =>
  (lang === "ar" ? row.exerciseNameAr : row.exerciseNameEn) || row.exerciseNameEn || row.exerciseNameAr || "";

export interface PrCopy {
  exercise: string;
  date: string;
  before: string;
  after: string;
  delta: string;
  /** "4 verified PRs on this lift since 3 Mar". */
  caption: string;
  /** Spoken staircase: "4 verified PRs on Preacher Curl since 3 Mar, latest 16 kg × 6". */
  stairA11y: string;
  /** The whole card as one sentence. */
  a11y: string;
  stepCount: number;
}

/**
 * Words for the PR spotlight: "Latest verified PR" (never "best"), before → after as real sets ("16 كجم × 6" in Arabic: number
 * isolated, unit in the language, × between no-break spaces), the delta chip and the staircase caption / spoken summary.
 */
export function prCopy(pr: PrRow, cabinet: readonly SurfaceBadge[], lang: Lang, unit: Unit, t: T, now?: number): PrCopy {
  const e = pr.evidence;
  const exercise = exerciseName(pr, lang);
  const steps = prStair(cabinet, e.identity);
  const n = Math.max(1, steps.length);
  // A short date stays on one line ("3\u00a0Mar").
  const since = formatDay(steps[0]?.localDate ?? e.newBest.localDate, lang, now, true).replace(/ /g, NBSP);
  const before = formatSetEvidence(e.previousBest.load, e.previousBest.reps, lang, unit);
  const after = formatSetEvidence(e.newBest.load, e.newBest.reps, lang, unit);
  const delta = prDelta(e, lang, unit, t);
  const date = formatDay(pr.earnedLocalDate ?? e.newBest.localDate, lang, now);
  return {
    exercise,
    date,
    before,
    after,
    delta,
    caption: t(countKey(n, lang, "achv.r2.stair.caption.one", "achv.r2.stair.caption.few"), { n, date: since }),
    stairA11y: t(countKey(n, lang, "achv.r2.stair.a11y.one", "achv.r2.stair.a11y.few"), { n, exercise, date: since, latest: after }),
    a11y: t("achv.r2.pr.a11y", { date, exercise, before, after, delta }),
    stepCount: n,
  };
}
