/** Test helpers. SYNTHETIC data only: invented gym and sessions for unit tests. */
import type { ExerciseSpec, GymFingerprint, HistorySession, LineIdentity, LoggedSet, SetupType } from "./types";

export const DB_RACK = [10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40];

export const gymA: GymFingerprint = {
  gymId: "gymA",
  loads: [
    { equipment: "dumbbell", loads: DB_RACK },
    { equipment: "barbell", increment: 2.5, min: 20 },
    { equipment: "plate", increment: 2.5 },
    { equipment: "cable", increment: 5 },
    { equipment: "machine", increment: 5, min: 5, max: 100 },
    { equipment: "assisted", increment: 5, min: 0, max: 80 },
  ],
};

export const ASOF = "2026-10-02";

export const lineOf = (exerciseId: string, setup: SetupType = "free", gymId = "gymA"): LineIdentity => ({
  exerciseId,
  gymId,
  setup,
});

/**
 * Test specs pin the rep ceiling to the top of their rep range (so a test says "8-12" and means it), use a 2-5% step band with `oversizedStep: "spend_first"`
 * (so a 2.5 kg jump on 30 kg is "too big" and the currency-order tests stay meaningful) and switch step-down on (3 misses).
 * The shipped defaults (name-based ceilings 10 / 12 / 15, ACSM 2-10%, one session, no extra conventions) are tested in
 * ceilings.test.ts and policy.test.ts, which do not use these helpers.
 */
const pinned = (over: Partial<ExerciseSpec>, base: ExerciseSpec): ExerciseSpec => {
  const spec = { ...base, ...over };
  // A test that names a preset gets that preset's own band and conventions; the 2-5% / step-down pins are for the preset-less tests.
  const legacy = spec.progression?.preset ? {} : { increment: { minPct: 0.02, maxPct: 0.05 }, oversizedStep: "spend_first" as const, stepDownAfterMisses: 3 };
  return { ...spec, progression: { repCeiling: spec.repRange.max, ...legacy, ...spec.progression } };
};

export const exDb = (over: Partial<ExerciseSpec> = {}): ExerciseSpec =>
  pinned(over, { exerciseId: "db-press", equipment: "dumbbell", setup: "free", repRange: { min: 8, max: 12 } });

export const exBar = (over: Partial<ExerciseSpec> = {}): ExerciseSpec =>
  pinned(over, { exerciseId: "bench", equipment: "barbell", setup: "free", repRange: { min: 6, max: 10 } });

export const S = (load: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...extra });

/** n identical working sets. */
export const sets = (load: number, reps: number, n = 3, extra: Partial<LoggedSet> = {}): LoggedSet[] =>
  Array.from({ length: n }, () => S(load, reps, extra));

export const session = (line: LineIdentity, performedAt: string, ss: LoggedSet[]): HistorySession => ({
  line,
  performedAt,
  sets: ss,
});

/** Three sessions a few days apart, oldest first, same load, given reps per session. */
export const run = (line: LineIdentity, load: number, repsPerSession: number[], lastDate = "2026-09-30"): HistorySession[] => {
  const end = Date.parse(lastDate);
  return repsPerSession.map((reps, i) =>
    session(line, new Date(end - (repsPerSession.length - 1 - i) * 3 * 86_400_000).toISOString().slice(0, 10), sets(load, reps)),
  );
};
