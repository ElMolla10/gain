import { isTrustedWorkingSet, quantityOf, MAX_PLAUSIBLE_REPS, MAX_SECONDS, MAX_METRES, type LoggedSet, type Measure, type SetupType } from "@gain/engine";
import { nextLoadAbove, type GymLoadSpec } from "@gain/engine";
const quantity = (s: LoggedSet, m: Measure) => m === "reps" ? s.reps : quantityOf(s, m);
export interface MilestoneSession { performedAt: string; sets: LoggedSet[] }
export interface PersonalMilestone { load: number; quantity: number; baselineLoad: number; previous: number; progress: number; reached: boolean }
const strength = (load: number, reps: number) => load * (1 + reps / 30);
/** A fixed goal for the current calendar month, derived from the strongest trusted baseline available at its start. */
export function personalMilestone(history: readonly MilestoneSession[], today: readonly LoggedSet[], spec: GymLoadSpec | null, measure: Measure = "reps", repMin = 6, repMax = 12, now = Date.now()): PersonalMilestone | null {
  const start = new Date(now); start.setDate(1); start.setHours(0, 0, 0, 0);
  const dated = history.map(h => ({ time: Date.parse(h.performedAt), sets: h.sets }))
    .filter(h => Number.isFinite(h.time) && h.time <= now).sort((a, b) => a.time - b.time);
  // If the exercise is new this month, its first completed session establishes the baseline.
  const trustedSession = (h: { sets: LoggedSet[] }) => h.sets.some(s => isTrustedWorkingSet(s) && (quantity(s, measure) ?? 0) > 0);
  const earlier = dated.filter(h => h.time < start.getTime() && h.time >= start.getTime() - 90 * 86400000 && trustedSession(h));
  const baselineSessions = earlier.length ? earlier : dated.filter(h => h.time >= start.getTime() && trustedSession(h)).slice(0, 1);
  const valid = baselineSessions.flatMap(h => h.sets).filter(s => isTrustedWorkingSet(s) &&
    Number.isFinite(s.load) && s.load >= 0 && (quantity(s, measure) ?? 0) > 0);
  if (!valid.length) return null;
  const max = measure === "reps" ? MAX_PLAUSIBLE_REPS : measure === "time" ? MAX_SECONDS : MAX_METRES;
  if (measure !== "reps") {
    const best = valid.reduce((a, b) => (quantity(b, measure) ?? 0) > (quantity(a, measure) ?? 0) ? b : a);
    const previous = quantity(best, measure)!;
    const step = 5;
    const goal = Math.ceil(previous * 1.2 / step) * step;
    if (goal <= previous || goal > max) return null;
    const current = Math.max(previous, ...dated.filter(h => h.time >= start.getTime()).flatMap(h => h.sets).concat(today)
      .filter(s => isTrustedWorkingSet(s) && Math.abs(s.load - best.load) < 1e-6)
      .map(s => quantity(s, measure) ?? 0));
    return { load: best.load, quantity: goal, baselineLoad: best.load, previous, progress: Math.min(1, (current - previous) / (goal - previous)), reached: current >= goal };
  }
  const working = valid.filter(s => s.reps !== null && s.reps !== undefined && s.reps <= 15);
  if (!working.length) return null;
  const best = working.reduce((a, b) => strength(b.load, b.reps!) > strength(a.load, a.reps!) ? b : a);
  const previous = best.reps!;
  const baseline = strength(best.load, previous);
  const lower = Math.max(1, Math.min(30, repMin));
  const upper = Math.min(15, Math.max(lower, repMax));
  const desired = baseline * 1.06;
  let load = best.load;
  let goal = load > 0 ? Math.max(previous + 3, Math.ceil(30 * (desired / load - 1))) : previous + 3;
  if (spec && best.load > 0) {
    const next = nextLoadAbove(spec, best.load);
    if (next !== null) {
      const reps = Math.max(lower, Math.ceil(30 * (desired / next - 1)));
      if (reps <= upper && strength(next, reps) <= baseline * 1.2) { load = next; goal = reps; }
    }
  }
  if (goal > upper || goal > max || (load === best.load && goal < lower)) return null;
  const current = Math.max(baseline, ...dated.filter(h => h.time >= start.getTime()).flatMap(h => h.sets).concat(today)
    .filter(s => isTrustedWorkingSet(s) && s.reps !== null && s.reps !== undefined && s.reps <= 15)
    .map(s => strength(s.load, s.reps!)));
  const target = best.load === 0 ? goal : strength(load, goal);
  const origin = best.load === 0 ? previous : baseline;
  const achieved = best.load === 0 ? Math.max(previous, ...dated.filter(h => h.time >= start.getTime()).flatMap(h => h.sets).concat(today).filter(s => isTrustedWorkingSet(s) && s.load === 0).map(s => s.reps ?? 0)) : current;
  const reached = dated.filter(h => h.time >= start.getTime()).flatMap(h => h.sets).concat(today)
    .some(s => isTrustedWorkingSet(s) && s.load >= load - 1e-6 && (s.reps ?? 0) >= goal);
  return { load, quantity: goal, baselineLoad: best.load, previous, progress: reached ? 1 : Math.min(0.95, Math.max(0, (achieved - origin) / (target - origin))), reached };
}
export function personalTop(sets: readonly LoggedSet[], setup: SetupType, measure: Measure = "reps") {
  const valid = sets.filter(s => isTrustedWorkingSet(s) && (quantity(s, measure) ?? 0) > 0);
  if (!valid.length) return null;
  const load = valid.reduce((b, s) => setup === "assisted" ? Math.min(b, s.load) : Math.max(b, s.load), valid[0]!.load);
  return { load, quantity: Math.max(...valid.filter(s => Math.abs(s.load - load) < 1e-6).map(s => quantity(s, measure)!)) };
}
export interface ConsistencyProgress { done: number; goal: number | null; achieved: boolean; activeDays: number; totalSessions: number; level: number; startsOn: number }
/** Distinct local training days; calendar boundaries follow the device, including DST. */
export function consistencyProgress(sessions: { finishedAt: number }[], now: number, goal: number | null, startsOn = 1): ConsistencyProgress {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (start.getDay() - startsOn + 7) % 7);
  const days = new Set<string>(); const allDays = new Set<string>();
  for (const s of sessions) {
    if (!Number.isFinite(s.finishedAt) || s.finishedAt > now) continue;
    const d = new Date(s.finishedAt); const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    allDays.add(key); if (s.finishedAt >= start.getTime()) days.add(key);
  }
  const validGoal = goal !== null && Number.isInteger(goal) && goal >= 1 && goal <= 7 ? goal : null;
  const level = [1, 5, 10, 25, 50, 100, 250, 500].filter(n => allDays.size >= n).at(-1) ?? 0;
  return { done: days.size, goal: validGoal, achieved: validGoal !== null && days.size >= validGoal, activeDays: allDays.size, totalSessions: sessions.filter(s => Number.isFinite(s.finishedAt) && s.finishedAt <= now).length, level, startsOn };
}
