import { epley } from "./line";
import { heaviestSet } from "./liftStats";
import { isTrustedWorkingSet } from "./outlier";
import type { HistorySession, LoggedSet, SetupType } from "./types";

const DAY_MS = 86_400_000;
const MONTH_MS = 30 * DAY_MS;
/** Rest days of up to a week do not break the count; a gap longer than this does. */
export const STREAK_MAX_GAP_DAYS = 8;

export type SessionFactKind = "load" | "reps_at_load" | "rep" | "e1rm";

export interface SessionFact {
  kind: SessionFactKind;
  load: number;
  reps: number;
  /** Present on estimated-1RM facts only. */
  e1rm?: number;
}

const harderLoad = (setup: SetupType, a: number, b: number): boolean => (setup === "assisted" ? a < b : a > b);

function trusted(sets: LoggedSet[]): LoggedSet[] {
  return sets.filter((s) => isTrustedWorkingSet(s) && s.reps >= 1 && Number.isFinite(s.load));
}

function topOf(sets: LoggedSet[], setup: SetupType): LoggedSet | null {
  const work = trusted(sets);
  if (work.length === 0) return null;
  return work.reduce((best, s) => (harderLoad(setup, s.load, best.load) || (s.load === best.load && s.reps > best.reps) ? s : best), work[0]!);
}

/**
 * Factual records of today's trusted working sets against earlier ones on the same line.
 * First-ever session yields nothing. Estimated 1RM is a separate kind so it is never the primary "best".
 */
export function sessionFacts(setup: SetupType, today: LoggedSet[], prior: LoggedSet[]): SessionFact[] {
  const now = trusted(today);
  const before = trusted(prior);
  if (now.length === 0 || before.length === 0) return [];
  const facts: SessionFact[] = [];
  const top = topOf(now, setup)!;
  const priorTop = topOf(before, setup)!;
  if (harderLoad(setup, top.load, priorTop.load)) facts.push({ kind: "load", load: top.load, reps: top.reps });
  else {
    const same = now.filter((s) => Math.abs(s.load - top.load) < 1e-6);
    const priorSame = before.filter((s) => Math.abs(s.load - top.load) < 1e-6);
    const bestReps = Math.max(...same.map((s) => s.reps));
    if (priorSame.length > 0 && bestReps > Math.max(...priorSame.map((s) => s.reps))) {
      facts.push({ kind: "reps_at_load", load: top.load, reps: bestReps });
    }
  }
  const todayReps = new Map<number, LoggedSet>();
  for (const s of now) {
    const cur = todayReps.get(s.reps);
    if (!cur || harderLoad(setup, s.load, cur.load)) todayReps.set(s.reps, s);
  }
  const priorReps = new Map<number, number>();
  for (const s of before) {
    const cur = priorReps.get(s.reps);
    if (cur === undefined || harderLoad(setup, s.load, cur)) priorReps.set(s.reps, s.load);
  }
  let bestRep: LoggedSet | null = null;
  for (const [reps, s] of todayReps) {
    const prev = priorReps.get(reps);
    if (prev === undefined) continue;
    if (harderLoad(setup, s.load, prev) && (!bestRep || harderLoad(setup, s.load, bestRep.load))) bestRep = s;
  }
  // Same set as a new heaviest load is already the weight PR; keep rep PRs for other rep counts.
  if (bestRep && !facts.some((f) => f.kind === "load" && Math.abs(f.load - bestRep!.load) < 1e-6 && f.reps === bestRep!.reps)) {
    facts.push({ kind: "rep", load: bestRep.load, reps: bestRep.reps });
  }
  // Epley of an assistance load is not an estimated 1RM.
  if (setup !== "assisted") {
    const todayE = now.reduce((m, s) => Math.max(m, epley(s.load, s.reps)), 0);
    const priorE = before.reduce((m, s) => Math.max(m, epley(s.load, s.reps)), 0);
    if (todayE > priorE + 1e-6) {
      const src = now.reduce((best, s) => (epley(s.load, s.reps) > epley(best.load, best.reps) ? s : best), now[0]!);
      facts.push({ kind: "e1rm", load: src.load, reps: src.reps, e1rm: todayE });
    }
  }
  return facts;
}

/**
 * Percent change of the top set from the first trusted session in the last 30 days to the latest.
 * Assisted: less assistance is a positive change. Null when two comparable sessions are missing.
 */
export function monthImprovementPct(history: HistorySession[], setup: SetupType, nowMs: number): number | null {
  const inWindow = history
    .map((h) => ({ h, at: Date.parse(h.performedAt) }))
    .filter((x) => Number.isFinite(x.at) && x.at <= nowMs && x.at >= nowMs - MONTH_MS)
    .sort((a, b) => a.at - b.at);
  if (inWindow.length < 2) return null;
  const first = heaviestSet([inWindow[0]!.h], setup);
  const last = heaviestSet([inWindow[inWindow.length - 1]!.h], setup);
  if (!first || !last || first.load === 0) return null;
  const delta = setup === "assisted" ? (first.load - last.load) / first.load : (last.load - first.load) / first.load;
  return Math.round(delta * 1000) / 10;
}

/**
 * Consecutive finished workouts looking backward from `nowMs`. A rest day does not break the count;
 * a gap longer than STREAK_MAX_GAP_DAYS does. One workout is never shown as a streak.
 */
export function consecutiveWorkouts(finishedAt: number[], nowMs: number, maxGapDays = STREAK_MAX_GAP_DAYS): number {
  const times = [...finishedAt].filter((t) => Number.isFinite(t) && t <= nowMs).sort((a, b) => b - a);
  if (times.length === 0) return 0;
  if (nowMs - times[0]! > maxGapDays * DAY_MS) return 0;
  let n = 1;
  for (let i = 1; i < times.length; i++) {
    if (times[i - 1]! - times[i]! > maxGapDays * DAY_MS) break;
    n += 1;
  }
  return n;
}
