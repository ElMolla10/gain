import type { ProgrammeDraft } from "./programmeDraft";

/**
 * Weekly exposure: how many hard sets and how many sessions each muscle group gets in a normal week of this programme.
 * It is arithmetic on the programme, nothing more. Each exercise counts once, under its main movement pattern
 * (a squat is counted as quads, not also glutes), and the app does NOT say whether a number is enough.
 */
export type MuscleGroup = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "quads" | "hamstrings" | "calves" | "other";

export const MUSCLE_GROUPS: MuscleGroup[] = ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "calves", "other"];

/** The movement patterns an exercise can have in the library (and that a lifter picks for their own exercises). */
export const PATTERNS = [
  "horizontal_push",
  "incline_push",
  "vertical_push",
  "shoulder_isolation",
  "rear_delt",
  "elbow_extension",
  "vertical_pull",
  "horizontal_pull",
  "elbow_flexion",
  "squat",
  "knee_extension",
  "hinge",
  "knee_flexion",
  "calf",
  "other",
] as const;
export type Pattern = (typeof PATTERNS)[number];

const GROUP_OF: Record<Pattern, MuscleGroup> = {
  horizontal_push: "chest",
  incline_push: "chest",
  vertical_push: "shoulders",
  shoulder_isolation: "shoulders",
  rear_delt: "shoulders",
  elbow_extension: "triceps",
  vertical_pull: "back",
  horizontal_pull: "back",
  elbow_flexion: "biceps",
  squat: "quads",
  knee_extension: "quads",
  hinge: "hamstrings",
  knee_flexion: "hamstrings",
  calf: "calves",
  other: "other",
};

export const groupOfPattern = (pattern: string): MuscleGroup => GROUP_OF[pattern as Pattern] ?? "other";

export interface ExposureRow {
  group: MuscleGroup;
  /** Sets over one full rotation of the programme's days. */
  setsPerRotation: number;
  /** Days of the rotation that train the group at least once. */
  daysPerRotation: number;
  /** Per normal week. Null when the lifter has not said how many days they train. */
  setsPerWeek: number | null;
  sessionsPerWeek: number | null;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * `daysPerWeek` is how many days the lifter trains. A rotation of N programme days takes N / daysPerWeek weeks,
 * so weekly numbers are the rotation numbers scaled by daysPerWeek / N. Unknown daysPerWeek: no weekly numbers are made up.
 */
export function computeExposure(draft: ProgrammeDraft, patternOf: (exerciseId: string) => string | undefined, daysPerWeek: number | null): ExposureRow[] {
  const n = draft.days.length;
  const scale = n > 0 && daysPerWeek !== null && daysPerWeek > 0 ? daysPerWeek / n : null;
  const sets = new Map<MuscleGroup, number>();
  const days = new Map<MuscleGroup, number>();
  for (const day of draft.days) {
    const seen = new Set<MuscleGroup>();
    for (const e of day.exercises) {
      const g = groupOfPattern(patternOf(e.exerciseId) ?? "other");
      sets.set(g, (sets.get(g) ?? 0) + e.sets);
      seen.add(g);
    }
    for (const g of seen) days.set(g, (days.get(g) ?? 0) + 1);
  }
  return MUSCLE_GROUPS.filter((g) => sets.has(g)).map((g) => ({
    group: g,
    setsPerRotation: sets.get(g)!,
    daysPerRotation: days.get(g) ?? 0,
    setsPerWeek: scale === null ? null : round1(sets.get(g)! * scale),
    sessionsPerWeek: scale === null ? null : round1((days.get(g) ?? 0) * scale),
  }));
}

export interface ExposureChange {
  group: MuscleGroup;
  before: ExposureRow | null;
  after: ExposureRow | null;
  /** after - before in sets per week (or per rotation when weekly numbers are unknown). */
  deltaSets: number;
  deltaSessions: number | null;
  kind: "added" | "removed" | "up" | "down" | "same";
}

/** What an edit does to exposure: only groups that changed are returned. */
export function diffExposure(before: ExposureRow[], after: ExposureRow[]): ExposureChange[] {
  const b = new Map(before.map((r) => [r.group, r]));
  const a = new Map(after.map((r) => [r.group, r]));
  const out: ExposureChange[] = [];
  for (const g of MUSCLE_GROUPS) {
    const rb = b.get(g) ?? null;
    const ra = a.get(g) ?? null;
    if (!rb && !ra) continue;
    const sb = rb ? (rb.setsPerWeek ?? rb.setsPerRotation) : 0;
    const sa = ra ? (ra.setsPerWeek ?? ra.setsPerRotation) : 0;
    const xb = rb ? (rb.sessionsPerWeek ?? rb.daysPerRotation) : 0;
    const xa = ra ? (ra.sessionsPerWeek ?? ra.daysPerRotation) : 0;
    const deltaSets = round1(sa - sb);
    const deltaSessions = round1(xa - xb);
    const kind: ExposureChange["kind"] = !rb ? "added" : !ra ? "removed" : deltaSets > 0 ? "up" : deltaSets < 0 ? "down" : deltaSessions !== 0 ? (deltaSessions > 0 ? "up" : "down") : "same";
    if (kind === "same") continue;
    out.push({ group: g, before: rb, after: ra, deltaSets, deltaSessions: rb && ra ? deltaSessions : null, kind });
  }
  return out;
}

/** How many times each goal lift is trained per rotation (goal lifts keep their exposure, so the editor warns when it drops). */
export function goalLiftFrequency(draft: ProgrammeDraft): Map<string, number> {
  const m = new Map<string, number>();
  for (const day of draft.days) for (const e of day.exercises) if (e.isGoalLift) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1);
  return m;
}
