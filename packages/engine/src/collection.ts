import {
  diffLocalDays, identityKey, weekStartOfLocalDate, logicalTrainingDateFromMs,
  type AchievementSession, type AchievementSet, type AchievementEvent, type AchievementEvidence,
  type EvaluateAchievementsOpts, type EvaluateAchievementsResult, type StrengthSetEvidence, type IdentityRef,
} from "./achievements";
import { COLLECTION_CATALOG, COLLECTION_VERSION } from "./collectionCatalog";
import { isTrustedWorkingSet } from "./outlier";

// Loads in persisted GAIN history are kg (imports and logger normalize at their input boundary).
// The importer rounds converted loads to 0.01kg; use that same tolerance for comparable loads.
const EPS = 0.01;
const identity = (s: AchievementSet): IdentityRef => ({ exerciseId: s.exerciseId, equipment: s.equipment, setup: s.setup });
const keyOf = (s: AchievementSet) => identityKey(s.exerciseId, s.equipment, s.setup);
const measure = (s: AchievementSet) => s.measure ?? ((s.durationS ?? 0) > 0 ? "time" : (s.distanceM ?? 0) > 0 ? "distance" : "reps");
const quantity = (s: AchievementSet) => measure(s) === "time" ? s.durationS ?? 0 : measure(s) === "distance" ? s.distanceM ?? 0 : s.reps;
export function isCollectionWorkingSet(s: AchievementSet): boolean {
  return isTrustedWorkingSet(s) && Number.isFinite(s.load) && s.load >= 0 && Number.isFinite(quantity(s)) && quantity(s) > 0 && (measure(s) !== "reps" || Number.isInteger(s.reps));
}
const load = (s: AchievementSet) => s.setup === "assisted" ? -s.load : s.load;
const dominates = (a: AchievementSet, b: AchievementSet) => load(a) + EPS >= load(b) && quantity(a) >= quantity(b);
const improves = (a: AchievementSet, b: AchievementSet) => dominates(a, b) && (load(a) > load(b) + EPS || quantity(a) > quantity(b));
const stamp = (s: AchievementSession, set: AchievementSet): StrengthSetEvidence => ({
  setId: set.id, sessionId: s.id, localDate: s.localCalendarDate, load: set.load, reps: set.reps,
  durationS: set.durationS, distanceM: set.distanceM, measure: measure(set),
});
interface Benchmark { session: AchievementSession; set: AchievementSet }
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

/** Pure deterministic replay, also used after each finish. Never compares sets within one workout. */
export function evaluateCollection(sessions: readonly AchievementSession[], opts: EvaluateAchievementsOpts = {}): EvaluateAchievementsResult {
  const seenSessions = new Set<string>();
  const seenImports = new Set<string>();
  const ordered = [...sessions].sort((a,b) => a.finishedAtUtc - b.finishedAtUtc || a.id.localeCompare(b.id))
    .filter(s => {
      if (!validDate(s.localCalendarDate) || !Number.isFinite(s.finishedAtUtc) || seenSessions.has(s.id) || (s.importKey && seenImports.has(s.importKey))) return false;
      seenSessions.add(s.id); if (s.importKey) seenImports.add(s.importKey);
      return s.sets.some(isCollectionWorkingSet);
    });
  const weeks = new Map<string, Set<string>>();
  const dates = new Set<string>();
  const exerciseDates = new Map<string, Set<string>>();
  const pools = new Map<string, Benchmark[]>();
  const prExercises = new Map<string, { identity: IdentityRef; setId: string }>();
  const earned: AchievementEvent[] = [];
  const awarded = new Set<string>();
  let last: AchievementSession | undefined;
  let comeback: { before: AchievementSession; first: AchievementSession; gap: number } | undefined;
  const emit = (badgeId: string, session: AchievementSession, evidence: AchievementEvidence, current = 1, target = 1, setId: string | null = null, repeat = false) => {
    if (!repeat && awarded.has(badgeId)) return;
    awarded.add(badgeId);
    earned.push({ badgeId, ruleVersion: COLLECTION_VERSION, earnedAtUtc: session.finishedAtUtc,
      earnedLocalDate: session.localCalendarDate, primarySessionId: session.id, primarySetId: setId,
      evidence, progressCurrent: current, progressTarget: target });
  };
  const tierAwards = (family: string, current: number, session: AchievementSession, evidence: (tier: number) => AchievementEvidence) => {
    for (const def of COLLECTION_CATALOG.filter(d => d.artFamily === family)) {
      if (current >= def.tier) emit(def.id, session, evidence(def.tier), def.tier, def.tier);
    }
  };
  for (const session of ordered) {
    const sets = [...session.sets].filter(isCollectionWorkingSet).sort((a,b) => a.id.localeCompare(b.id));
    emit("first_workout", session, { kind: "first_session", sessionId: session.id, trustedWorkingSets: sets.length });
    dates.add(session.localCalendarDate);
    tierAwards("lifetime_plate", dates.size, session, tier => ({ kind: "hundred_club", tier, days: tier }));
    const week = weekStartOfLocalDate(session.localCalendarDate, opts.weekStartsOn ?? 1);
    const weekDates = weeks.get(week) ?? new Set<string>();
    weekDates.add(session.localCalendarDate); weeks.set(week, weekDates);
    tierAwards("showing_up", weeks.size, session, tier => ({ kind: "qualified_weeks", tier, lifetimeCount: tier, consecutiveRun: consecutive([...weeks.keys()]), weekStart: week, sessionId: session.id }));
    if (last && last.localCalendarDate !== session.localCalendarDate) {
      const gap = diffLocalDays(last.localCalendarDate, session.localCalendarDate) - 1;
      if (gap >= 14) comeback = { before: last, first: session, gap };
    }
    if (comeback && session.localCalendarDate !== comeback.first.localCalendarDate) {
      const elapsed = diffLocalDays(comeback.first.localCalendarDate, session.localCalendarDate);
      if (elapsed >= 1 && elapsed <= 13) emit("back_at_it", session, {
        kind: "comeback", sessionId: session.id, gapDays: comeback.gap, qualifiedWeeksBeforeGap: 0,
        lastSessionId: comeback.before.id, lastLocalDate: comeback.before.localCalendarDate,
        returnSessionId: comeback.first.id, returnLocalDate: comeback.first.localCalendarDate, secondLocalDate: session.localCalendarDate,
      });
      if (elapsed > 13) comeback = undefined;
    }
    last = session;
    const exact = sets.filter(s => s.identityReliable !== false && !!s.exerciseId);
    const groups = new Map<string, AchievementSet[]>();
    for (const set of exact) {
      const key = keyOf(set);
      const days = exerciseDates.get(key) ?? new Set<string>();
      days.add(session.localCalendarDate); exerciseDates.set(key, days);
      tierAwards("dedicated_days", days.size, session, tier => ({ kind: "dedicated", tier: tier as 10|25|50|100, identity: identity(set), sessions: tier, distinctDates: true }));
      const comparable = `${key}|${measure(set)}`;
      const group = groups.get(comparable) ?? []; group.push(set); groups.set(comparable, group);
    }
    for (const [key, candidates] of groups) {
      const pool = pools.get(key) ?? [];
      // A finish stamp is the historical ordering authority. Equal-time workouts cannot establish each other's best.
      const earlier = pool.filter(p => p.session.finishedAtUtc < (session.startedAtUtc ?? session.finishedAtUtc));
      const recordCandidates = candidates.filter((set, i) => !candidates.some((other, j) => j !== i &&
        (improves(other, set) || (dominates(other, set) && dominates(set, other) && other.id < set.id))));
      for (const set of recordCandidates) {
        if (earlier.some(p => dominates(p.set, set))) continue;
        const benchmark = earlier.find(p => improves(set, p.set));
        if (!benchmark) continue;
        const evidence: AchievementEvidence = {
          kind: "strength_pr", path: "A", identity: identity(set), previousBest: stamp(benchmark.session, benchmark.set),
          newBest: stamp(session, set), deltas: { load: load(set) - load(benchmark.set), reps: set.reps - benchmark.set.reps, e1rmPct: 0 },
        };
        emit("strength_pr_v2", session, evidence, 1, 1, set.id, true);
        emit("first_pr", session, evidence, 1, 1, set.id);
        prExercises.set(keyOf(set), { identity: identity(set), setId: set.id });
        tierAwards("across_the_board", prExercises.size, session, tier => ({ kind: "across_the_board", tier,
          identities: [...prExercises.values()].map(x => x.identity), prSetIds: [...prExercises.values()].map(x => x.setId) }));
      }
      // Called It uses only timestamped, explicitly saved target versions active at START.
      for (const pin of opts.pins ?? []) {
        const start = session.startedAtUtc;
        if (!pin.id || !pin.explicit || pin.setAtUtc == null || start == null || pin.setAtUtc >= start || (pin.endedAtUtc != null && pin.endedAtUtc <= start)) continue;
        const sample = candidates[0]!;
        if (pin.exerciseId !== sample.exerciseId || pin.equipment !== sample.equipment || pin.setup !== sample.setup || measure(sample) !== "reps") continue;
        const target: AchievementSet = { ...sample, load: pin.load, reps: pin.reps };
        const prior = pool.filter(p => p.session.finishedAtUtc < pin.setAtUtc!);
        if (prior.some(p => dominates(p.set, target))) continue;
        const baseline = prior.find(p => improves(target, p.set));
        if (!baseline) continue;
        const achieved = candidates.find(s => dominates(s, target));
        if (achieved) emit("called_it", session, { kind: "pin_target", identity: identity(achieved),
          target: { load: pin.load, reps: pin.reps }, achieved: stamp(session, achieved), targetVersionId: pin.id,
          targetSetAtUtc: pin.setAtUtc, baseline: stamp(baseline.session, baseline.set) }, 1, 1, achieved.id);
      }
      pools.set(key, [...pool, ...candidates.map(set => ({ session, set }))]);
    }
  }
  const currentFor = (family: string): number => family === "lifetime_plate" ? dates.size : family === "showing_up" ? weeks.size :
    family === "dedicated_days" ? Math.max(0, ...[...exerciseDates.values()].map(x => x.size)) : family === "across_the_board" ? prExercises.size : 0;
  const inProgress = COLLECTION_CATALOG.filter(d => !awarded.has(d.id)).map(d => ({ badgeId: d.id, current: currentFor(d.artFamily), target: d.tier }));
  const now = opts.nowLocalDate ?? ordered.at(-1)?.localCalendarDate ?? logicalTrainingDateFromMs(Date.now());
  const week = weekStartOfLocalDate(now, opts.weekStartsOn ?? 1);
  const days = weeks.get(week)?.size ?? 0;
  // Optional quests are deliberately outside the permanent catalog.
  for (const q of [...opts.quests?.completed ?? [], ...(opts.quests?.active?.complete ? [opts.quests.active] : [])]) {
    const host = ordered.find(s => s.id === q.primarySessionId) ?? ordered.at(-1);
    if (host) emit(`quest_${q.kind}`, host, { kind: "quest", questKind: q.kind, month: q.month, current: q.current ?? q.target, target: q.target }, q.current ?? q.target, q.target, null, true);
  }
  return { earned, inProgress, pulse: { weekStart: week, qualifiedDays: days, dayTarget: 1, qualified: days > 0 },
    stats: { qualifiedWeeksLifetime: weeks.size, qualifiedWeeksConsecutive: consecutive([...weeks.keys()]), qualifyingDays: dates.size, activeYears: new Set([...dates].map(d => d.slice(0,4))).size } };
}
function consecutive(weeks: string[]): number {
  const ordered = [...weeks].sort(); let n = ordered.length ? 1 : 0;
  for (let i = ordered.length - 1; i > 0 && diffLocalDays(ordered[i-1]!, ordered[i]!) === 7; i--) n++;
  return n;
}
