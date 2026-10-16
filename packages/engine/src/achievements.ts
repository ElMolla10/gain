/**
 * Phase 1 evidence-first achievements. Pure: given stamped history, return earned events.
 * Never formats language strings. Never changes progression or live adaptation.
 */
import { epley } from "./line";
import { isTrustedWorkingSet } from "./outlier";
import type { EquipmentType, OutlierStatus, SetupType } from "./types";

export const ACHIEVEMENT_RULE_VERSION = 1;
export const QUALIFIED_WORKING_SETS = 3;
export const QUALIFIED_WEEK_DAYS = 2;
export const PR_REP_MIN = 3;
export const PR_REP_MAX = 15;
export const PR_BASELINE_SESSIONS = 2;
export const PR_MIN_LOAD_STEP = 1;
export const PR_E1RM_GAIN = 0.025;
export const COMEBACK_GAP_DAYS = 14;
export const COMEBACK_MIN_WEEKS = 3;
export const COMEBACK_COOLDOWN_DAYS = 90;
export const QUALIFIED_WEEK_TIERS = [4, 12] as const;
export const DEDICATED_TIERS = [10, 25, 50, 100] as const;
export const HUNDRED_CLUB_TIERS = [100, 250, 500, 1000] as const;
export const MULTI_YEAR_TIERS = [2, 3, 5] as const;
export const SPECTRUM_TIERS = [4, 12] as const;
export const WORKHORSE_REP_MIN = 12;
export const WORKHORSE_REP_MAX = 20;
export const HOLD_LOAD_BAND = 0.05;
export const BLOCK_BUILDER_MONTHS = 3;

const LOAD_EPS = 1e-6;

export type AchievementFamily =
  | "first_session"
  | "qualified_weeks"
  | "strength_pr"
  | "comeback"
  | "dedicated"
  | "block_builder"
  | "full_spectrum"
  | "iron_hold"
  | "iron_carry"
  | "workhorse"
  | "hundred_club"
  | "multi_year"
  | "pin_target"
  | "quest";
export type AchievementStatus = "locked" | "in_progress" | "earned" | "revoked_by_edit";

export interface BadgeDefinition {
  id: string;
  version: number;
  family: AchievementFamily;
  tier: number;
  i18nKey: string;
}

export const ACHIEVEMENT_CATALOG: readonly BadgeDefinition[] = [
  { id: "first_session", version: ACHIEVEMENT_RULE_VERSION, family: "first_session", tier: 1, i18nKey: "achv.firstSession" },
  { id: "qualified_weeks_4", version: ACHIEVEMENT_RULE_VERSION, family: "qualified_weeks", tier: 4, i18nKey: "achv.weeks4" },
  { id: "qualified_weeks_12", version: ACHIEVEMENT_RULE_VERSION, family: "qualified_weeks", tier: 12, i18nKey: "achv.weeks12" },
  { id: "strength_pr", version: ACHIEVEMENT_RULE_VERSION, family: "strength_pr", tier: 1, i18nKey: "achv.strengthPr" },
  { id: "comeback", version: ACHIEVEMENT_RULE_VERSION, family: "comeback", tier: 1, i18nKey: "achv.comeback" },
  { id: "dedicated_10", version: ACHIEVEMENT_RULE_VERSION, family: "dedicated", tier: 10, i18nKey: "achv.dedicated10" },
  { id: "dedicated_25", version: ACHIEVEMENT_RULE_VERSION, family: "dedicated", tier: 25, i18nKey: "achv.dedicated25" },
  { id: "dedicated_50", version: ACHIEVEMENT_RULE_VERSION, family: "dedicated", tier: 50, i18nKey: "achv.dedicated50" },
  { id: "dedicated_100", version: ACHIEVEMENT_RULE_VERSION, family: "dedicated", tier: 100, i18nKey: "achv.dedicated100" },
  { id: "block_builder", version: ACHIEVEMENT_RULE_VERSION, family: "block_builder", tier: 1, i18nKey: "achv.blockBuilder" },
  { id: "full_spectrum_4", version: ACHIEVEMENT_RULE_VERSION, family: "full_spectrum", tier: 4, i18nKey: "achv.spectrum4" },
  { id: "full_spectrum_12", version: ACHIEVEMENT_RULE_VERSION, family: "full_spectrum", tier: 12, i18nKey: "achv.spectrum12" },
  { id: "iron_hold", version: ACHIEVEMENT_RULE_VERSION, family: "iron_hold", tier: 1, i18nKey: "achv.ironHold" },
  { id: "iron_carry", version: ACHIEVEMENT_RULE_VERSION, family: "iron_carry", tier: 1, i18nKey: "achv.ironCarry" },
  { id: "workhorse", version: ACHIEVEMENT_RULE_VERSION, family: "workhorse", tier: 1, i18nKey: "achv.workhorse" },
  { id: "hundred_club_100", version: ACHIEVEMENT_RULE_VERSION, family: "hundred_club", tier: 100, i18nKey: "achv.hundred100" },
  { id: "hundred_club_250", version: ACHIEVEMENT_RULE_VERSION, family: "hundred_club", tier: 250, i18nKey: "achv.hundred250" },
  { id: "hundred_club_500", version: ACHIEVEMENT_RULE_VERSION, family: "hundred_club", tier: 500, i18nKey: "achv.hundred500" },
  { id: "hundred_club_1000", version: ACHIEVEMENT_RULE_VERSION, family: "hundred_club", tier: 1000, i18nKey: "achv.hundred1000" },
  { id: "multi_year_2", version: ACHIEVEMENT_RULE_VERSION, family: "multi_year", tier: 2, i18nKey: "achv.years2" },
  { id: "multi_year_3", version: ACHIEVEMENT_RULE_VERSION, family: "multi_year", tier: 3, i18nKey: "achv.years3" },
  { id: "multi_year_5", version: ACHIEVEMENT_RULE_VERSION, family: "multi_year", tier: 5, i18nKey: "achv.years5" },
  { id: "pin_target", version: ACHIEVEMENT_RULE_VERSION, family: "pin_target", tier: 1, i18nKey: "achv.pinTarget" },
  { id: "quest_rhythm", version: ACHIEVEMENT_RULE_VERSION, family: "quest", tier: 1, i18nKey: "quest.rhythm.title" },
  { id: "quest_craft", version: ACHIEVEMENT_RULE_VERSION, family: "quest", tier: 1, i18nKey: "quest.craft.title" },
  { id: "quest_balance", version: ACHIEVEMENT_RULE_VERSION, family: "quest", tier: 1, i18nKey: "quest.balance.title" },
  { id: "quest_foundation", version: ACHIEVEMENT_RULE_VERSION, family: "quest", tier: 1, i18nKey: "quest.foundation.baselines" },
];

export const UNIQUE_BADGE_IDS = new Set([
  "first_session",
  "qualified_weeks_4",
  "qualified_weeks_12",
  "dedicated_10",
  "dedicated_25",
  "dedicated_50",
  "dedicated_100",
  "full_spectrum_4",
  "full_spectrum_12",
  "workhorse",
  "hundred_club_100",
  "hundred_club_250",
  "hundred_club_500",
  "hundred_club_1000",
  "multi_year_2",
  "multi_year_3",
  "multi_year_5",
]);

export interface AchievementSet {
  id: string;
  exerciseId: string;
  equipment: EquipmentType;
  setup: SetupType;
  load: number;
  reps: number;
  warmup: boolean;
  tags: string[];
  outlierStatus: OutlierStatus;
  durationS?: number | null;
  distanceM?: number | null;
  pattern?: string | null;
  measure?: "reps" | "time" | "distance";
}

export interface AchievementSession {
  id: string;
  finishedAtUtc: number;
  /** YYYY-MM-DD stamped at log time. Never recompute from the clock later. */
  localCalendarDate: string;
  sets: AchievementSet[];
}

export interface StrengthSetEvidence {
  setId: string;
  sessionId: string;
  load: number;
  reps: number;
  localDate: string;
}

export interface IdentityRef {
  exerciseId: string;
  equipment: EquipmentType;
  setup: SetupType;
}

export type AchievementEvidence =
  | { kind: "first_session"; sessionId: string; trustedWorkingSets: number }
  | { kind: "qualified_weeks"; tier: 4 | 12; lifetimeCount: number; consecutiveRun: number; weekStart: string; sessionId: string }
  | {
      kind: "strength_pr";
      path: "A" | "B";
      identity: IdentityRef;
      previousBest: StrengthSetEvidence;
      newBest: StrengthSetEvidence;
      deltas: { load: number; reps: number; e1rmPct: number };
    }
  | { kind: "comeback"; sessionId: string; gapDays: number; qualifiedWeeksBeforeGap: number; lastSessionId: string; lastLocalDate: string }
  | { kind: "dedicated"; tier: 10 | 25 | 50 | 100; identity: IdentityRef; sessions: number }
  | { kind: "block_builder"; identity: IdentityRef; months: [string, string, string] }
  | { kind: "full_spectrum"; tier: 4 | 12; patterns: string[]; covered: string[]; weekStart: string }
  | { kind: "iron_hold"; identity: IdentityRef; previous: StrengthSetEvidence & { durationS: number }; next: StrengthSetEvidence & { durationS: number } }
  | { kind: "iron_carry"; identity: IdentityRef; previous: StrengthSetEvidence & { distanceM: number }; next: StrengthSetEvidence & { distanceM: number } }
  | { kind: "workhorse"; identity: IdentityRef; previousBest: StrengthSetEvidence; newBest: StrengthSetEvidence }
  | { kind: "hundred_club"; tier: 100 | 250 | 500 | 1000; days: number }
  | { kind: "multi_year"; tier: 2 | 3 | 5; years: number }
  | { kind: "pin_target"; identity: IdentityRef; target: { load: number; reps: number }; achieved: StrengthSetEvidence }
  | { kind: "quest"; questKind: "rhythm" | "craft" | "balance" | "foundation"; month: string; current: number; target: number };

export interface AchievementEvent {
  badgeId: string;
  ruleVersion: number;
  earnedAtUtc: number;
  earnedLocalDate: string;
  primarySessionId: string;
  primarySetId: string | null;
  evidence: AchievementEvidence;
  progressCurrent: number;
  progressTarget: number;
}

export interface AchievementProgress {
  badgeId: string;
  current: number;
  target: number;
}

export interface WeekPulse {
  weekStart: string;
  qualifiedDays: number;
  dayTarget: number;
  qualified: boolean;
}

export interface EvaluateAchievementsResult {
  earned: AchievementEvent[];
  inProgress: AchievementProgress[];
  pulse: WeekPulse;
  stats: { qualifiedWeeksLifetime: number; qualifiedWeeksConsecutive: number };
}

export interface LiftPin {
  id?: string;
  exerciseId: string;
  equipment?: EquipmentType;
  setup?: SetupType;
  load: number;
  reps: number;
}

export interface ActiveQuestEval {
  kind: "rhythm" | "craft" | "balance" | "foundation";
  month: string;
  target: number;
  payload: Record<string, unknown>;
  titleKey?: string;
  complete?: boolean;
  current?: number;
  primarySessionId?: string | null;
  earnedAtUtc?: number;
  earnedLocalDate?: string;
}

export interface EvaluateAchievementsOpts {
  weekStartsOn?: number;
  nowLocalDate?: string;
  programPatterns?: string[];
  programPrimaryIds?: string[];
  pins?: LiftPin[];
  quests?: { active?: ActiveQuestEval | null; completed?: ActiveQuestEval[] };
}

export interface StoredAchievement {
  id: string;
  badgeId: string;
  status: AchievementStatus;
  primarySessionId: string | null;
  primarySetId: string | null;
  evidence: AchievementEvidence | null;
  earnedLocalDate: string | null;
}

export type ReconcileOp =
  | { kind: "insert"; event: AchievementEvent }
  | { kind: "update"; id: string; event: AchievementEvent; action: "reanchor" | "progress" | "restore" }
  | { kind: "revoke"; id: string; detail: { reason: string } };

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

export function formatLocalDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function shiftLocalDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d! + days, 12, 0, 0, 0);
  return formatLocalDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function prevMonthKey(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y! - 1}-12` : `${y}-${pad2(m! - 1)}`;
}

export function diffLocalDays(from: string, to: string): number {
  const a = from.split("-").map(Number);
  const b = to.split("-").map(Number);
  const da = Date.UTC(a[0]!, a[1]! - 1, a[2]!);
  const db = Date.UTC(b[0]!, b[1]! - 1, b[2]!);
  return Math.round((db - da) / 86_400_000);
}

/** Logical training day: local calendar date rolls over at 04:00. */
export function logicalTrainingDate(parts: LocalDateParts): string {
  const iso = formatLocalDate(parts.year, parts.month, parts.day);
  return parts.hour < 4 ? shiftLocalDate(iso, -1) : iso;
}

/** Device-local stamp at log time. Tests that need a timezone pass `logicalTrainingDate` parts instead. */
export function logicalTrainingDateFromMs(ms: number): string {
  const d = new Date(ms);
  return logicalTrainingDate({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  });
}

export function weekStartOfLocalDate(iso: string, weekStartsOn = 1): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!, 12, 0, 0, 0);
  const back = (dt.getDay() - weekStartsOn + 7) % 7;
  dt.setDate(dt.getDate() - back);
  return formatLocalDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function identityKey(exerciseId: string, equipment: EquipmentType, setup: SetupType): string {
  return `${exerciseId}|${equipment}|${setup}`;
}

export function repBand(reps: number): "3-5" | "6-10" | "11-15" | null {
  if (reps >= 3 && reps <= 5) return "3-5";
  if (reps >= 6 && reps <= 10) return "6-10";
  if (reps >= 11 && reps <= 15) return "11-15";
  return null;
}

export function isQualifyingSession(session: AchievementSession): boolean {
  return session.sets.filter((s) => isTrustedWorkingSet(s)).length >= QUALIFIED_WORKING_SETS;
}

export function pinReached(pin: LiftPin, set: AchievementSet): boolean {
  if (set.exerciseId !== pin.exerciseId) return false;
  if (pin.equipment && set.equipment !== pin.equipment) return false;
  if (pin.setup && set.setup !== pin.setup) return false;
  if (!isTrustedWorkingSet(set)) return false;
  const assisted = set.setup === "assisted";
  const loadOk = assisted ? set.load <= pin.load + LOAD_EPS : set.load + LOAD_EPS >= pin.load;
  return loadOk && set.reps >= pin.reps;
}

export function pinProgress(
  pin: LiftPin,
  sessions: readonly AchievementSession[],
): { current: number; target: number; reached: boolean; session?: AchievementSession; set?: AchievementSet } {
  let best = 0;
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.exerciseId !== pin.exerciseId) continue;
      if (pin.equipment && set.equipment !== pin.equipment) continue;
      if (pin.setup && set.setup !== pin.setup) continue;
      if (!isTrustedWorkingSet(set)) continue;
      if (pinReached(pin, set)) return { current: 1, target: 1, reached: true, session, set };
      const assisted = set.setup === "assisted";
      const loadRatio = pin.load <= 0 ? 1 : assisted ? Math.min(1, pin.load / Math.max(set.load, LOAD_EPS)) : Math.min(1, set.load / pin.load);
      const repsRatio = pin.reps <= 0 ? 1 : Math.min(1, set.reps / pin.reps);
      best = Math.max(best, Math.min(loadRatio, repsRatio));
    }
  }
  return { current: best, target: 1, reached: false };
}

function isPrEligibleSet(s: AchievementSet): boolean {
  return isTrustedWorkingSet(s) && s.reps >= PR_REP_MIN && s.reps <= PR_REP_MAX;
}

function assistedOf(setup: SetupType): boolean {
  return setup === "assisted";
}

function loadDelta(next: number, prev: number, assisted: boolean): number {
  return assisted ? prev - next : next - prev;
}

function sameLoad(a: number, b: number): boolean {
  return Math.abs(a - b) < LOAD_EPS;
}

function betterLoad(a: number, b: number, assisted: boolean): boolean {
  return loadDelta(a, b, assisted) > LOAD_EPS;
}

function e1rmPct(prev: AchievementSet, next: AchievementSet, assisted: boolean): number {
  const a = epley(prev.load, prev.reps);
  const b = epley(next.load, next.reps);
  if (a <= 0) return 0;
  return assisted ? ((a - b) / a) * 100 : ((b - a) / a) * 100;
}

interface PrHit {
  path: "A" | "B";
  set: AchievementSet;
  previous: AchievementSet;
  previousSessionId: string;
  previousDate: string;
  e1rmPct: number;
}

interface PoolEntry {
  set: AchievementSet;
  sessionId: string;
  localDate: string;
}

function peakLoad(pool: PoolEntry[], assisted: boolean): number | null {
  if (pool.length === 0) return null;
  return pool.reduce((best, e) => (betterLoad(e.set.load, best, assisted) ? e.set.load : best), pool[0]!.set.load);
}

function pathA(pool: PoolEntry[], candidate: AchievementSet): { previous: PoolEntry; e1rmPct: number } | null {
  const assisted = assistedOf(candidate.setup);
  let best: PoolEntry | null = null;
  for (const p of pool) {
    if (candidate.reps < p.set.reps) continue;
    if (!betterLoad(candidate.load, p.set.load, assisted) || loadDelta(candidate.load, p.set.load, assisted) < PR_MIN_LOAD_STEP - LOAD_EPS) continue;
    if (
      !best ||
      betterLoad(p.set.load, best.set.load, assisted) ||
      (sameLoad(p.set.load, best.set.load) && p.set.reps > best.set.reps)
    ) {
      best = p;
    }
  }
  if (best) return { previous: best, e1rmPct: e1rmPct(best.set, candidate, assisted) };

  const peak = peakLoad(pool, assisted);
  if (peak === null || !sameLoad(candidate.load, peak)) return null;
  const atPeak = pool.filter((p) => sameLoad(p.set.load, peak));
  const prev = atPeak.reduce((a, b) => (a.set.reps >= b.set.reps ? a : b));
  if (candidate.reps >= prev.set.reps + 1) return { previous: prev, e1rmPct: e1rmPct(prev.set, candidate, assisted) };
  return null;
}

function pathB(pool: PoolEntry[], candidate: AchievementSet): { previous: PoolEntry; e1rmPct: number } | null {
  const band = repBand(candidate.reps);
  if (!band) return null;
  const assisted = assistedOf(candidate.setup);
  const same = pool.filter((p) => repBand(p.set.reps) === band);
  if (same.length === 0) return null;
  const prev = same.reduce((a, b) => (e1rmPct(a.set, candidate, assisted) <= e1rmPct(b.set, candidate, assisted) ? a : b));
  const pct = e1rmPct(prev.set, candidate, assisted);
  if (pct + 1e-9 < PR_E1RM_GAIN * 100) return null;
  return { previous: prev, e1rmPct: pct };
}

function prScore(hit: PrHit): number[] {
  const assisted = assistedOf(hit.set.setup);
  return [hit.path === "A" ? 2 : 1, loadDelta(hit.set.load, hit.previous.load, assisted), hit.set.reps];
}

function betterHit(a: PrHit, b: PrHit): boolean {
  const sa = prScore(a);
  const sb = prScore(b);
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i]! > sb[i]!;
  return a.set.id < b.set.id;
}

function toSetEvidence(sessionId: string, localDate: string, set: AchievementSet): StrengthSetEvidence {
  return { setId: set.id, sessionId, load: set.load, reps: set.reps, localDate };
}

function event(
  badgeId: string,
  session: AchievementSession,
  evidence: AchievementEvidence,
  progressCurrent: number,
  progressTarget: number,
  primarySetId: string | null = null,
): AchievementEvent {
  return {
    badgeId,
    ruleVersion: ACHIEVEMENT_RULE_VERSION,
    earnedAtUtc: session.finishedAtUtc,
    earnedLocalDate: session.localCalendarDate,
    primarySessionId: session.id,
    primarySetId,
    evidence,
    progressCurrent,
    progressTarget,
  };
}

function identityOf(set: AchievementSet): IdentityRef {
  return { exerciseId: set.exerciseId, equipment: set.equipment, setup: set.setup };
}

function inLoadBand(a: number, b: number): boolean {
  if (b <= 0) return sameLoad(a, b);
  return Math.abs(a - b) / b <= HOLD_LOAD_BAND + LOAD_EPS;
}

function isWorkhorseSet(s: AchievementSet): boolean {
  return isTrustedWorkingSet(s) && s.reps >= WORKHORSE_REP_MIN && s.reps <= WORKHORSE_REP_MAX;
}

function isCoreIdentity(exerciseId: string, primaryIds: string[]): boolean {
  return primaryIds.length === 0 || primaryIds.includes(exerciseId);
}

export function evaluateAchievements(
  sessions: readonly AchievementSession[],
  opts: EvaluateAchievementsOpts = {},
): EvaluateAchievementsResult {
  const weekStartsOn = opts.weekStartsOn ?? 1;
  const ordered = [...sessions].sort((a, b) => a.finishedAtUtc - b.finishedAtUtc || a.id.localeCompare(b.id));
  const earned: AchievementEvent[] = [];
  const daysByWeek = new Map<string, Set<string>>();
  const qualifiedWeekStarts: string[] = [];
  const weekFirstSession = new Map<string, AchievementSession>();
  let firstSessionAwarded = false;
  let lastQual: AchievementSession | null = null;
  let lastComebackDate: string | null = null;
  const pools = new Map<string, PoolEntry[]>();
  const identitySessionCount = new Map<string, number>();
  const identityByKey = new Map<string, IdentityRef>();
  const workhorsePools = new Map<string, PoolEntry[]>();
  const workhorseSessionCount = new Map<string, number>();
  const holdPools = new Map<string, PoolEntry[]>();
  const holdSessionCount = new Map<string, number>();
  const carryPools = new Map<string, PoolEntry[]>();
  const carrySessionCount = new Map<string, number>();
  const prMonths = new Map<string, Set<string>>();
  const blockBuilderAwarded = new Set<string>();
  const qualifyingDates = new Set<string>();
  const primaryIds = opts.programPrimaryIds ?? [];
  const programPatterns = [...new Set((opts.programPatterns ?? []).filter(Boolean))];
  const pins = opts.pins ?? [];
  const pinAwarded = new Set<string>();
  const dedicatedAwarded = new Set<number>();
  let workhorseAwarded = false;

  const markDay = (session: AchievementSession) => {
    const week = weekStartOfLocalDate(session.localCalendarDate, weekStartsOn);
    let days = daysByWeek.get(week);
    if (!days) {
      days = new Set();
      daysByWeek.set(week, days);
    }
    const before = days.size;
    days.add(session.localCalendarDate);
    if (!weekFirstSession.has(week)) weekFirstSession.set(week, session);
    if (before < QUALIFIED_WEEK_DAYS && days.size >= QUALIFIED_WEEK_DAYS) {
      qualifiedWeekStarts.push(week);
      const lifetime = qualifiedWeekStarts.length;
      const consecutive = consecutiveRun(qualifiedWeekStarts);
      for (const tier of QUALIFIED_WEEK_TIERS) {
        if (lifetime === tier) {
          earned.push(
            event(
              `qualified_weeks_${tier}`,
              session,
              { kind: "qualified_weeks", tier, lifetimeCount: lifetime, consecutiveRun: consecutive, weekStart: week, sessionId: session.id },
              lifetime,
              tier,
            ),
          );
        }
      }
    }
  };

  for (const session of ordered) {
    const byIdentity = new Map<string, AchievementSet[]>();
    for (const s of session.sets) {
      const key = identityKey(s.exerciseId, s.equipment, s.setup);
      const list = byIdentity.get(key) ?? [];
      list.push(s);
      byIdentity.set(key, list);
    }

    const sessionHits: PrHit[] = [];
    for (const [key, sets] of byIdentity) {
      const trusted = sets.filter((s) => isTrustedWorkingSet(s));
      if (trusted.length === 0) continue;
      const sample = trusted[0]!;
      identityByKey.set(key, identityOf(sample));
      const count = (identitySessionCount.get(key) ?? 0) + 1;
      identitySessionCount.set(key, count);
      if (isCoreIdentity(sample.exerciseId, primaryIds)) {
        for (const tier of DEDICATED_TIERS) {
          if (count === tier && !dedicatedAwarded.has(tier)) {
            dedicatedAwarded.add(tier);
            earned.push(
              event(
                `dedicated_${tier}`,
                session,
                { kind: "dedicated", tier, identity: identityOf(sample), sessions: count },
                count,
                tier,
              ),
            );
          }
        }
      }
      const pool = pools.get(key) ?? [];
      if (count > PR_BASELINE_SESSIONS) {
        for (const s of trusted.filter(isPrEligibleSet)) {
          const a = pathA(pool, s);
          if (a) {
            sessionHits.push({
              path: "A",
              set: s,
              previous: a.previous.set,
              previousSessionId: a.previous.sessionId,
              previousDate: a.previous.localDate,
              e1rmPct: a.e1rmPct,
            });
            continue;
          }
          const b = pathB(pool, s);
          if (b) {
            sessionHits.push({
              path: "B",
              set: s,
              previous: b.previous.set,
              previousSessionId: b.previous.sessionId,
              previousDate: b.previous.localDate,
              e1rmPct: b.e1rmPct,
            });
          }
        }
      }
      const next = [...pool];
      for (const s of trusted.filter(isPrEligibleSet)) next.push({ set: s, sessionId: session.id, localDate: session.localCalendarDate });
      pools.set(key, next);

      const horseTrusted = trusted.filter(isWorkhorseSet);
      if (horseTrusted.length > 0) {
        const hc = (workhorseSessionCount.get(key) ?? 0) + 1;
        workhorseSessionCount.set(key, hc);
        const hp = workhorsePools.get(key) ?? [];
        if (!workhorseAwarded && hc > PR_BASELINE_SESSIONS) {
          for (const s of horseTrusted) {
            const a = pathA(hp, s);
            if (a) {
              workhorseAwarded = true;
              earned.push(
                event(
                  "workhorse",
                  session,
                  { kind: "workhorse", identity: identityOf(s), previousBest: toSetEvidence(a.previous.sessionId, a.previous.localDate, a.previous.set), newBest: toSetEvidence(session.id, session.localCalendarDate, s) },
                  1,
                  1,
                  s.id,
                ),
              );
              break;
            }
          }
        }
        const hnext = [...hp];
        for (const s of horseTrusted) hnext.push({ set: s, sessionId: session.id, localDate: session.localCalendarDate });
        workhorsePools.set(key, hnext);
      }

      const holdTrusted = trusted.filter((s) => (s.durationS ?? 0) > 0);
      if (holdTrusted.length > 0) {
        const hc = (holdSessionCount.get(key) ?? 0) + 1;
        holdSessionCount.set(key, hc);
        const hp = holdPools.get(key) ?? [];
        if (hc > PR_BASELINE_SESSIONS) {
          let best: { set: AchievementSet; prev: PoolEntry } | null = null;
          for (const s of holdTrusted) {
            for (const p of hp) {
              if (!(p.set.durationS && s.durationS && s.durationS > p.set.durationS)) continue;
              if (!(inLoadBand(s.load, p.set.load) || betterLoad(s.load, p.set.load, assistedOf(s.setup)))) continue;
              if (!best || s.durationS > best.set.durationS!) best = { set: s, prev: p };
            }
          }
          if (best) {
            earned.push(
              event(
                "iron_hold",
                session,
                {
                  kind: "iron_hold",
                  identity: identityOf(best.set),
                  previous: { ...toSetEvidence(best.prev.sessionId, best.prev.localDate, best.prev.set), durationS: best.prev.set.durationS! },
                  next: { ...toSetEvidence(session.id, session.localCalendarDate, best.set), durationS: best.set.durationS! },
                },
                1,
                1,
                best.set.id,
              ),
            );
          }
        }
        const hnext = [...hp];
        for (const s of holdTrusted) hnext.push({ set: s, sessionId: session.id, localDate: session.localCalendarDate });
        holdPools.set(key, hnext);
      }

      const carryTrusted = trusted.filter((s) => (s.distanceM ?? 0) > 0);
      if (carryTrusted.length > 0) {
        const hc = (carrySessionCount.get(key) ?? 0) + 1;
        carrySessionCount.set(key, hc);
        const hp = carryPools.get(key) ?? [];
        if (hc > PR_BASELINE_SESSIONS) {
          let best: { set: AchievementSet; prev: PoolEntry } | null = null;
          for (const s of carryTrusted) {
            for (const p of hp) {
              if (!(p.set.distanceM && s.distanceM)) continue;
              const longer = s.distanceM > p.set.distanceM;
              const heavier = betterLoad(s.load, p.set.load, assistedOf(s.setup));
              const matched = inLoadBand(s.load, p.set.load) || heavier;
              const sameOrLonger = s.distanceM + LOAD_EPS >= p.set.distanceM;
              if (!((longer && matched) || (heavier && sameOrLonger))) continue;
              if (!best || (s.distanceM ?? 0) > (best.set.distanceM ?? 0)) best = { set: s, prev: p };
            }
          }
          if (best) {
            earned.push(
              event(
                "iron_carry",
                session,
                {
                  kind: "iron_carry",
                  identity: identityOf(best.set),
                  previous: { ...toSetEvidence(best.prev.sessionId, best.prev.localDate, best.prev.set), distanceM: best.prev.set.distanceM! },
                  next: { ...toSetEvidence(session.id, session.localCalendarDate, best.set), distanceM: best.set.distanceM! },
                },
                1,
                1,
                best.set.id,
              ),
            );
          }
        }
        const cnext = [...hp];
        for (const s of carryTrusted) cnext.push({ set: s, sessionId: session.id, localDate: session.localCalendarDate });
        carryPools.set(key, cnext);
      }
    }

    const chosen = new Map<string, PrHit>();
    for (const hit of sessionHits) {
      const cur = chosen.get(hit.set.exerciseId);
      if (!cur || betterHit(hit, cur)) chosen.set(hit.set.exerciseId, hit);
    }
    for (const hit of chosen.values()) {
      const assisted = assistedOf(hit.set.setup);
      earned.push(
        event(
          "strength_pr",
          session,
          {
            kind: "strength_pr",
            path: hit.path,
            identity: { exerciseId: hit.set.exerciseId, equipment: hit.set.equipment, setup: hit.set.setup },
            previousBest: toSetEvidence(hit.previousSessionId, hit.previousDate, hit.previous),
            newBest: toSetEvidence(session.id, session.localCalendarDate, hit.set),
            deltas: { load: loadDelta(hit.set.load, hit.previous.load, assisted), reps: hit.set.reps - hit.previous.reps, e1rmPct: hit.e1rmPct },
          },
          1,
          1,
          hit.set.id,
        ),
      );
      const ik = identityKey(hit.set.exerciseId, hit.set.equipment, hit.set.setup);
      const months = prMonths.get(ik) ?? new Set();
      months.add(monthKey(session.localCalendarDate));
      prMonths.set(ik, months);
      const m2 = monthKey(session.localCalendarDate);
      const m1 = prevMonthKey(m2);
      const m0 = prevMonthKey(m1);
      if (!blockBuilderAwarded.has(ik) && months.has(m0) && months.has(m1) && months.has(m2)) {
        blockBuilderAwarded.add(ik);
        earned.push(
          event(
            "block_builder",
            session,
            { kind: "block_builder", identity: identityOf(hit.set), months: [m0, m1, m2] },
            3,
            BLOCK_BUILDER_MONTHS,
            hit.set.id,
          ),
        );
      }
    }

    for (const pin of pins) {
      const pinKey = pin.id ?? `${pin.exerciseId}|${pin.load}|${pin.reps}`;
      if (pinAwarded.has(pinKey)) continue;
      for (const set of session.sets) {
        if (!pinReached(pin, set)) continue;
        pinAwarded.add(pinKey);
        earned.push(
          event(
            "pin_target",
            session,
            { kind: "pin_target", identity: identityOf(set), target: { load: pin.load, reps: pin.reps }, achieved: toSetEvidence(session.id, session.localCalendarDate, set) },
            1,
            1,
            set.id,
          ),
        );
        break;
      }
    }

    if (!isQualifyingSession(session)) continue;

    if (!firstSessionAwarded) {
      firstSessionAwarded = true;
      const n = session.sets.filter((s) => isTrustedWorkingSet(s)).length;
      earned.push(event("first_session", session, { kind: "first_session", sessionId: session.id, trustedWorkingSets: n }, 1, 1));
    }

    if (lastQual) {
      const gap = diffLocalDays(lastQual.localCalendarDate, session.localCalendarDate);
      const weeksBefore = qualifiedWeekStarts.length;
      const cooled = lastComebackDate === null || diffLocalDays(lastComebackDate, session.localCalendarDate) >= COMEBACK_COOLDOWN_DAYS;
      if (gap >= COMEBACK_GAP_DAYS && weeksBefore >= COMEBACK_MIN_WEEKS && cooled) {
        earned.push(
          event(
            "comeback",
            session,
            {
              kind: "comeback",
              sessionId: session.id,
              gapDays: gap,
              qualifiedWeeksBeforeGap: weeksBefore,
              lastSessionId: lastQual.id,
              lastLocalDate: lastQual.localCalendarDate,
            },
            1,
            1,
          ),
        );
        lastComebackDate = session.localCalendarDate;
      }
    }

    markDay(session);
    qualifyingDates.add(session.localCalendarDate);
    const daysNow = qualifyingDates.size;
    for (const tier of HUNDRED_CLUB_TIERS) {
      if (daysNow === tier) {
        earned.push(event(`hundred_club_${tier}`, session, { kind: "hundred_club", tier, days: daysNow }, daysNow, tier));
      }
    }
    const yearCountNow = new Set(qualifiedWeekStarts.map((w) => Number(w.slice(0, 4)))).size;
    for (const tier of MULTI_YEAR_TIERS) {
      if (yearCountNow === tier && !earned.some((e) => e.badgeId === `multi_year_${tier}`)) {
        earned.push(event(`multi_year_${tier}`, session, { kind: "multi_year", tier, years: yearCountNow }, yearCountNow, tier));
      }
    }
    lastQual = session;
  }

  const lifetime = qualifiedWeekStarts.length;
  const consecutive = consecutiveRun(qualifiedWeekStarts);
  const nowLocal = opts.nowLocalDate ?? ordered.at(-1)?.localCalendarDate ?? logicalTrainingDateFromMs(Date.now());
  const thisWeek = weekStartOfLocalDate(nowLocal, weekStartsOn);
  const qualifiedDays = daysByWeek.get(thisWeek)?.size ?? 0;
  const inProgress: AchievementProgress[] = [];
  for (const tier of QUALIFIED_WEEK_TIERS) {
    if (lifetime < tier) inProgress.push({ badgeId: `qualified_weeks_${tier}`, current: lifetime, target: tier });
  }

  const lastQualSession = lastQual;
  if (programPatterns.length > 0 && lastQualSession) {
    for (const tier of SPECTRUM_TIERS) {
      const window = qualifiedWeekStarts.slice(-tier);
      if (window.length < tier) {
        inProgress.push({ badgeId: `full_spectrum_${tier}`, current: window.length, target: tier });
        continue;
      }
      const want = new Set(window);
      const covered = new Set<string>();
      let closer: AchievementSession | null = null;
      for (const s of ordered) {
        if (!isQualifyingSession(s)) continue;
        if (!want.has(weekStartOfLocalDate(s.localCalendarDate, weekStartsOn))) continue;
        closer = s;
        for (const set of s.sets) {
          if (isTrustedWorkingSet(set) && set.pattern && programPatterns.includes(set.pattern)) covered.add(set.pattern);
        }
      }
      if (covered.size >= programPatterns.length && closer) {
        earned.push(
          event(
            `full_spectrum_${tier}`,
            closer,
            { kind: "full_spectrum", tier, patterns: programPatterns, covered: [...covered], weekStart: window[0]! },
            covered.size,
            programPatterns.length,
          ),
        );
      } else {
        inProgress.push({ badgeId: `full_spectrum_${tier}`, current: covered.size, target: programPatterns.length });
      }
    }
  }

  const dayCount = qualifyingDates.size;
  for (const tier of HUNDRED_CLUB_TIERS) {
    if (dayCount < tier) inProgress.push({ badgeId: `hundred_club_${tier}`, current: dayCount, target: tier });
  }
  const yearCount = new Set(qualifiedWeekStarts.map((w) => Number(w.slice(0, 4)))).size;
  for (const tier of MULTI_YEAR_TIERS) {
    if (yearCount < tier) inProgress.push({ badgeId: `multi_year_${tier}`, current: yearCount, target: tier });
  }

  let maxDedicated = 0;
  for (const [key, n] of identitySessionCount) {
    const id = identityByKey.get(key);
    if (id && isCoreIdentity(id.exerciseId, primaryIds)) maxDedicated = Math.max(maxDedicated, n);
  }
  for (const tier of DEDICATED_TIERS) {
    if (maxDedicated < tier) inProgress.push({ badgeId: `dedicated_${tier}`, current: maxDedicated, target: tier });
  }
  if (!workhorseAwarded) {
    let maxHorse = 0;
    for (const n of workhorseSessionCount.values()) maxHorse = Math.max(maxHorse, n);
    inProgress.push({ badgeId: "workhorse", current: Math.min(maxHorse, PR_BASELINE_SESSIONS), target: PR_BASELINE_SESSIONS + 1 });
  }

  for (const pin of pins) {
    const pinKey = pin.id ?? `${pin.exerciseId}|${pin.load}|${pin.reps}`;
    if (pinAwarded.has(pinKey)) continue;
    const p = pinProgress(pin, ordered);
    inProgress.push({ badgeId: "pin_target", current: p.current, target: p.target });
  }

  const emitQuest = (q: ActiveQuestEval, session: AchievementSession | null) => {
    const host = session ?? lastQualSession ?? ordered.at(-1);
    if (!host) return;
    earned.push({
      badgeId: `quest_${q.kind}`,
      ruleVersion: ACHIEVEMENT_RULE_VERSION,
      earnedAtUtc: q.earnedAtUtc ?? host.finishedAtUtc,
      earnedLocalDate: q.earnedLocalDate ?? host.localCalendarDate,
      primarySessionId: q.primarySessionId ?? host.id,
      primarySetId: null,
      evidence: { kind: "quest", questKind: q.kind, month: q.month, current: q.current ?? q.target, target: q.target },
      progressCurrent: q.current ?? q.target,
      progressTarget: q.target,
    });
  };
  for (const q of opts.quests?.completed ?? []) emitQuest(q, ordered.find((s) => s.id === q.primarySessionId) ?? null);
  const active = opts.quests?.active;
  if (active?.complete) {
    emitQuest(active, ordered.find((s) => s.id === active.primarySessionId) ?? null);
  } else if (active) {
    inProgress.push({ badgeId: `quest_${active.kind}`, current: active.current ?? 0, target: active.target });
  }

  return {
    earned,
    inProgress,
    pulse: { weekStart: thisWeek, qualifiedDays, dayTarget: QUALIFIED_WEEK_DAYS, qualified: qualifiedDays >= QUALIFIED_WEEK_DAYS },
    stats: { qualifiedWeeksLifetime: lifetime, qualifiedWeeksConsecutive: consecutive },
  };
}

function consecutiveRun(weekStarts: string[]): number {
  if (weekStarts.length === 0) return 0;
  const unique = [...new Set(weekStarts)].sort();
  let run = 1;
  for (let i = unique.length - 1; i > 0; i--) {
    if (diffLocalDays(unique[i - 1]!, unique[i]!) === 7) run++;
    else break;
  }
  return run;
}

function evidenceExerciseId(ev: AchievementEvidence | null): string | null {
  if (!ev) return null;
  if (
    ev.kind === "strength_pr" ||
    ev.kind === "dedicated" ||
    ev.kind === "block_builder" ||
    ev.kind === "iron_hold" ||
    ev.kind === "iron_carry" ||
    ev.kind === "workhorse" ||
    ev.kind === "pin_target"
  ) {
    return ev.identity.exerciseId;
  }
  return null;
}

function matchScore(row: StoredAchievement, event: AchievementEvent): number {
  if (row.badgeId !== event.badgeId) return 0;
  if (row.primarySetId && event.primarySetId && row.primarySetId === event.primarySetId) return 4;
  if (row.primarySessionId && row.primarySessionId === event.primarySessionId) return 3;
  if (evidenceExerciseId(row.evidence) && evidenceExerciseId(row.evidence) === evidenceExerciseId(event.evidence)) return 2;
  if (UNIQUE_BADGE_IDS.has(row.badgeId)) return 1;
  return 0;
}

/**
 * Pair stored rows with a fresh replay. Re-anchor when a later valid event exists; revoke only when none does.
 */
export function reconcileAchievements(existing: readonly StoredAchievement[], desired: readonly AchievementEvent[]): ReconcileOp[] {
  const live = existing.filter((r) => r.status !== "locked");
  const usedRows = new Set<string>();
  const ops: ReconcileOp[] = [];

  const takeBest = (event: AchievementEvent, minScore: number): StoredAchievement | null => {
    let best: StoredAchievement | null = null;
    let bestScore = 0;
    for (const row of live) {
      if (usedRows.has(row.id)) continue;
      const score = matchScore(row, event);
      if (score < minScore) continue;
      if (!best || score > bestScore || (score === bestScore && row.id < best.id)) {
        best = row;
        bestScore = score;
      }
    }
    if (!best) return null;
    usedRows.add(best.id);
    return best;
  };

  desired.forEach((event) => {
    const min = UNIQUE_BADGE_IDS.has(event.badgeId) ? 1 : 2;
    const row = takeBest(event, min);
    if (!row) {
      ops.push({ kind: "insert", event });
      return;
    }
    const sameAnchor = row.primarySessionId === event.primarySessionId && row.primarySetId === event.primarySetId && row.status === "earned";
    if (sameAnchor) return;
    if (row.status === "revoked_by_edit") ops.push({ kind: "update", id: row.id, event, action: "restore" });
    else if (row.status === "in_progress") ops.push({ kind: "update", id: row.id, event, action: "progress" });
    else ops.push({ kind: "update", id: row.id, event, action: "reanchor" });
  });

  for (const row of live) {
    if (usedRows.has(row.id)) continue;
    if (row.status === "earned") ops.push({ kind: "revoke", id: row.id, detail: { reason: "no_fallback" } });
  }

  return ops;
}
