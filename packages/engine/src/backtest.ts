import { equipmentFromTitle, toLoggedSets, type HevyWorkout } from "./hevy";
import { bodyRegionFromTitle } from "./policy";
import { proposeNext } from "./progression";
import type { Currency, EquipmentType, ExerciseSpec, GymFingerprint, HistorySession, LiftProgressionConfig, LineIdentity, RepRange } from "./types";

/**
 * Walk-forward check of the rule against a lifter's own history: for each session of a lift, propose from everything
 * BEFORE it, then compare with what the lifter actually did. This measures agreement with the lifter, not correctness:
 * a lifter who under- or over-reaches will "disagree" with a sensible rule.
 *
 * ASSUMPTIONS (stated, never hidden): a Hevy export does not contain the gym's real loads. The load grid for each
 * equipment class is INFERRED as the greatest common divisor of every load the lifter has logged in that class.
 * The rep range is NOT in the export either; a single default is applied and varied as a sensitivity check.
 */

const SCALE = 4;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export function gcdOfLoads(loads: number[]): number | null {
  const ints = [...new Set(loads.filter((l) => l > 0).map((l) => Math.round(l * SCALE)))];
  if (ints.length === 0) return null;
  return ints.reduce(gcd) / SCALE;
}

export interface ExerciseSeries {
  title: string;
  equipment: EquipmentType | null;
  setup: "free" | "bodyweight_plus_added";
  sessions: { performedAt: string; workoutTitle: string; sets: ReturnType<typeof toLoggedSets> }[];
}

/** One series per Hevy exercise title. Lines with no weight at all are treated as bodyweight (added load 0). Timed-only exercises are dropped. */
export function seriesFromWorkouts(workouts: HevyWorkout[]): { series: ExerciseSeries[]; skipped: { title: string; reason: string }[] } {
  const map = new Map<string, ExerciseSeries>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      const sets = toLoggedSets(e.sets);
      if (sets.length === 0) continue;
      let s = map.get(e.title);
      if (!s) {
        s = { title: e.title, equipment: equipmentFromTitle(e.title), setup: "free", sessions: [] };
        map.set(e.title, s);
      }
      s.sessions.push({ performedAt: w.startTime, workoutTitle: w.title, sets });
    }
  }
  const skipped: { title: string; reason: string }[] = [];
  const series: ExerciseSeries[] = [];
  const timedOnly = new Set<string>();
  for (const w of workouts) for (const e of w.exercises) if (!map.has(e.title)) timedOnly.add(e.title);
  for (const t of timedOnly) skipped.push({ title: t, reason: "no reps logged (timed or distance only)" });
  for (const s of map.values()) {
    const anyWeight = s.sessions.some((x) => x.sets.some((y) => y.load > 0));
    if (!anyWeight) s.setup = "bodyweight_plus_added";
    series.push(s);
  }
  return { series, skipped };
}

export interface InferredGrid {
  /** Key is the equipment class, or the exercise title for exercises whose title has no equipment suffix. */
  key: string;
  increment: number;
  basedOnLoads: number;
}

export function inferGrids(series: ExerciseSeries[]): Map<string, InferredGrid> {
  const classLoads = new Map<string, number[]>();
  const keyOf = (s: ExerciseSeries) => s.equipment ?? `title:${s.title}`;
  for (const s of series) {
    const arr = classLoads.get(keyOf(s)) ?? [];
    for (const x of s.sessions) for (const y of x.sets) if (y.load > 0 && !y.tags?.includes("drop")) arr.push(y.load);
    classLoads.set(keyOf(s), arr);
  }
  const out = new Map<string, InferredGrid>();
  for (const [k, loads] of classLoads) {
    const inc = gcdOfLoads(loads);
    const distinct = new Set(loads).size;
    // Too few distinct loads (e.g. one) say nothing about the step: fall back to a plain 2.5 kg and label it.
    if (inc !== null) out.set(k, { key: k, increment: distinct < 3 ? 2.5 : inc, basedOnLoads: distinct });
  }
  return out;
}

export type Outcome = {
  title: string;
  at: string;
  status: "proposed" | "no_history" | "no_gym_loads";
  confidence: string;
  currency: Currency;
  lastLoad: number | null;
  lastReps: number | null;
  proposedLoad: number | null;
  proposedReps: number | null;
  actualLoad: number | null;
  actualReps: number | null;
  loadMatch: boolean;
  repsMatchAtLoad: boolean;
  exact: boolean;
  /** The lifter did at least what was proposed (same or heavier load; if same load, same or more reps). */
  metOrBeat: boolean;
  direction: "up" | "same" | "down";
  actualDirection: "up" | "same" | "down";
  sameAsLastLoad: boolean;
};

const dirOf = (a: number, b: number): "up" | "same" | "down" => (Math.abs(a - b) < 1e-6 ? "same" : a > b ? "up" : "down");

function actualTop(sets: ExerciseSeries["sessions"][number]["sets"]): { load: number; reps: number } | null {
  const w = sets.filter((s) => !s.warmup && !s.tags?.includes("drop"));
  if (w.length === 0) return null;
  const top = Math.max(...w.map((s) => s.load));
  const atTop = w.filter((s) => Math.abs(s.load - top) < 1e-6);
  return { load: top, reps: Math.min(...atTop.map((s) => s.reps)) };
}

export interface BacktestOptions {
  repRange: RepRange;
  /** Only lifts with at least this many sessions are evaluated. */
  minSessions: number;
  gymId?: string;
  /** Policy applied to every lift (preset / trigger / increment / stall). Body region is inferred from the exercise title. */
  progression?: LiftProgressionConfig;
}

export function backtest(workouts: HevyWorkout[], opts: BacktestOptions): { outcomes: Outcome[]; grids: InferredGrid[]; skipped: { title: string; reason: string }[] } {
  const { series, skipped } = seriesFromWorkouts(workouts);
  const grids = inferGrids(series);
  const gymId = opts.gymId ?? "hevy-inferred";
  const outcomes: Outcome[] = [];
  for (const s of series) {
    if (s.sessions.length < opts.minSessions) continue;
    const grid = grids.get(s.equipment ?? `title:${s.title}`);
    const equipment: EquipmentType = s.equipment ?? "machine";
    const setup = s.setup;
    const gym: GymFingerprint = {
      gymId,
      loads: [{ equipment: setup === "bodyweight_plus_added" ? "plate" : equipment, increment: grid?.increment ?? 2.5 }],
    };
    const exercise: ExerciseSpec = {
      exerciseId: s.title,
      equipment: setup === "bodyweight_plus_added" ? "plate" : equipment,
      setup,
      repRange: opts.repRange,
      bodyRegion: bodyRegionFromTitle(s.title),
      progression: opts.progression,
    };
    const line: LineIdentity = { exerciseId: s.title, gymId, setup };
    const hist: HistorySession[] = [];
    for (const [i, sess] of s.sessions.entries()) {
      const actual = actualTop(sess.sets);
      if (i >= 1 && actual) {
        const p = proposeNext({ exercise, gym, history: hist, asOf: sess.performedAt });
        const last = actualTop(s.sessions[i - 1]!.sets);
        const pl = p.load;
        const loadMatch = pl !== null && Math.abs(pl - actual.load) < 1e-6;
        const repsMatchAtLoad = loadMatch && p.reps === actual.reps;
        outcomes.push({
          title: s.title,
          at: sess.performedAt,
          status: p.status,
          confidence: p.confidence,
          currency: p.currency,
          lastLoad: last?.load ?? null,
          lastReps: last?.reps ?? null,
          proposedLoad: pl,
          proposedReps: p.reps,
          actualLoad: actual.load,
          actualReps: actual.reps,
          loadMatch,
          repsMatchAtLoad,
          exact: loadMatch && repsMatchAtLoad,
          metOrBeat: pl !== null && (actual.load > pl + 1e-6 || (loadMatch && actual.reps >= (p.reps ?? Infinity))),
          direction: pl !== null && last ? dirOf(pl, last.load) : "same",
          actualDirection: last ? dirOf(actual.load, last.load) : "same",
          sameAsLastLoad: last !== null && Math.abs(actual.load - last.load) < 1e-6,
        });
      }
      hist.push({ line, performedAt: sess.performedAt, sets: sess.sets });
    }
  }
  return { outcomes, grids: [...grids.values()], skipped };
}

export interface Summary {
  n: number;
  loadMatch: number;
  exact: number;
  metOrBeat: number;
  directionAgree: number;
  proposedAbove: number;
  proposedBelow: number;
  /** Baseline: "same load as last time" matches the lifter this often. */
  repeatLoadBaseline: number;
  /** Times the rule proposed a heavier load than last session / times the lifter actually used one. */
  proposedUp: number;
  actualUp: number;
  /** Rule held or lowered the load while the lifter went up (rule more conservative). */
  ruleConservative: number;
  /** Rule raised the load while the lifter stayed or went down (rule more aggressive). */
  ruleAggressive: number;
  /** Proposed a lower load than last session. */
  proposedDown: number;
  actualDown: number;
}

export function summarize(os: Outcome[]): Summary {
  const p = os.filter((o) => o.status === "proposed");
  const c = (f: (o: Outcome) => boolean) => p.filter(f).length;
  return {
    n: p.length,
    loadMatch: c((o) => o.loadMatch),
    exact: c((o) => o.exact),
    metOrBeat: c((o) => o.metOrBeat),
    directionAgree: c((o) => o.direction === o.actualDirection),
    proposedAbove: c((o) => o.proposedLoad! > o.actualLoad! + 1e-6),
    proposedBelow: c((o) => o.proposedLoad! < o.actualLoad! - 1e-6),
    repeatLoadBaseline: c((o) => o.sameAsLastLoad),
    proposedUp: c((o) => o.direction === "up"),
    actualUp: c((o) => o.actualDirection === "up"),
    ruleConservative: c((o) => o.direction !== "up" && o.actualDirection === "up"),
    ruleAggressive: c((o) => o.direction === "up" && o.actualDirection !== "up"),
    proposedDown: c((o) => o.direction === "down"),
    actualDown: c((o) => o.actualDirection === "down"),
  };
}
