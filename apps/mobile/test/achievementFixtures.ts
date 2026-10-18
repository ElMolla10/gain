// Shared fixture rows for the round-2 showcase tests (sample data, not a real lifter).
import { ACHIEVEMENT_CATALOG, type AchievementEvidence, type IdentityRef } from "@gain/engine";
import { buildCabinet, type SurfaceBadge } from "../src/logic/achievementSurface";

export function row(partial: Partial<SurfaceBadge> & Pick<SurfaceBadge, "id" | "badgeId">): SurfaceBadge {
  const def = ACHIEVEMENT_CATALOG.find((b) => b.id === partial.badgeId);
  return {
    i18nKey: def?.i18nKey ?? "achv.firstSession",
    family: def?.family ?? "first_session",
    status: "earned",
    earnedAtUtc: 1,
    earnedLocalDate: "2026-01-05",
    primarySessionId: "s1",
    evidence: null,
    progressCurrent: null,
    progressTarget: null,
    isBackfilled: false,
    exerciseNameEn: null,
    exerciseNameAr: null,
    ...partial,
  };
}

export const BENCH: IdentityRef = { exerciseId: "bench", equipment: "barbell", setup: "free" };
export const CURL: IdentityRef = { exerciseId: "preacher", equipment: "dumbbell", setup: "free" };
export const PULLUP: IdentityRef = { exerciseId: "pullup", equipment: "assisted", setup: "assisted" };

export function pr(
  id: string,
  identity: IdentityRef,
  before: [number, number],
  after: [number, number],
  opts: { at?: number; date?: string; path?: "A" | "B"; nameEn?: string; nameAr?: string } = {},
): SurfaceBadge {
  const date = opts.date ?? "2026-03-03";
  const evidence: AchievementEvidence = {
    kind: "strength_pr",
    path: opts.path ?? "A",
    identity,
    previousBest: { setId: `${id}-p`, sessionId: `${id}-ps`, load: before[0], reps: before[1], localDate: "2026-01-01" },
    newBest: { setId: `${id}-n`, sessionId: `${id}-s`, load: after[0], reps: after[1], localDate: date },
    deltas: { load: identity.setup === "assisted" ? before[0] - after[0] : after[0] - before[0], reps: after[1] - before[1], e1rmPct: 3 },
  };
  return row({
    id,
    badgeId: "strength_pr",
    earnedAtUtc: opts.at ?? 1,
    earnedLocalDate: date,
    primarySessionId: `${id}-s`,
    evidence,
    exerciseNameEn: opts.nameEn ?? "Bench Press",
    exerciseNameAr: opts.nameAr ?? "بنش",
  });
}

export const progress = (badgeId: string, current: number, target: number): SurfaceBadge =>
  row({ id: `p:${badgeId}`, badgeId, status: "in_progress", earnedAtUtc: null, earnedLocalDate: null, primarySessionId: null, progressCurrent: current, progressTarget: target });

export const earned = (badgeId: string, at: number, date = "2026-02-01", evidence: AchievementEvidence | null = null): SurfaceBadge =>
  row({ id: `e:${badgeId}:${at}`, badgeId, earnedAtUtc: at, earnedLocalDate: date, evidence });

/** A mid-level lifter: 412 training days, a few PRs, partly filled shelves. */
export function sampleCabinet(): SurfaceBadge[] {
  return buildCabinet([
    earned("first_session", 10, "2024-03-09", { kind: "first_session", sessionId: "s0", trustedWorkingSets: 9 }),
    earned("qualified_weeks_4", 20, "2024-04-02"),
    earned("qualified_weeks_12", 30, "2024-06-20"),
    earned("hundred_club_100", 40, "2024-09-01", { kind: "hundred_club", tier: 100, days: 100 }),
    earned("hundred_club_250", 50, "2025-05-01", { kind: "hundred_club", tier: 250, days: 250 }),
    progress("hundred_club_500", 412, 500),
    progress("hundred_club_1000", 412, 1000),
    earned("multi_year_2", 45, "2025-01-05", { kind: "multi_year", tier: 2, years: 2 }),
    progress("multi_year_3", 2, 3),
    progress("multi_year_5", 2, 5),
    earned("dedicated_10", 35, "2024-07-01"),
    earned("dedicated_25", 55, "2025-03-01"),
    progress("dedicated_50", 38, 50),
    progress("dedicated_100", 38, 100),
    progress("full_spectrum_4", 3, 4),
    progress("full_spectrum_12", 3, 12),
    progress("workhorse", 2, 3),
    pr("pr1", CURL, [10, 8], [12, 8], { at: 100, date: "2026-03-03", nameEn: "Preacher Curl", nameAr: "بريتشر كيرل" }),
    pr("pr2", CURL, [12, 8], [12, 9], { at: 200, date: "2026-05-10", nameEn: "Preacher Curl", nameAr: "بريتشر كيرل" }),
    pr("pr3", BENCH, [60, 8], [62.5, 8], { at: 250, date: "2026-06-01" }),
    pr("pr4", CURL, [12, 9], [16, 6], { at: 300, date: "2026-10-12", path: "B", nameEn: "Preacher Curl", nameAr: "بريتشر كيرل" }),
    earned("comeback", 150, "2025-08-01", { kind: "comeback", sessionId: "s9", gapDays: 21, qualifiedWeeksBeforeGap: 10, lastSessionId: "s8", lastLocalDate: "2025-07-10" }),
    earned("comeback", 160, "2026-01-20", { kind: "comeback", sessionId: "s19", gapDays: 18, qualifiedWeeksBeforeGap: 12, lastSessionId: "s18", lastLocalDate: "2026-01-01" }),
  ]);
}
