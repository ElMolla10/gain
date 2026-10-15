import { isTrustedWorkingSet, quantityOf, MAX_PLAUSIBLE_REPS, MAX_SECONDS, MAX_METRES, type LoggedSet, type Measure, type SetupType } from "@gain/engine";
const quantity = (s: LoggedSet, m: Measure) => m === "reps" ? s.reps : quantityOf(s, m);
export interface PersonalMilestone { load: number; quantity: number; previous: number; progress: number; reached: boolean }
/** Same-load personal milestone, never a prescription to exceed today's target. */
export function personalMilestone(history: readonly LoggedSet[], today: readonly LoggedSet[], load: number | null, measure: Measure = "reps"): PersonalMilestone | null {
  if (load === null || !Number.isFinite(load)) return null;
  const quantities = (sets: readonly LoggedSet[]) => sets.filter(s => isTrustedWorkingSet(s) && Math.abs(s.load - load) < 1e-6).map(s => quantity(s, measure)).filter((n): n is number => n !== null && Number.isFinite(n) && n > 0);
  const before = quantities(history);
  if (!before.length) return null;
  const previous = Math.max(...before);
  const nextQuantity = previous + (measure === "time" ? 5 : 1);
  const max = measure === "reps" ? MAX_PLAUSIBLE_REPS : measure === "time" ? MAX_SECONDS : MAX_METRES;
  if (nextQuantity > max) return null;
  const current = Math.max(0, ...quantities(today));
  return { load, quantity: nextQuantity, previous, progress: Math.min(1, current / nextQuantity), reached: current >= nextQuantity };
}
export function personalTop(sets: readonly LoggedSet[], setup: SetupType, measure: Measure = "reps") {
  const valid = sets.filter(s => isTrustedWorkingSet(s) && (quantity(s, measure) ?? 0) > 0);
  if (!valid.length) return null;
  const load = valid.reduce((b, s) => setup === "assisted" ? Math.min(b, s.load) : Math.max(b, s.load), valid[0]!.load);
  return { load, quantity: Math.max(...valid.filter(s => Math.abs(s.load - load) < 1e-6).map(s => quantity(s, measure)!)) };
}
export interface ConsistencyProgress { done: number; goal: number | null; achieved: boolean; activeDays: number; totalSessions: number; level: number }
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
  return { done: days.size, goal: validGoal, achieved: validGoal !== null && days.size >= validGoal, activeDays: allDays.size, totalSessions: sessions.filter(s => Number.isFinite(s.finishedAt) && s.finishedAt <= now).length, level };
}
