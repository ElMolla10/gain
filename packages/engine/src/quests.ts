/**
 * Monthly quest offers and progress. Pure: never writes, never changes next-set recommendations.
 */
import {
  diffLocalDays,
  identityKey,
  isQualifyingSession,
  monthKey,
  pinReached,
  shiftLocalDate,
  weekStartOfLocalDate,
  type AchievementSession,
  type AchievementSet,
  type LiftPin,
} from "./achievements";
import { isTrustedWorkingSet } from "./outlier";
import type { EquipmentType, SetupType } from "./types";

export const QUEST_LOOKBACK_DAYS = 56;
export const QUEST_COLD_START_DAYS = 14;
export const QUEST_SWAP_THROUGH_DAY = 14;
export const QUEST_RHYTHM_DEFAULT = 3;
export const QUEST_BALANCE_RATIO = 0.8;
export const QUEST_FOUNDATION_MOVEMENTS = 5;
export const QUEST_FOUNDATION_SESSIONS = 2;

export type QuestKind = "rhythm" | "craft" | "balance" | "foundation";

export interface QuestIdentity {
  exerciseId: string;
  equipment: EquipmentType;
  setup: SetupType;
}

export interface RhythmPayload {
  targetWeeks: number;
}

export interface CraftPayload {
  identity: QuestIdentity;
  baselineLoad: number;
  baselineReps: number;
}

export interface BalancePayload {
  patterns: string[];
  ratio: number;
}

export interface FoundationPayload {
  exerciseIds: string[];
  sessionsEach: number;
}

export type QuestPayload = RhythmPayload | CraftPayload | BalancePayload | FoundationPayload;

export interface QuestCard {
  kind: QuestKind;
  titleKey: string;
  target: number;
  payload: QuestPayload;
}

export interface QuestProgress {
  current: number;
  target: number;
  complete: boolean;
  primarySessionId: string | null;
}

export interface OfferQuestsOpts {
  nowLocalDate: string;
  weekStartsOn?: number;
  programPatterns?: string[];
  programPrimaryIds?: string[];
}

export function canSwapQuest(nowLocalDate: string): boolean {
  const day = Number(nowLocalDate.slice(8, 10));
  return Number.isInteger(day) && day >= 1 && day <= QUEST_SWAP_THROUGH_DAY;
}

export function historySpanDays(sessions: readonly AchievementSession[], nowLocalDate: string): number {
  if (sessions.length === 0) return 0;
  const first = [...sessions].sort((a, b) => a.localCalendarDate.localeCompare(b.localCalendarDate))[0]!;
  return Math.max(0, diffLocalDays(first.localCalendarDate, nowLocalDate));
}

function inMonth(session: AchievementSession, month: string): boolean {
  return monthKey(session.localCalendarDate) === month;
}

function lookbackStart(nowLocalDate: string): string {
  return shiftLocalDate(nowLocalDate, -QUEST_LOOKBACK_DAYS);
}

function qualifiedWeeksIn(sessions: readonly AchievementSession[], from: string, to: string, weekStartsOn: number): string[] {
  const daysByWeek = new Map<string, Set<string>>();
  const starts: string[] = [];
  for (const s of sessions) {
    if (!isQualifyingSession(s)) continue;
    if (s.localCalendarDate < from || s.localCalendarDate > to) continue;
    const week = weekStartOfLocalDate(s.localCalendarDate, weekStartsOn);
    let days = daysByWeek.get(week);
    if (!days) {
      days = new Set();
      daysByWeek.set(week, days);
    }
    const before = days.size;
    days.add(s.localCalendarDate);
    if (before < 2 && days.size >= 2) starts.push(week);
  }
  return starts;
}

function identityCounts(sessions: readonly AchievementSession[], from: string, to: string): Map<string, { sample: AchievementSet; sessions: number; lastLoad: number; lastReps: number; prevLoad: number; prevReps: number }> {
  const out = new Map<string, { sample: AchievementSet; sessions: number; lastLoad: number; lastReps: number; prevLoad: number; prevReps: number }>();
  const ordered = [...sessions].sort((a, b) => a.finishedAtUtc - b.finishedAtUtc || a.id.localeCompare(b.id));
  for (const s of ordered) {
    if (s.localCalendarDate < from || s.localCalendarDate > to) continue;
    const seen = new Set<string>();
    for (const set of s.sets) {
      if (!isTrustedWorkingSet(set) || set.reps < 3) continue;
      const key = identityKey(set.exerciseId, set.equipment, set.setup);
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = out.get(key);
      if (!cur) {
        out.set(key, { sample: set, sessions: 1, lastLoad: set.load, lastReps: set.reps, prevLoad: set.load, prevReps: set.reps });
      } else {
        cur.sessions += 1;
        cur.prevLoad = cur.lastLoad;
        cur.prevReps = cur.lastReps;
        cur.lastLoad = set.load;
        cur.lastReps = set.reps;
      }
    }
  }
  return out;
}

function notStalled(row: { lastLoad: number; lastReps: number; prevLoad: number; prevReps: number; sample: AchievementSet }): boolean {
  const assisted = row.sample.setup === "assisted";
  if (assisted) return row.lastLoad <= row.prevLoad + 1e-6 || row.lastReps >= row.prevReps;
  return row.lastLoad + 1e-6 >= row.prevLoad || row.lastReps >= row.prevReps;
}

function rhythmCard(sessions: readonly AchievementSession[], nowLocalDate: string, weekStartsOn: number): QuestCard {
  const from = lookbackStart(nowLocalDate);
  const weeks = qualifiedWeeksIn(sessions, from, nowLocalDate, weekStartsOn);
  const months = Math.max(1, QUEST_LOOKBACK_DAYS / 28);
  const typical = weeks.length / months;
  const targetWeeks = typical >= 3 ? 4 : QUEST_RHYTHM_DEFAULT;
  return { kind: "rhythm", titleKey: "quest.rhythm.title", target: targetWeeks, payload: { targetWeeks } };
}

function craftCard(sessions: readonly AchievementSession[], nowLocalDate: string, primaryIds: string[]): QuestCard | null {
  const from = lookbackStart(nowLocalDate);
  const counts = identityCounts(sessions, from, nowLocalDate);
  const ranked = [...counts.entries()]
    .filter(([, v]) => v.sessions >= 2 && notStalled(v))
    .sort((a, b) => {
      const aCore = primaryIds.includes(a[1].sample.exerciseId) ? 1 : 0;
      const bCore = primaryIds.includes(b[1].sample.exerciseId) ? 1 : 0;
      return bCore - aCore || b[1].sessions - a[1].sessions || a[0].localeCompare(b[0]);
    });
  const pick = ranked[0]?.[1];
  if (!pick) return null;
  return {
    kind: "craft",
    titleKey: "quest.craft.title",
    target: 1,
    payload: {
      identity: { exerciseId: pick.sample.exerciseId, equipment: pick.sample.equipment, setup: pick.sample.setup },
      baselineLoad: pick.lastLoad,
      baselineReps: pick.lastReps,
    },
  };
}

function balanceCard(programPatterns: string[]): QuestCard | null {
  const patterns = [...new Set(programPatterns.filter(Boolean))];
  if (patterns.length === 0) return null;
  const target = Math.max(1, Math.ceil(patterns.length * QUEST_BALANCE_RATIO));
  return { kind: "balance", titleKey: "quest.balance.title", target, payload: { patterns, ratio: QUEST_BALANCE_RATIO } };
}

function foundationCards(programPrimaryIds: string[], sessions: readonly AchievementSession[]): QuestCard[] {
  const ids = programPrimaryIds.slice(0, QUEST_FOUNDATION_MOVEMENTS);
  const fallback = new Map<string, number>();
  for (const s of sessions) {
    for (const set of s.sets) {
      if (!isTrustedWorkingSet(set)) continue;
      fallback.set(set.exerciseId, (fallback.get(set.exerciseId) ?? 0) + 1);
    }
  }
  const extras = [...fallback.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const exerciseIds = [...new Set([...ids, ...extras])].slice(0, QUEST_FOUNDATION_MOVEMENTS);
  return [
    {
      kind: "foundation",
      titleKey: "quest.foundation.baselines",
      target: Math.max(exerciseIds.length, 1) * QUEST_FOUNDATION_SESSIONS,
      payload: { exerciseIds, sessionsEach: QUEST_FOUNDATION_SESSIONS },
    },
    { kind: "foundation", titleKey: "quest.foundation.sessions", target: 4, payload: { exerciseIds, sessionsEach: 1 } },
    { kind: "foundation", titleKey: "quest.foundation.patterns", target: 3, payload: { exerciseIds, sessionsEach: 1 } },
  ];
}

/**
 * Three tailored cards for the current month. Cold-start (< 14 days of history) returns foundational cards.
 * Callers persist the pick; this function never writes.
 */
export function offerMonthlyQuests(sessions: readonly AchievementSession[], opts: OfferQuestsOpts): QuestCard[] {
  const weekStartsOn = opts.weekStartsOn ?? 1;
  const span = historySpanDays(sessions, opts.nowLocalDate);
  if (span < QUEST_COLD_START_DAYS) return foundationCards(opts.programPrimaryIds ?? [], sessions).slice(0, 3);
  const rhythm = rhythmCard(sessions, opts.nowLocalDate, weekStartsOn);
  const craft = craftCard(sessions, opts.nowLocalDate, opts.programPrimaryIds ?? []);
  const balance = balanceCard(opts.programPatterns ?? []);
  const cards: QuestCard[] = [rhythm];
  if (craft) cards.push(craft);
  if (balance) cards.push(balance);
  if (cards.length < 3) {
    for (const extra of foundationCards(opts.programPrimaryIds ?? [], sessions)) {
      if (cards.length >= 3) break;
      if (!cards.some((c) => c.titleKey === extra.titleKey)) cards.push(extra);
    }
  }
  return cards.slice(0, 3);
}

export function questProgress(card: QuestCard, sessions: readonly AchievementSession[], opts: { nowLocalDate: string; weekStartsOn?: number }): QuestProgress {
  const weekStartsOn = opts.weekStartsOn ?? 1;
  const month = monthKey(opts.nowLocalDate);
  const inScope = [...sessions].filter((s) => inMonth(s, month)).sort((a, b) => a.finishedAtUtc - b.finishedAtUtc || a.id.localeCompare(b.id));
  if (card.kind === "rhythm") {
    const payload = card.payload as RhythmPayload;
    const weeks = qualifiedWeeksIn(inScope, `${month}-01`, opts.nowLocalDate, weekStartsOn);
    const last = inScope.filter(isQualifyingSession).at(-1);
    return { current: weeks.length, target: payload.targetWeeks, complete: weeks.length >= payload.targetWeeks, primarySessionId: last?.id ?? null };
  }
  if (card.kind === "craft") {
    const payload = card.payload as CraftPayload;
    const pin: LiftPin = { exerciseId: payload.identity.exerciseId, equipment: payload.identity.equipment, setup: payload.identity.setup, load: payload.baselineLoad, reps: payload.baselineReps };
    for (const s of inScope) {
      for (const set of s.sets) {
        if (!pinReached(pin, set)) continue;
        const assisted = set.setup === "assisted";
        const better = assisted ? set.load < payload.baselineLoad - 1e-6 || (Math.abs(set.load - payload.baselineLoad) < 1e-6 && set.reps > payload.baselineReps)
          : set.load > payload.baselineLoad + 1e-6 || (Math.abs(set.load - payload.baselineLoad) < 1e-6 && set.reps > payload.baselineReps);
        if (better) return { current: 1, target: 1, complete: true, primarySessionId: s.id };
      }
    }
    return { current: 0, target: 1, complete: false, primarySessionId: null };
  }
  if (card.kind === "balance") {
    const payload = card.payload as BalancePayload;
    const seen = new Set<string>();
    let lastId: string | null = null;
    for (const s of inScope) {
      if (!isQualifyingSession(s)) continue;
      for (const set of s.sets) {
        if (isTrustedWorkingSet(set) && set.pattern && payload.patterns.includes(set.pattern)) seen.add(set.pattern);
      }
      lastId = s.id;
    }
    return { current: seen.size, target: card.target, complete: seen.size >= card.target, primarySessionId: lastId };
  }
  const payload = card.payload as FoundationPayload;
  if (card.titleKey === "quest.foundation.sessions") {
    const n = inScope.filter(isQualifyingSession).length;
    return { current: n, target: card.target, complete: n >= card.target, primarySessionId: inScope.filter(isQualifyingSession).at(-1)?.id ?? null };
  }
  if (card.titleKey === "quest.foundation.patterns") {
    const seen = new Set<string>();
    let lastId: string | null = null;
    for (const s of inScope) {
      if (!isQualifyingSession(s)) continue;
      for (const set of s.sets) {
        if (isTrustedWorkingSet(set) && set.pattern) seen.add(set.pattern);
      }
      lastId = s.id;
    }
    return { current: seen.size, target: card.target, complete: seen.size >= card.target, primarySessionId: lastId };
  }
  const counts = new Map<string, number>();
  let lastId: string | null = null;
  for (const s of inScope) {
    const ids = new Set<string>();
    for (const set of s.sets) {
      if (!isTrustedWorkingSet(set)) continue;
      if (payload.exerciseIds.length > 0 && !payload.exerciseIds.includes(set.exerciseId)) continue;
      ids.add(set.exerciseId);
    }
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    if (ids.size > 0) lastId = s.id;
  }
  const current = [...counts.values()].reduce((n, v) => n + Math.min(v, payload.sessionsEach), 0);
  return { current, target: card.target, complete: current >= card.target, primarySessionId: lastId };
}
