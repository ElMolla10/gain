import type { AchievementEvidence } from "@gain/engine";
import { formatLoad, isolateLtr, NBSP, type Lang } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import type { Unit } from "./units";

export function formatSetEvidence(load: number, reps: number, lang: Lang, unit: Unit): string {
  // Language order (S-1/F-2): the number is isolated, the unit word stays in the language; never LTR-isolate Arabic.
  return `${formatLoad(load, lang, unit)}${NBSP}×${NBSP}${isolateLtr(String(reps))}`;
}

export function evidenceLine(
  evidence: AchievementEvidence | null,
  t: (key: StringKey, params?: Record<string, string | number>) => string,
  lang: Lang,
  unit: Unit,
  names: { nameEn: string | null; nameAr: string | null },
): string {
  if (!evidence) return "";
  if (evidence.kind === "first_session") return t("achv.evidence.firstSession", { n: evidence.trustedWorkingSets });
  if (evidence.kind === "qualified_weeks") {
    const count = evidence.lifetimeCount;
    const key: StringKey = lang === "ar" ? (count === 1 ? "achv.evidence.weeks.one" : count === 2 ? "achv.evidence.weeks.dual" : "achv.evidence.weeks.many") : "achv.evidence.weeks";
    return t(key, { count, run: evidence.consecutiveRun });
  }
  if (evidence.kind === "comeback") return t("achv.evidence.comeback", { days: evidence.gapDays });
  const exercise = (lang === "ar" ? names.nameAr : names.nameEn) || names.nameEn || names.nameAr || "";
  if (evidence.kind === "dedicated") return t("achv.evidence.dedicated", { exercise, n: evidence.sessions });
  if (evidence.kind === "block_builder") return t("achv.evidence.blockBuilder", { exercise, months: evidence.months.join(" · ") });
  if (evidence.kind === "full_spectrum") return t("achv.evidence.spectrum", { n: evidence.covered.length, weeks: evidence.tier });
  if (evidence.kind === "iron_hold") return t("achv.evidence.hold", { exercise, before: evidence.previous.durationS, after: evidence.next.durationS });
  if (evidence.kind === "iron_carry") return t("achv.evidence.carry", { exercise, before: evidence.previous.distanceM, after: evidence.next.distanceM });
  if (evidence.kind === "workhorse") {
    const before = evidence.previousBest ? formatSetEvidence(evidence.previousBest.load, evidence.previousBest.reps, lang, unit) : "";
    const after = evidence.newBest ? formatSetEvidence(evidence.newBest.load, evidence.newBest.reps, lang, unit) : "";
    return t("achv.evidence.workhorse", { exercise, before, after });
  }
  if (evidence.kind === "hundred_club") return t("achv.evidence.hundred", { n: evidence.days });
  if (evidence.kind === "multi_year") {
    const key: StringKey = lang === "ar" ? (evidence.years === 1 ? "achv.evidence.years.one" : evidence.years === 2 ? "achv.evidence.years.dual" : "achv.evidence.years.many") : "achv.evidence.years";
    return t(key, { n: evidence.years });
  }
  if (evidence.kind === "pin_target") {
    return t("achv.evidence.pin", { exercise, target: formatSetEvidence(evidence.target.load, evidence.target.reps, lang, unit) });
  }
  if (evidence.kind === "quest") return t("achv.evidence.quest", { month: evidence.month, done: evidence.current, goal: evidence.target });
  const prevBest = "previousBest" in evidence && evidence.previousBest ? evidence.previousBest : null;
  const newBest = "newBest" in evidence && evidence.newBest ? evidence.newBest : null;
  return t("achv.evidence.pr", {
    exercise,
    before: prevBest ? formatSetEvidence(prevBest.load, prevBest.reps, lang, unit) : "",
    after: newBest ? formatSetEvidence(newBest.load, newBest.reps, lang, unit) : "",
  });
}
