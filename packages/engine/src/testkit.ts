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

export const exDb = (over: Partial<ExerciseSpec> = {}): ExerciseSpec => ({
  exerciseId: "db-press",
  equipment: "dumbbell",
  setup: "free",
  repRange: { min: 8, max: 12 },
  ...over,
});

export const exBar = (over: Partial<ExerciseSpec> = {}): ExerciseSpec => ({
  exerciseId: "bench",
  equipment: "barbell",
  setup: "free",
  repRange: { min: 6, max: 10 },
  ...over,
});

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
