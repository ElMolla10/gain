import { estimateSessionMinutes } from "./templates";
import { groupOfPattern, type MuscleGroup } from "./exposure";
import type { DraftDay, DraftExercise, ProgrammeDraft } from "./programmeDraft";

/**
 * Short-week rebuild: "I can train D days" and/or "I have M minutes" turns the normal programme into a smaller one for ONE week.
 * Pure functions, no I/O. Nothing is cut silently: every cut is returned in `cuts` so the lifter sees the list before saving.
 *
 * Rules, in order of what is protected most:
 *  1. Goal lifts (exercises flagged as goal lifts) are never removed while any accessory can still go. A goal lift on a dropped day
 *     moves to a kept day. Only as a last resort are a goal lift's sets trimmed, and never below 3 sets.
 *  2. Priority muscles (the muscle of a goal lift, or the lifter's muscle goal) keep a weekly floor: at least min(original, 6) sets
 *     and at least min(original, 2) sessions. Accessories of those muscles are cut only after accessories of other muscles.
 *  3. Accessories go from the end of each day (the lifter's own order is their priority): first other muscles' exercises, then sets
 *     are trimmed to 2, then priority-muscle accessories (if the floor holds).
 *  4. Rest is not crushed: the rebuild never packs a dropped day's work into a kept day beyond the time budget, and it does not touch
 *     rest times between sets. If the budget cannot be met without cutting goal lifts, `overBudget` says so instead of cutting them.
 */
export const FLOOR_SETS = 6;
export const FLOOR_SESSIONS = 2;
export const MIN_ACCESSORY_SETS = 2;
export const MIN_GOAL_SETS = 3;

export interface RebuildOptions {
  /** Days the lifter can train this week: 1 .. number of programme days. */
  days: number;
  /** Minutes per session, or null for no limit. Estimated at 3 minutes per set, like the rest of the app. */
  minutes: number | null;
  patternOf: (exerciseId: string) => string | undefined;
  /** Muscles to protect besides the goal lifts' muscles (a muscle goal). */
  extraPriority?: MuscleGroup[];
}

export type CutKind = "day_dropped" | "exercise_removed" | "sets_reduced" | "moved";
export interface Cut {
  kind: CutKind;
  /** The day name in the ORIGINAL programme. */
  day: string;
  exerciseId?: string;
  fromSets?: number;
  toSets?: number;
  /** For moved: the kept day it went to. */
  toDay?: string;
  reason: "days" | "time" | "floor";
}

export interface Rebuild {
  draft: ProgrammeDraft;
  cuts: Cut[];
  /** True if a session is still over the minutes budget because only protected work is left. */
  overBudget: boolean;
  /** Per kept day, the estimated minutes. */
  minutes: number[];
  /** Priority muscle floors that could not be met (nothing left to move). */
  floorMissed: MuscleGroup[];
}

export type RebuildError = "days_bad" | "minutes_bad" | "empty";

const clone = (d: ProgrammeDraft): ProgrammeDraft => ({ ...d, days: d.days.map((day) => ({ ...day, exercises: day.exercises.map((e) => ({ ...e })) })) });
const setsOf = (day: DraftDay) => day.exercises.reduce((n, e) => n + e.sets, 0);

export function rebuildShortWeek(original: ProgrammeDraft, o: RebuildOptions): Rebuild | RebuildError {
  const N = original.days.length;
  if (N === 0) return "empty";
  if (!Number.isInteger(o.days) || o.days < 1 || o.days > N) return "days_bad";
  if (o.minutes !== null && (!Number.isFinite(o.minutes) || o.minutes < 10)) return "minutes_bad";
  const group = (id: string) => groupOfPattern(o.patternOf(id) ?? "other");
  const priority = new Set<MuscleGroup>(o.extraPriority ?? []);
  for (const day of original.days) for (const e of day.exercises) if (e.isGoalLift) priority.add(group(e.exerciseId));
  priority.delete("other");

  const cuts: Cut[] = [];
  const work = clone(original);
  const origName = original.days.map((d) => d.name);

  // Original floors per priority muscle.
  const groupSets = (d: ProgrammeDraft, g: MuscleGroup) => d.days.reduce((n, day) => n + day.exercises.filter((e) => group(e.exerciseId) === g).reduce((m, e) => m + e.sets, 0), 0);
  const groupDays = (d: ProgrammeDraft, g: MuscleGroup) => d.days.filter((day) => day.exercises.some((e) => group(e.exerciseId) === g)).length;
  const floors = new Map<MuscleGroup, { sets: number; days: number }>();
  for (const g of priority) floors.set(g, { sets: Math.min(groupSets(original, g), FLOOR_SETS), days: Math.min(groupDays(original, g), FLOOR_SESSIONS) });
  const floorHolds = (d: ProgrammeDraft, g: MuscleGroup) => {
    const f = floors.get(g);
    return !f || (groupSets(d, g) >= f.sets && groupDays(d, g) >= f.days);
  };

  // 1. Which days stay: most goal lifts, then most priority-muscle sets, then original order.
  let keptIdx = original.days.map((_, i) => i);
  if (o.days < N) {
    const score = (day: DraftDay) => [day.exercises.filter((e) => e.isGoalLift).length, day.exercises.filter((e) => priority.has(group(e.exerciseId))).reduce((n, e) => n + e.sets, 0)];
    keptIdx = [...keptIdx]
      .sort((a, b) => {
        const sa = score(original.days[a]!);
        const sb = score(original.days[b]!);
        return sb[0]! - sa[0]! || sb[1]! - sa[1]! || a - b;
      })
      .slice(0, o.days)
      .sort((a, b) => a - b);
  }
  const droppedIdx = original.days.map((_, i) => i).filter((i) => !keptIdx.includes(i));
  const kept: { orig: number; day: DraftDay }[] = keptIdx.map((i) => ({ orig: i, day: work.days[i]! }));
  const has = (id: string) => kept.some((k) => k.day.exercises.some((e) => e.exerciseId === id));
  const lightest = () => kept.reduce((a, b) => (setsOf(b.day) < setsOf(a.day) ? b : a));

  // 2. Goal lifts on dropped days move to a kept day (the lightest one); never lost with the day.
  for (const di of droppedIdx) {
    for (const e of work.days[di]!.exercises.filter((x) => x.isGoalLift)) {
      if (has(e.exerciseId)) continue;
      const target = lightest();
      target.day.exercises.push({ ...e });
      cuts.push({ kind: "moved", day: origName[di]!, exerciseId: e.exerciseId, toDay: target.day.name, toSets: e.sets, reason: "days" });
    }
  }
  // 3. Priority-muscle floors: move accessories of that muscle from dropped days until the floor holds (largest first), to the lightest kept day that does not have it.
  const moved = (di: number, e: DraftExercise) => work.days[di]!.exercises.some((x) => x === e);
  const keptDraft = (): ProgrammeDraft => ({ name: work.name, days: kept.map((k) => k.day) });
  const floorMissed: MuscleGroup[] = [];
  for (const g of priority) {
    const candidates = droppedIdx.flatMap((di) => work.days[di]!.exercises.filter((e) => !e.isGoalLift && group(e.exerciseId) === g).map((e) => ({ di, e }))).sort((a, b) => b.e.sets - a.e.sets);
    for (const c of candidates) {
      if (floorHolds(keptDraft(), g)) break;
      if (!moved(c.di, c.e) || has(c.e.exerciseId)) continue;
      const pool = kept.filter((k) => !k.day.exercises.some((x) => x.exerciseId === c.e.exerciseId));
      if (pool.length === 0) continue;
      const target = pool.reduce((a, b) => (setsOf(b.day) < setsOf(a.day) ? b : a));
      target.day.exercises.push({ ...c.e });
      cuts.push({ kind: "moved", day: origName[c.di]!, exerciseId: c.e.exerciseId, toDay: target.day.name, toSets: c.e.sets, reason: "floor" });
    }
  }
  // Everything else on dropped days is cut, and the cut list says so.
  for (const di of droppedIdx) {
    cuts.push({ kind: "day_dropped", day: origName[di]!, reason: "days" });
    for (const e of work.days[di]!.exercises) {
      if (cuts.some((c) => c.kind === "moved" && c.day === origName[di] && c.exerciseId === e.exerciseId)) continue;
      cuts.push({ kind: "exercise_removed", day: origName[di]!, exerciseId: e.exerciseId, fromSets: e.sets, reason: "days" });
    }
  }

  // 4. Time budget per kept day.
  let overBudget = false;
  const budget = o.minutes;
  if (budget !== null) {
    for (const k of kept) {
      const over = () => estimateSessionMinutes(setsOf(k.day)) > budget;
      const dayName = origName[k.orig]!;
      const fits = (mutate: (d: ProgrammeDraft) => void) => {
        // Applies a change to a copy of the kept draft and reports whether every priority floor still holds.
        // A floor that is ALREADY unmet and cannot be met (e.g. "2 sessions" of a muscle when only 1 day is kept) must not block every
        // cut of that muscle's accessories: it would push the cuts onto the goal lift. For such a floor the change must not make it worse.
        const before = keptDraft();
        const c = clone(before);
        mutate(c);
        return [...priority].every((g) => {
          if (floorHolds(c, g)) return true;
          const f = floors.get(g)!;
          return groupSets(c, g) >= Math.min(f.sets, groupSets(before, g)) && groupDays(c, g) >= Math.min(f.days, groupDays(before, g));
        });
      };
      const lastIndex = (pred: (e: DraftExercise) => boolean) => {
        for (let i = k.day.exercises.length - 1; i >= 0; i--) if (pred(k.day.exercises[i]!)) return i;
        return -1;
      };
      while (over()) {
        // Tier 1: remove the last accessory of a non-priority muscle.
        let i = lastIndex((e) => !e.isGoalLift && !priority.has(group(e.exerciseId)));
        if (i >= 0) {
          const e = k.day.exercises[i]!;
          cuts.push({ kind: "exercise_removed", day: dayName, exerciseId: e.exerciseId, fromSets: e.sets, reason: "time" });
          k.day.exercises.splice(i, 1);
          continue;
        }
        // Tier 2: trim an accessory with more than 2 sets (last first) while its muscle's floor holds.
        i = lastIndex((e) => !e.isGoalLift && e.sets > MIN_ACCESSORY_SETS && fits((d) => void (d.days[kept.indexOf(k)]!.exercises[k.day.exercises.indexOf(e)]!.sets -= 1)));
        if (i >= 0) {
          const e = k.day.exercises[i]!;
          const prev = cuts.find((c) => c.kind === "sets_reduced" && c.day === dayName && c.exerciseId === e.exerciseId);
          if (prev) prev.toSets = e.sets - 1;
          else cuts.push({ kind: "sets_reduced", day: dayName, exerciseId: e.exerciseId, fromSets: e.sets, toSets: e.sets - 1, reason: "time" });
          e.sets -= 1;
          continue;
        }
        // Tier 3: remove the last priority-muscle accessory, only if the floor holds without it.
        i = lastIndex((e) => !e.isGoalLift && fits((d) => void d.days[kept.indexOf(k)]!.exercises.splice(k.day.exercises.indexOf(e), 1)));
        if (i >= 0) {
          const e = k.day.exercises[i]!;
          cuts.push({ kind: "exercise_removed", day: dayName, exerciseId: e.exerciseId, fromSets: e.sets, reason: "time" });
          k.day.exercises.splice(i, 1);
          continue;
        }
        // Tier 4 (last resort): trim a goal lift's sets, never below 3.
        i = lastIndex((e) => e.isGoalLift && e.sets > MIN_GOAL_SETS);
        if (i >= 0) {
          const e = k.day.exercises[i]!;
          const prev = cuts.find((c) => c.kind === "sets_reduced" && c.day === dayName && c.exerciseId === e.exerciseId);
          if (prev) prev.toSets = e.sets - 1;
          else cuts.push({ kind: "sets_reduced", day: dayName, exerciseId: e.exerciseId, fromSets: e.sets, toSets: e.sets - 1, reason: "time" });
          e.sets -= 1;
          continue;
        }
        overBudget = true;
        break;
      }
    }
  }

  for (const g of priority) if (!floorHolds(keptDraft(), g)) floorMissed.push(g);
  const draft = { name: original.name, days: kept.map((k) => k.day) };
  return { draft, cuts, overBudget, minutes: draft.days.map((d) => estimateSessionMinutes(setsOf(d))), floorMissed };
}
