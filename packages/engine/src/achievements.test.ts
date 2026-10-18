import { describe, expect, it } from "vitest";
import {
  evaluateAchievements,
  logicalTrainingDate,
  reconcileAchievements,
  repBand,
  shiftLocalDate,
  type AchievementEvent,
  type AchievementSession,
  type AchievementSet,
  type StoredAchievement,
} from "./achievements";
import type { EquipmentType, SetupType } from "./types";

const day = (n: number) => shiftLocalDate("2026-01-05", n); // Monday 5 Jan 2026

function working(id: string, exerciseId: string, load: number, reps: number, extra: Partial<AchievementSet> = {}): AchievementSet {
  return {
    id,
    exerciseId,
    equipment: (extra.equipment ?? "barbell") as EquipmentType,
    setup: (extra.setup ?? "free") as SetupType,
    load,
    reps,
    warmup: extra.warmup ?? false,
    tags: extra.tags ?? [],
    outlierStatus: extra.outlierStatus ?? "none",
    durationS: extra.durationS,
    distanceM: extra.distanceM,
    pattern: extra.pattern,
    measure: extra.measure,
  };
}

function workout(id: string, localDate: string, sets: AchievementSet[], finishedAtUtc = Date.parse(`${localDate}T12:00:00Z`)): AchievementSession {
  return { id, finishedAtUtc, localCalendarDate: localDate, sets };
}

function three(id: string, exerciseId: string, load: number, reps: number, extra: Partial<AchievementSet> = {}): AchievementSet[] {
  return [0, 1, 2].map((i) => working(`${id}-${i}`, exerciseId, load, reps, extra));
}

function ids(earned: AchievementEvent[]): string[] {
  return earned.map((e) => e.badgeId);
}

function prs(earned: AchievementEvent[]): AchievementEvent[] {
  return earned.filter((e) => e.badgeId === "strength_pr");
}

/** Three qualifying days in each of `n` consecutive calendar weeks, starting Monday `start`. */
function qualifiedWeeks(n: number, start = 0, prefix = "w"): AchievementSession[] {
  const out: AchievementSession[] = [];
  for (let w = 0; w < n; w++) {
    for (let d = 0; d < 2; d++) {
      const date = day(start + w * 7 + d);
      const id = `${prefix}${w}${d}`;
      out.push(workout(id, date, three(`${id}-s`, "bench", 60, 8)));
    }
  }
  return out;
}

describe("logical training day (04:00 boundary)", () => {
  it("keeps the calendar date at 04:00 and after", () => {
    expect(logicalTrainingDate({ year: 2026, month: 3, day: 10, hour: 4, minute: 0 })).toBe("2026-03-10");
    expect(logicalTrainingDate({ year: 2026, month: 3, day: 10, hour: 23, minute: 59 })).toBe("2026-03-10");
  });
  it("rolls back to the previous date before 04:00", () => {
    expect(logicalTrainingDate({ year: 2026, month: 3, day: 10, hour: 3, minute: 59 })).toBe("2026-03-09");
    expect(logicalTrainingDate({ year: 2026, month: 1, day: 1, hour: 0, minute: 0 })).toBe("2025-12-31");
  });
  it("counts a 03:00 finish on the previous logical day for a qualified week", () => {
    const s1 = workout("a", "2026-01-05", three("a", "bench", 60, 8));
    const s2 = { ...workout("b", "2026-01-06", three("b", "bench", 60, 8)), localCalendarDate: logicalTrainingDate({ year: 2026, month: 1, day: 7, hour: 3, minute: 0 }) };
    expect(s2.localCalendarDate).toBe("2026-01-06");
    const r = evaluateAchievements([s1, s2], { weekStartsOn: 1, nowLocalDate: "2026-01-06" });
    expect(r.pulse.qualified).toBe(true);
    expect(r.pulse.qualifiedDays).toBe(2);
  });
});

describe("first session", () => {
  it("awards the first finished workout with at least 3 trusted working sets, once", () => {
    const weak = workout("w", day(0), [working("w0", "bench", 60, 8), working("w1", "bench", 60, 8)]);
    const first = workout("a", day(1), three("a", "bench", 60, 8));
    const second = workout("b", day(2), three("b", "bench", 60, 8));
    const r = evaluateAchievements([weak, first, second]);
    const fs = r.earned.filter((e) => e.badgeId === "first_session");
    expect(fs).toHaveLength(1);
    expect(fs[0]!.primarySessionId).toBe("a");
    expect(fs[0]!.evidence).toMatchObject({ kind: "first_session", trustedWorkingSets: 3 });
  });
  it("ignores warmups, drop sets and unconfirmed outliers toward the three-set bar", () => {
    const s = workout("a", day(0), [
      working("w", "bench", 40, 10, { warmup: true }),
      working("d", "bench", 50, 10, { tags: ["drop"] }),
      working("u", "bench", 80, 10, { outlierStatus: "unconfirmed" }),
      working("ok", "bench", 60, 8),
    ]);
    expect(ids(evaluateAchievements([s]).earned)).toEqual([]);
  });
});

describe("qualified weeks", () => {
  it("needs two distinct logical days with a 3-set workout each", () => {
    const oneDay = [workout("a", day(0), three("a", "bench", 60, 8)), workout("b", day(0), three("b", "bench", 60, 8))];
    expect(evaluateAchievements(oneDay, { nowLocalDate: day(0) }).stats.qualifiedWeeksLifetime).toBe(0);
    const twoDays = [workout("a", day(0), three("a", "bench", 60, 8)), workout("b", day(1), three("b", "bench", 60, 8))];
    expect(evaluateAchievements(twoDays, { nowLocalDate: day(1) }).stats.qualifiedWeeksLifetime).toBe(1);
  });
  it("awards tiers at 4 and 12 and tracks the consecutive run", () => {
    const r4 = evaluateAchievements(qualifiedWeeks(4), { nowLocalDate: day(3 * 7 + 1) });
    expect(ids(r4.earned).filter((id) => id.startsWith("qualified_weeks_"))).toEqual(["qualified_weeks_4"]);
    expect(r4.stats.qualifiedWeeksLifetime).toBe(4);
    expect(r4.stats.qualifiedWeeksConsecutive).toBe(4);
    const r12 = evaluateAchievements(qualifiedWeeks(12), { nowLocalDate: day(11 * 7 + 1) });
    expect(ids(r12.earned).filter((id) => id.startsWith("qualified_weeks_"))).toEqual(["qualified_weeks_4", "qualified_weeks_12"]);
  });
  it("resets the consecutive run after a skipped week", () => {
    const sessions = [...qualifiedWeeks(2, 0, "a"), ...qualifiedWeeks(1, 21, "b")];
    const r = evaluateAchievements(sessions, { nowLocalDate: day(22) });
    expect(r.stats.qualifiedWeeksLifetime).toBe(3);
    expect(r.stats.qualifiedWeeksConsecutive).toBe(1);
  });
});

describe("verified strength PR", () => {
  it("does not award on identity sessions 1 or 2; detection starts at session 3", () => {
    const s1 = workout("1", day(0), three("1", "bench", 60, 8));
    const s2 = workout("2", day(1), three("2", "bench", 62.5, 8));
    const s3 = workout("3", day(2), three("3", "bench", 65, 8));
    expect(prs(evaluateAchievements([s1]).earned)).toHaveLength(0);
    expect(prs(evaluateAchievements([s1, s2]).earned)).toHaveLength(0);
    const r = evaluateAchievements([s1, s2, s3]);
    expect(prs(r.earned)).toHaveLength(1);
    expect(prs(r.earned)[0]!.evidence).toMatchObject({ kind: "strength_pr", path: "A", previousBest: { load: 62.5, reps: 8 }, newBest: { load: 65, reps: 8 } });
  });

  it("Path A: higher load at equal reps with a 1 kg step, or same peak load plus one rep", () => {
    const base = [
      workout("1", day(0), three("1", "bench", 60, 8)),
      workout("2", day(1), three("2", "bench", 60, 8)),
    ];
    const load = workout("3", day(2), three("3", "bench", 61, 8));
    expect(prs(evaluateAchievements([...base, load]).earned)[0]!.evidence).toMatchObject({ path: "A" });
    const tiny = workout("3b", day(2), three("3b", "bench", 60.5, 8));
    expect(prs(evaluateAchievements([...base, tiny]).earned)).toHaveLength(0);
    const reps = workout("3c", day(2), three("3c", "bench", 60, 9));
    expect(prs(evaluateAchievements([...base, reps]).earned)[0]!.evidence).toMatchObject({ path: "A", newBest: { load: 60, reps: 9 } });
  });

  it("assisted polarity: lower assistance is the PR", () => {
    const extra = { equipment: "assisted" as const, setup: "assisted" as const };
    const s1 = workout("1", day(0), three("1", "dip", 40, 8, extra));
    const s2 = workout("2", day(1), three("2", "dip", 40, 8, extra));
    const worse = workout("3", day(2), three("3", "dip", 45, 8, extra));
    const better = workout("4", day(3), three("4", "dip", 35, 8, extra));
    expect(prs(evaluateAchievements([s1, s2, worse]).earned)).toHaveLength(0);
    const r = evaluateAchievements([s1, s2, better]);
    expect(prs(r.earned)[0]!.evidence).toMatchObject({ path: "A", previousBest: { load: 40 }, newBest: { load: 35 } });
  });

  it("excludes 1–2 reps and >15 reps from the badge", () => {
    const s1 = workout("1", day(0), three("1", "bench", 60, 8));
    const s2 = workout("2", day(1), three("2", "bench", 60, 8));
    const singles = workout("3", day(2), three("3", "bench", 100, 1));
    const pump = workout("4", day(3), three("4", "bench", 40, 20));
    expect(prs(evaluateAchievements([s1, s2, singles, pump]).earned)).toHaveLength(0);
  });

  it("Path B stays inside a rep band and needs a 2.5% e1RM gain; it never compares across bands", () => {
    expect(repBand(5)).toBe("3-5");
    expect(repBand(6)).toBe("6-10");
    const base = [
      workout("1", day(0), three("1", "bench", 80, 8)),
      workout("2", day(1), three("2", "bench", 80, 8)),
    ];
    // 80x8 epley = 80*1.2666... ; 82x6 epley = 82*1.2 = 98.4 ; 80*1.2666=101.33. Gain negative, same band 6-10.
    const sameBandLight = workout("3", day(2), three("3", "bench", 82, 6));
    expect(prs(evaluateAchievements([...base, sameBandLight]).earned)).toHaveLength(0);
    // 84x8 vs 80x8 = 5% e1RM, Path A also applies (higher load equal reps). Force Path B with lower load, more reps, same band.
    // 80x6 vs 80x8 is fewer reps, same load — not Path A. epley 80*1.2 vs 80*1.2667 is a loss.
    // 78x10 vs 80x8: Path A no (lower load). Same band 6-10. epley 78*1.333=104 vs 80*1.2667=101.33 → 2.64% Path B.
    const pathB = workout("3b", day(2), three("3b", "bench", 78, 10));
    const hit = prs(evaluateAchievements([...base, pathB]).earned)[0];
    expect(hit?.evidence).toMatchObject({ path: "B" });
    // 100x4 is band 3-5 vs 6-10 — no Path A (fewer reps), no Path B (cross band).
    const cross = workout("3c", day(2), three("3c", "bench", 100, 4));
    expect(prs(evaluateAchievements([...base, cross]).earned)).toHaveLength(0);
  });

  it("awards at most one PR event per exercise per session, anchored to the highest-value set", () => {
    const base = [
      workout("1", day(0), three("1", "bench", 60, 8)),
      workout("2", day(1), three("2", "bench", 60, 8)),
    ];
    const mixed = workout("3", day(2), [
      working("a", "bench", 61, 8),
      working("b", "bench", 65, 8),
      working("c", "bench", 62.5, 8),
    ]);
    const hits = prs(evaluateAchievements([...base, mixed]).earned);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.primarySetId).toBe("b");
    expect(hits[0]!.evidence).toMatchObject({ newBest: { load: 65, setId: "b" } });
  });

  it("keeps distinct identities (exercise + equipment + setup) on separate streams", () => {
    const assisted = { setup: "assisted" as const, equipment: "assisted" as const };
    const s1 = workout("1", day(0), [...three("1f", "bench", 60, 8), ...three("1a", "bench", 40, 8, assisted)]);
    const s2 = workout("2", day(1), [...three("2f", "bench", 60, 8), ...three("2a", "bench", 40, 8, assisted)]);
    const s3 = workout("3", day(2), three("3f", "bench", 65, 8));
    const s4 = workout("4", day(3), three("4a", "bench", 30, 8, assisted));
    const hits = prs(evaluateAchievements([s1, s2, s3, s4]).earned);
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.evidence.kind === "strength_pr" && h.evidence.identity.setup)).toEqual(["free", "assisted"]);
  });
});

describe("comeback", () => {
  it("awards the first session after a 14+ day gap when at least 3 qualified weeks existed before it", () => {
    const prior = qualifiedWeeks(3);
    const last = prior[prior.length - 1]!;
    const back = workout("back", shiftLocalDate(last.localCalendarDate, 14), three("back", "bench", 60, 8));
    const r = evaluateAchievements([...prior, back]);
    const c = r.earned.filter((e) => e.badgeId === "comeback");
    expect(c).toHaveLength(1);
    expect(c[0]!.evidence).toMatchObject({ kind: "comeback", gapDays: 14, qualifiedWeeksBeforeGap: 3 });
  });
  it("does not award without three qualified weeks before the gap", () => {
    const prior = qualifiedWeeks(2);
    const back = workout("back", day(2 * 7 + 14), three("back", "bench", 60, 8));
    expect(evaluateAchievements([...prior, back]).earned.filter((e) => e.badgeId === "comeback")).toHaveLength(0);
  });
  it("enforces a 90-day cooldown after a comeback", () => {
    const prior = qualifiedWeeks(3);
    const back1 = workout("b1", day(3 * 7 + 14), three("b1", "bench", 60, 8));
    const fill = workout("f", shiftLocalDate(back1.localCalendarDate, 1), three("f", "bench", 60, 8)); // keep history moving
    const early = workout("b2", shiftLocalDate(back1.localCalendarDate, 89), three("b2", "bench", 60, 8));
    const late = workout("b3", shiftLocalDate(back1.localCalendarDate, 90), three("b3", "bench", 60, 8));
    expect(evaluateAchievements([...prior, back1, fill, early]).earned.filter((e) => e.badgeId === "comeback")).toHaveLength(1);
    expect(evaluateAchievements([...prior, back1, fill, late]).earned.filter((e) => e.badgeId === "comeback")).toHaveLength(2);
  });
});

describe("reconcile: re-anchor vs revoke", () => {
  const ev = (sessionId: string, setId: string, date: string): AchievementEvent => ({
    badgeId: "strength_pr",
    ruleVersion: 1,
    earnedAtUtc: 1,
    earnedLocalDate: date,
    primarySessionId: sessionId,
    primarySetId: setId,
    progressCurrent: 1,
    progressTarget: 1,
    evidence: {
      kind: "strength_pr",
      path: "A",
      identity: { exerciseId: "bench", equipment: "barbell", setup: "free" },
      previousBest: { setId: "p", sessionId: "s0", load: 60, reps: 8, localDate: date },
      newBest: { setId, sessionId, load: 65, reps: 8, localDate: date },
      deltas: { load: 5, reps: 0, e1rmPct: 8 },
    },
  });
  const row = (id: string, sessionId: string, setId: string): StoredAchievement => ({
    id,
    badgeId: "strength_pr",
    status: "earned",
    primarySessionId: sessionId,
    primarySetId: setId,
    earnedLocalDate: day(2),
    evidence: ev(sessionId, setId, day(2)).evidence,
  });

  it("re-anchors a badge onto the next valid session when the original set is gone", () => {
    const ops = reconcileAchievements([row("r1", "s3", "gone")], [ev("s4", "next", day(3))]);
    expect(ops).toEqual([expect.objectContaining({ kind: "update", id: "r1", action: "reanchor" })]);
    expect(ops[0]).toMatchObject({ event: { primarySetId: "next", primarySessionId: "s4" } });
  });
  it("revokes only when no fallback event exists", () => {
    const ops = reconcileAchievements([row("r1", "s3", "gone")], []);
    expect(ops).toEqual([{ kind: "revoke", id: "r1", detail: { reason: "no_fallback" } }]);
  });
  it("leaves an unrelated earned badge untouched when another event is revoked", () => {
    const other: StoredAchievement = {
      id: "first",
      badgeId: "first_session",
      status: "earned",
      primarySessionId: "s1",
      primarySetId: null,
      earnedLocalDate: day(0),
      evidence: { kind: "first_session", sessionId: "s1", trustedWorkingSets: 3 },
    };
    const firstEvent: AchievementEvent = {
      badgeId: "first_session",
      ruleVersion: 1,
      earnedAtUtc: 1,
      earnedLocalDate: day(0),
      primarySessionId: "s1",
      primarySetId: null,
      progressCurrent: 1,
      progressTarget: 1,
      evidence: { kind: "first_session", sessionId: "s1", trustedWorkingSets: 3 },
    };
    const ops = reconcileAchievements([other, row("r1", "s3", "gone")], [firstEvent]);
    expect(ops.filter((o) => o.kind === "revoke")).toEqual([{ kind: "revoke", id: "r1", detail: { reason: "no_fallback" } }]);
    expect(ops.some((o) => o.kind === "revoke" && o.id === "first")).toBe(false);
  });
});

describe("dedicated", () => {
  it("awards the first core lift to hit 10 distinct sessions", () => {
    const sessions = Array.from({ length: 10 }, (_, i) => workout(`d${i}`, day(i), three(`d${i}`, "bench", 60, 8)));
    const r = evaluateAchievements(sessions, { programPrimaryIds: ["bench"] });
    expect(ids(r.earned).filter((id) => id.startsWith("dedicated_"))).toEqual(["dedicated_10"]);
    expect(r.earned.find((e) => e.badgeId === "dedicated_10")!.evidence).toMatchObject({ kind: "dedicated", sessions: 10 });
  });
  it("does not count a second identity toward the same unique tier", () => {
    const bench = Array.from({ length: 10 }, (_, i) => workout(`b${i}`, day(i), three(`b${i}`, "bench", 60, 8)));
    const squat = Array.from({ length: 10 }, (_, i) => workout(`s${i}`, day(10 + i), three(`s${i}`, "squat", 80, 5)));
    const r = evaluateAchievements([...bench, ...squat], { programPrimaryIds: ["bench", "squat"] });
    expect(ids(r.earned).filter((id) => id === "dedicated_10")).toHaveLength(1);
  });
});

describe("block builder", () => {
  it("awards verified improvement on one lift across 3 consecutive months", () => {
    const sessions: AchievementSession[] = [];
    for (const [monthOffset, load] of [[0, 60], [32, 62], [60, 64]] as const) {
      sessions.push(workout(`a${monthOffset}`, day(monthOffset), three(`a${monthOffset}a`, "bench", load, 8)));
      sessions.push(workout(`b${monthOffset}`, day(monthOffset + 2), three(`b${monthOffset}a`, "bench", load, 8)));
      sessions.push(workout(`c${monthOffset}`, day(monthOffset + 4), three(`c${monthOffset}a`, "bench", load + 2, 8)));
    }
    const hits = evaluateAchievements(sessions).earned.filter((e) => e.badgeId === "block_builder");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.evidence).toMatchObject({ kind: "block_builder" });
  });
});

describe("full spectrum", () => {
  it("awards when every program pattern appears in the last 4 qualified weeks", () => {
    const sessions = qualifiedWeeks(4).map((s, i) => ({
      ...s,
      sets: s.sets.map((set, j) => ({ ...set, pattern: i % 2 === 0 ? (j === 0 ? "horizontal_push" : "squat") : "horizontal_push" })),
    }));
    // Ensure both patterns exist in the window: stamp squat onto one set of each week.
    for (let w = 0; w < 4; w++) {
      sessions[w * 2]!.sets[0] = { ...sessions[w * 2]!.sets[0]!, pattern: "horizontal_push" };
      sessions[w * 2 + 1]!.sets[0] = { ...sessions[w * 2 + 1]!.sets[0]!, pattern: "squat" };
    }
    const r = evaluateAchievements(sessions, { programPatterns: ["horizontal_push", "squat"], nowLocalDate: day(3 * 7 + 1) });
    expect(ids(r.earned)).toContain("full_spectrum_4");
  });
  it("never penalizes extra patterns and skips an empty program", () => {
    const sessions = qualifiedWeeks(4);
    expect(ids(evaluateAchievements(sessions, { programPatterns: [] }).earned)).not.toContain("full_spectrum_4");
    const stamped: AchievementSession[] = sessions.map((s) => ({ ...s, sets: s.sets.map((set) => ({ ...set, pattern: "horizontal_push" })) }));
    stamped[0] = { ...stamped[0]!, sets: [...stamped[0]!.sets, working("extra", "curl", 20, 12, { pattern: "curl" })] };
    expect(ids(evaluateAchievements(stamped, { programPatterns: ["horizontal_push"], nowLocalDate: day(3 * 7 + 1) }).earned)).toContain("full_spectrum_4");
  });
});

describe("iron hold and carry", () => {
  it("awards a longer hold in a matched load band after two baseline sessions", () => {
    const hold = (id: string, d: number, dur: number, load = 40): AchievementSession =>
      workout(id, day(d), [0, 1, 2].map((i) => working(`${id}-${i}`, "plank", load, 1, { durationS: dur, measure: "time" as const })));
    const r = evaluateAchievements([hold("1", 0, 30), hold("2", 1, 30), hold("3", 2, 40)]);
    expect(r.earned.filter((e) => e.badgeId === "iron_hold")).toHaveLength(1);
  });
  it("awards a longer carry at matched load after two baseline sessions", () => {
    const carry = (id: string, d: number, dist: number, load = 24): AchievementSession =>
      workout(id, day(d), [0, 1, 2].map((i) => working(`${id}-${i}`, "carry", load, 1, { distanceM: dist, measure: "distance" as const })));
    const r = evaluateAchievements([carry("1", 0, 20), carry("2", 1, 20), carry("3", 2, 30)]);
    expect(r.earned.filter((e) => e.badgeId === "iron_carry")).toHaveLength(1);
  });
});

describe("workhorse", () => {
  it("awards the first path-A improvement in the 12–20 band after two baseline sessions", () => {
    const s1 = workout("1", day(0), three("1", "row", 40, 15));
    const s2 = workout("2", day(1), three("2", "row", 40, 15));
    const s3 = workout("3", day(2), three("3", "row", 42.5, 15));
    const r = evaluateAchievements([s1, s2, s3]);
    expect(r.earned.filter((e) => e.badgeId === "workhorse")).toHaveLength(1);
  });
});

describe("hundred club and multi-year iron", () => {
  it("awards 100 distinct qualifying days", () => {
    const sessions: AchievementSession[] = [];
    for (let i = 0; i < 100; i++) sessions.push(workout(`h${i}`, day(i), three(`h${i}`, "bench", 60, 8)));
    const r = evaluateAchievements(sessions, { nowLocalDate: day(99) });
    expect(ids(r.earned)).toContain("hundred_club_100");
    expect(r.inProgress.some((p) => p.badgeId === "hundred_club_250" && p.current === 100)).toBe(true);
  });
  it("passes the training-day and active-year counts through stats (display only, past every tier)", () => {
    const sessions: AchievementSession[] = [];
    // Alternate exercises so no PR chain grows; 1043 qualifying days clears hundred_club_1000.
    for (let i = 0; i < 1043; i++) sessions.push(workout(`d${i}`, day(i), three(`d${i}`, i % 2 ? "row" : "bench", 60, 8)));
    const r = evaluateAchievements(sessions, { nowLocalDate: day(1042) });
    expect(ids(r.earned)).toContain("hundred_club_1000");
    expect(r.inProgress.some((p) => p.badgeId.startsWith("hundred_club_"))).toBe(false);
    expect(r.stats.qualifyingDays).toBe(1043);
    expect(r.stats.activeYears).toBe(3);
    const small = evaluateAchievements(sessions.slice(0, 40), { nowLocalDate: day(39) });
    expect(small.stats.qualifyingDays).toBe(40);
    expect(small.inProgress.find((p) => p.badgeId === "hundred_club_100")?.current).toBe(small.stats.qualifyingDays);
    expect(small.inProgress.find((p) => p.badgeId === "multi_year_2")?.current).toBe(small.stats.activeYears);
  });
  it("counts calendar years that contain a qualified week", () => {
    const y1 = qualifiedWeeks(1, 0, "a");
    const y2 = qualifiedWeeks(1, 364, "b");
    const r = evaluateAchievements([...y1, ...y2], { nowLocalDate: day(365) });
    expect(ids(r.earned)).toContain("multi_year_2");
  });
});

describe("pin target", () => {
  it("awards when a trusted set meets the pinned load and reps", () => {
    const pin = { exerciseId: "bench", equipment: "barbell" as const, setup: "free" as const, load: 80, reps: 5 };
    const miss = workout("1", day(0), three("1", "bench", 70, 5));
    const hit = workout("2", day(1), three("2", "bench", 80, 5));
    expect(evaluateAchievements([miss], { pins: [pin] }).earned.filter((e) => e.badgeId === "pin_target")).toHaveLength(0);
    const r = evaluateAchievements([miss, hit], { pins: [pin] });
    expect(r.earned.filter((e) => e.badgeId === "pin_target")).toHaveLength(1);
    expect(r.earned.find((e) => e.badgeId === "pin_target")!.evidence).toMatchObject({ kind: "pin_target", target: { load: 80, reps: 5 } });
  });
  it("tracks progress as the min of load and reps ratios", () => {
    const pin = { exerciseId: "bench", load: 100, reps: 8 };
    const s = workout("1", day(0), [working("a", "bench", 50, 8)]);
    const p = evaluateAchievements([s], { pins: [pin] }).inProgress.find((x) => x.badgeId === "pin_target");
    expect(p?.current).toBeCloseTo(0.5);
  });
});
