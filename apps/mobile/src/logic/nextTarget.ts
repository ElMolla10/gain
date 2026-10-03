import { isTimed, targetPhrase, targetQuantity } from "./quantity";

type Measure = Parameters<typeof isTimed>[0];

/** The first sentence of a reason: the short "why" shown beside a target (the full text stays on the Why screen). */
export function shortReason(text: string): string {
  const s = text.trim();
  const m = /^(.+?[.!?؟])(\s|$)/.exec(s);
  return (m ? m[1]! : s).trim();
}

interface TargetLike {
  exerciseId: string;
  status: string;
  currency: string;
  measure: Measure;
  reps: number | null;
  durationS?: number | null;
  distanceM?: number | null;
  effectiveLoad: number | null;
}

/** A target that says something concrete ("72.5 kg × 8"): not rejected, not "no target". */
export function hasConcreteTarget(tg: TargetLike): boolean {
  return tg.status !== "rejected" && tg.currency !== "none" && tg.effectiveLoad !== null;
}

/** "72.5 kg × 8" (or "60 s", "20 kg × 40 m"): the number part of the "Next session" line. */
export function targetText(tg: TargetLike, loadText: (kg: number) => string, unitLetters: { s: string; m: string }): string {
  if (isTimed(tg.measure)) return targetPhrase(tg.effectiveLoad ?? 0, targetQuantity(tg, tg.measure) ?? 0, tg.measure, loadText, unitLetters);
  return `${loadText(tg.effectiveLoad ?? 0)} × ${tg.reps ?? ""}`;
}

/** The target shown as the headline: a goal lift's first, else the first concrete one. */
export function leadTarget<T extends TargetLike>(targets: T[], goalExerciseIds: ReadonlySet<string>): T | null {
  const concrete = targets.filter(hasConcreteTarget);
  return concrete.find((tg) => goalExerciseIds.has(tg.exerciseId)) ?? concrete[0] ?? null;
}
