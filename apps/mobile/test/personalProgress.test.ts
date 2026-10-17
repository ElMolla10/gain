import { describe, expect, it } from "vitest";
import type { GymLoadSpec, LoggedSet } from "@gain/engine";
import { consistencyProgress, personalMilestone, personalTop } from "../src/logic/personalProgress";
import { summarizeExercise } from "../src/logic/summary";
import { improvementLines as rawImprovementLines } from "../src/logic/workoutRecap";
import type { SessionSummary } from "../src/db/finishRepo";
const improvementLines: typeof rawImprovementLines = (...args) => rawImprovementLines(...args).map(s => s.replace(/[\u2066\u2069]/g, ""));
const S = (load: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...extra });
const summary = (today: LoggedSet[], before: LoggedSet[], setup: "free" | "assisted" = "free", measure: "reps" | "time" | "distance" = "reps"): SessionSummary => ({ sessionId: "s", totals: { exercises: 1, counted: 1, warmups: 0, unconfirmed: 0, records: 1 }, exercises: [{ exerciseId: "bench", nameEn: "Bench", nameAr: "بنش", ...summarizeExercise(setup, today, before, measure) }] });
describe("monthly strength goals", () => {
  const now = new Date(2026, 9, 15).getTime();
  const H = (day: string, ...sets: LoggedSet[]) => ({ performedAt: day, sets });
  const db = { equipment: "dumbbell", loads: [12, 14, 16, 18, 20] } satisfies GymLoadSpec;
  const cable = { equipment: "cable", increment: 2.5, min: 2.5 } satisfies GymLoadSpec;
  it("uses the gym's next actual weight for a meaningful month-scale goal", () => {
    expect(personalMilestone([H("2026-09-20", S(14, 10))], [], db, "reps", 8, 12, now))
      .toMatchObject({ load: 16, quantity: 8, previous: 10, progress: 0, reached: false });
    expect(personalMilestone([H("2026-09-20", S(27.5, 8))], [], cable, "reps", 7, 10, now))
      .toMatchObject({ load: 30, quantity: 7, reached: false });
  });
  it("holds the baseline fixed through the month and marks it reached", () => {
    const history = [H("2026-09-20", S(14, 10)), H("2026-10-02", S(14, 11))];
    const goal = personalMilestone(history, [S(16, 8)], db, "reps", 8, 12, now)!;
    expect(goal).toMatchObject({ load: 16, quantity: 8, reached: true, progress: 1 });
    expect(personalMilestone(history, [], db, "reps", 8, 12, now)?.quantity).toBe(8);
    expect(personalMilestone(history, [S(14, 14)], db, "reps", 8, 12, now)?.reached).toBe(false);
  });
  it("ignores warmups and unconfirmed sets; waits for a trusted baseline", () => {
    expect(personalMilestone([], [], db, "reps", 8, 12, now)).toBeNull();
    expect(personalMilestone([H("2026-09-20", S(14, 10, { warmup: true }))], [], db, "reps", 8, 12, now)).toBeNull();
    expect(personalMilestone([H("2026-09-20", S(14, 10))], [S(16, 8, { outlierStatus: "unconfirmed" })], db, "reps", 8, 12, now)?.reached).toBe(false);
  });
  it("does not offer an implausible weight jump or exceed the rep ceiling", () => {
    const sparse = { equipment: "dumbbell", loads: [14, 30] } satisfies GymLoadSpec;
    expect(personalMilestone([H("2026-09-20", S(14, 10))], [], sparse, "reps", 8, 12, now))
      .toBeNull();
    expect(personalMilestone([H("2026-09-20", S(14, 14))], [], null, "reps", 8, 15, now)).toBeNull();
  });
  it("gives timed work a substantial gain while retaining bodyweight reps", () => {
    expect(personalMilestone([H("2026-09-20", S(0, 1, { durationS: 45 }))], [], null, "time", 1, 12, now))
      .toMatchObject({ load: 0, quantity: 55 });
    expect(personalMilestone([H("2026-09-20", S(0, 8))], [], null, "reps", 6, 12, now))
      .toMatchObject({ load: 0, quantity: 11 });
  });
  it("treats less assistance as the harder top", () => {
    expect(personalTop([S(20, 6), S(30, 12)], "assisted")).toEqual({ load: 20, quantity: 6 });
  });
});
describe("concrete workout improvements", () => {
  it("shows the earlier best at the same load", () => {
    expect(improvementLines(summary([S(80, 6)], [S(80, 5), S(70, 10)]), "en", "kg")[0]).toContain("80 kg × 5 → 80 kg × 6");
  });
  it("shows the previous top for new loads and less assistance", () => {
    expect(improvementLines(summary([S(90, 4)], [S(80, 5)]), "en", "kg")[0]).toContain("80 kg × 5 → 90 kg × 4");
    expect(improvementLines(summary([S(20, 6)], [S(30, 8)], "assisted"), "en", "kg")[0]).toContain("30 kg × 8 → 20 kg × 6");
  });
  it("labels a first session as a baseline and avoids improvement claims on ties", () => {
    expect(improvementLines(summary([S(80, 6)], []), "en", "kg")[0]).toContain("baseline");
    expect(improvementLines(summary([S(80, 5)], [S(80, 5)]), "en", "kg")).toEqual([]);
  });
  it("formats pounds, Arabic, and timed comparisons", () => {
    expect(improvementLines(summary([S(80, 6)], [S(80, 5)]), "ar", "lb")[0]).toContain("بنش");
    expect(improvementLines(summary([S(80, 6)], [S(80, 5)]), "en", "lb")[0]).toContain("176.4 lb");
    expect(improvementLines(summary([S(0, 1, { durationS: 50 })], [S(0, 1, { durationS: 45 })], "free", "time"), "en", "kg")[0]).toContain("45 s");
  });
});
describe("rest-aware consistency", () => {
  const local = (day: number, hour = 12) => new Date(2026, 9, day, hour).getTime();
  it("counts distinct days, ignores future sessions, and honors the selected week boundary", () => {
    const sessions = [5, 11, 12, 12, 14, 17].map(day => ({ finishedAt: local(day) }));
    expect(consistencyProgress(sessions, local(16), 2)).toMatchObject({ done: 2, goal: 2, achieved: true, activeDays: 4 });
    expect(consistencyProgress(sessions, local(16), 3, 0)).toMatchObject({ done: 3, achieved: true });
  });
  it("has no invented goal and preserves milestones across rest weeks", () => {
    const sessions = [1, 2, 3, 4, 5].map(day => ({ finishedAt: local(day) }));
    expect(consistencyProgress(sessions, local(16), null)).toMatchObject({ done: 0, goal: null, achieved: false, activeDays: 5, level: 5 });
    expect(consistencyProgress([], local(16), 9).goal).toBeNull();
  });
});
