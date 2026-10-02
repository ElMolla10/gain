import { isTrustedWorkingSet, type LoggedSet, type SetupType } from "@gain/engine";

export type RecordKind = "load" | "reps_at_load";

export interface ExerciseSummary {
  /** Working sets that count: not warm-ups, not drop sets, not unconfirmed/rejected outliers. */
  counted: number;
  warmups: number;
  dropSets: number;
  /** Logged but waiting for a confirm: shown, but they do not count and do not move the next target. */
  unconfirmed: number;
  top: { load: number; reps: number } | null;
  /** Records versus earlier sessions on the SAME line. Empty on the first time: no history, no record claim. */
  records: RecordKind[];
  firstTime: boolean;
}

const harder = (setup: SetupType, a: number, b: number) => (setup === "assisted" ? a < b : a > b);

/**
 * What counted today for one exercise, and what was a record against that line's earlier sessions.
 * "Heavier" means less assistance on assisted lines. A first-ever session is labelled first time, never a record.
 */
export function summarizeExercise(setup: SetupType, today: LoggedSet[], prior: LoggedSet[]): ExerciseSummary {
  const counted = today.filter(isTrustedWorkingSet);
  const priorWork = prior.filter(isTrustedWorkingSet);
  const top = counted.length
    ? counted.reduce((best, s) => (harder(setup, s.load, best.load) ? s : best), counted[0]!)
    : null;
  const topLoad = top?.load ?? null;
  const topReps = topLoad === null ? null : Math.max(...counted.filter((s) => Math.abs(s.load - topLoad) < 1e-6).map((s) => s.reps));
  const records: RecordKind[] = [];
  const firstTime = priorWork.length === 0;
  if (topLoad !== null && topReps !== null && !firstTime) {
    const priorBestLoad = priorWork.reduce((b, s) => (harder(setup, s.load, b) ? s.load : b), priorWork[0]!.load);
    if (harder(setup, topLoad, priorBestLoad)) records.push("load");
    else {
      // Same load as before: more reps than ever at exactly that load. No earlier sets at that load, nothing to compare.
      const sameLoad = priorWork.filter((s) => Math.abs(s.load - topLoad) < 1e-6);
      if (sameLoad.length > 0 && topReps > Math.max(...sameLoad.map((s) => s.reps))) records.push("reps_at_load");
    }
  }
  return {
    counted: counted.length,
    warmups: today.filter((s) => s.warmup).length,
    dropSets: today.filter((s) => !s.warmup && s.tags?.includes("drop")).length,
    unconfirmed: today.filter((s) => !s.warmup && s.outlierStatus === "unconfirmed").length,
    top: top && topReps !== null ? { load: top.load, reps: topReps } : null,
    records,
    firstTime,
  };
}
