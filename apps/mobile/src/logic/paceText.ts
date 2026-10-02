import type { PaceResult } from "../db/goalRepo";
import type { StringKey } from "../i18n/strings";

type T = (key: StringKey, params?: Record<string, string | number>) => string;

export interface PaceContext {
  t: T;
  /** A kilogram weight as text in the lifter's unit, e.g. "62.5 kg". */
  fmt: (kg: number) => string;
  /** Localised name of the goal exercise (lift goals). */
  exerciseName: string;
  /** Localised muscle names are looked up by key. */
  muscleName: (m: string) => string;
}

export interface PaceText {
  /** One line: what the goal is and where it stands. */
  headline: string;
  /** The numbers behind it, one sentence each. Observed numbers first. */
  details: string[];
  /** One short line for the Today card. */
  short: string;
}

const num = (n: number, d = 1): string => String(Math.round(n * 10 ** d) / 10 ** d);
const signed = (kg: number, fmt: (kg: number) => string): string => `${kg > 0 ? "+" : kg < 0 ? "-" : ""}${fmt(Math.abs(kg))}`;

/** Turns a pace result into sentences. It says what was used and never more than the pace functions found. */
export function describePace(r: PaceResult, c: PaceContext): PaceText {
  const { t, fmt } = c;
  if (r.kind === "none") {
    const s = t("pace.none");
    return { headline: s, details: [], short: s };
  }
  const status = t(`pace.status.${r.pace.status}` as StringKey);
  const date = r.goal.kind === "muscle" ? null : r.goal.targetDate;
  const dateLine = date === null ? t("pace.date.none") : r.kind !== "muscle" && "dateGone" in r.pace && r.pace.dateGone ? t("pace.date.gone", { date }) : t("pace.date.set", { date });

  if (r.kind === "lift") {
    const p = r.pace;
    const details: string[] = [];
    if (p.status === "too_thin") {
      details.push(p.thin === "no_history" ? t("pace.lift.thin.no_history") : t("pace.lift.thin.few_exposures", { min: 4, have: p.exposures }));
    } else {
      details.push(t("pace.lift.now", { now: fmt(p.currentE1rm!), target: fmt(p.targetE1rm) }));
      if (p.status !== "reached") {
        details.push(p.ratePerExposure !== null && p.ratePerExposure > 0 ? t("pace.lift.rate", { rate: fmt(p.ratePerExposure), perWeek: num(p.exposuresPerWeek ?? 0) }) : t("pace.lift.flat"));
        if (p.requiredPerExposure !== null && p.exposuresLeft !== null) details.push(t("pace.lift.needed", { req: fmt(p.requiredPerExposure), left: Math.round(p.exposuresLeft) }));
        if (p.projectedDate) details.push(t("pace.lift.projected", { date: p.projectedDate }));
      }
    }
    details.push(dateLine);
    return {
      headline: t("pace.lift.headline", { name: c.exerciseName, load: fmt(r.goal.targetLoad), reps: r.goal.targetReps, status }),
      details,
      short: t("pace.today.lift", { name: c.exerciseName, status }),
    };
  }

  if (r.kind === "bodyweight") {
    const p = r.pace;
    const details: string[] = [];
    if (p.status === "too_thin" && p.thin !== "few_entries") {
      details.push(t(`pace.bw.thin.${p.thin}` as StringKey));
    } else {
      details.push(t("pace.bw.trend", { trend: fmt(p.trendKg!) }));
      if (p.status === "too_thin") details.push(t("pace.bw.thin.few_entries", { have: p.entries }));
      else if (p.status !== "reached") {
        details.push(t("pace.bw.slope", { slope: signed(p.slopeKgPerWeek!, fmt) }));
        if (p.requiredKgPerWeek !== null) details.push(t("pace.bw.needed", { req: signed(p.requiredKgPerWeek, fmt) }));
        if (p.projectedDate) details.push(t("pace.bw.projected", { date: p.projectedDate }));
      }
    }
    details.push(dateLine);
    return { headline: t("pace.bodyweight.headline", { weight: fmt(r.goal.targetWeightKg), status }), details, short: t("pace.today.bodyweight", { status }) };
  }

  const p = r.pace;
  const muscle = c.muscleName(r.goal.muscle);
  const details = [p.status === "too_thin" ? t("pace.muscle.thin") : t("pace.muscle.now", { perWeek: num(p.sessionsPerWeek ?? 0), floor: p.floorPerWeek })];
  return { headline: t("pace.muscle.headline", { muscle, n: p.floorPerWeek, status }), details, short: t("pace.today.muscle", { muscle, status }) };
}
