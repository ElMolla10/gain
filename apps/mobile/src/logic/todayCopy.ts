/**
 * Today 10x words (spec §1, §4, §9). Pure. Numbers are isolated (signed deltas as ONE run: "+2.5"), units stay in the language, and
 * nothing here says "best", "missed" or a streak.
 */
import { isolateLtr, NBSP, type Lang } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { countKey } from "./achievementCopy";
import { shortReason } from "./nextTarget";
import { unitLabel, weightText, type Unit } from "./units";

type T = (key: StringKey, params?: Record<string, string | number>) => string;
const EPS = 1e-6;
const DAY_MS = 86_400_000;

/**
 * The part of a reason worth reading under the hero. For `load_up` the first sentence restates the target ("Go up to 102.5 kg for 6."),
 * so the tail is the sentences after the first ("You hit 10 at 100 kg."). A one-sentence reason gives its short form.
 */
export function reasonTail(text: string): string {
  const s = text.trim();
  const m = /^(.+?[.!?؟])\s+(\S[\s\S]*)$/.exec(s);
  return m ? m[2]!.trim() : shortReason(s);
}

export type DeltaChipKind = "loadUp" | "repUp" | "same" | "lighter" | "down" | "new" | "edited";

export interface ChipTarget {
  /** What the lifter will load (the edited load if edited). */
  load: number | null;
  reps: number | null;
  status: string;
}

export interface ChipLast {
  topLoad: number;
  repsAtTop: number;
}

/** The delta chip in words (never colour alone): +2.5 kg · +1 rep · Same, aim 8 · Lighter week · New · Your edit. */
export function deltaChip(target: ChipTarget, last: ChipLast | null, ctx: { lang: Lang; unit: Unit; t: T; lighterWeek?: boolean }): { kind: DeltaChipKind; text: string } {
  const { t, lang, unit } = ctx;
  if (target.status === "edited") return { kind: "edited", text: t("today.chip.edited") };
  if (ctx.lighterWeek) return { kind: "lighter", text: t("today.chip.lighter") };
  if (!last || target.load === null) return { kind: "new", text: t("today.chip.new") };
  const diff = target.load - last.topLoad;
  if (diff > EPS) return { kind: "loadUp", text: `${isolateLtr(`+${weightText(diff, unit)}`)}${NBSP}${unitLabel(unit, lang)}` };
  if (diff < -EPS) return { kind: "down", text: t("today.chip.down") };
  const reps = (target.reps ?? 0) - last.repsAtTop;
  if (reps > 0) return { kind: "repUp", text: t(countKey(reps, lang, "today.chip.repUp.one", "today.chip.repUp.few"), { n: `+${reps}` }) };
  return { kind: "same", text: t("today.chip.same", { n: target.reps ?? last.repsAtTop }) };
}

/** "07:02": when the session would end if started now (24-hour, Western digits). */
export function doneAround(now: number, minutes: number): string {
  const d = new Date(now + Math.max(0, minutes) * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Days since the last trusted training day when it is 14 or more (the welcome-back state), else null. Never a "missed" count. */
export const WELCOME_BACK_DAYS = 14;
export function welcomeBackGap(trainingDaysMs: readonly number[], now: number): number | null {
  if (trainingDaysMs.length === 0) return null;
  const last = Math.max(...trainingDaysMs);
  const days = Math.floor((now - last) / DAY_MS);
  return days >= WELCOME_BACK_DAYS ? days : null;
}
