import { describe, expect, it } from "vitest";
import type { LoggedSet } from "@gain/engine";
import { consistencyProgress, personalMilestone, personalTop } from "../src/logic/personalProgress";
import { summarizeExercise } from "../src/logic/summary";
import { improvementLines as rawImprovementLines } from "../src/logic/workoutRecap";
import type { SessionSummary } from "../src/db/finishRepo";
const improvementLines: typeof rawImprovementLines = (...args) => rawImprovementLines(...args).map(s => s.replace(/[\u2066\u2069]/g, ""));
const S = (load: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...extra });
const summary = (today: LoggedSet[], before: LoggedSet[], setup: "free" | "assisted" = "free", measure: "reps" | "time" | "distance" = "reps"): SessionSummary => ({ sessionId: "s", totals: { exercises: 1, counted: 1, warmups: 0, unconfirmed: 0, records: 1 }, exercises: [{ exerciseId: "bench", nameEn: "Bench", nameAr: "بنش", ...summarizeExercise(setup, today, before, measure) }] });
describe("personal milestones", () => {
  it("uses all same-load history, not only the previous session", () => {
    const before = [S(80, 5), S(80, 3), S(70, 12)];
    expect(personalMilestone(before, [S(80, 4)], 80)).toEqual({ load: 80, previous: 5, quantity: 6, progress: 4 / 6, reached: false });
    expect(personalMilestone(before, [S(80, 7)], 80)?.progress).toBe(1);
    expect(personalMilestone(before, [S(80, 6)], 80)?.reached).toBe(true);
  });
  it("never invents a best at a new load, a first session, or an invalid load", () => {
    expect(personalMilestone([], [], 80)).toBeNull();
    expect(personalMilestone([S(70, 5)], [], 80)).toBeNull();
    expect(personalMilestone([S(80, 5)], [], null)).toBeNull();
    expect(personalMilestone([S(80, 5)], [], NaN)).toBeNull();
    expect(personalMilestone([S(80, 100)], [], 80)).toBeNull();
  });
  it("excludes warmups, drop sets, and untrusted sets on both sides", () => {
    const excluded = [S(80, 20, { warmup: true }), S(80, 20, { tags: ["drop"] }), S(80, 20, { outlierStatus: "unconfirmed" }), S(80, 20, { outlierStatus: "rejected" })];
    expect(personalMilestone(excluded, [], 80)).toBeNull();
    expect(personalMilestone([S(80, 5)], excluded, 80)?.progress).toBe(0);
  });
  it("supports holds and carries, without falling back to their dummy reps", () => {
    expect(personalMilestone([S(0, 1, { durationS: 45 })], [S(0, 1, { durationS: 50 })], 0, "time")).toMatchObject({ quantity: 50, reached: true });
    expect(personalMilestone([S(20, 1, { distanceM: 30 })], [], 20, "distance")?.quantity).toBe(31);
    expect(personalMilestone([S(0, 1)], [], 0, "time")).toBeNull();
  });
  it("treats less assistance as the harder top", () => {
    expect(personalTop([S(20, 6), S(30, 12)], "assisted")).toEqual({ load: 20, quantity: 6 });
  });
});
describe("concrete workout improvements", () => {
  it("shows the earlier best at the same load", () => {
    expect(improvementLines(summary([S(80, 6)], [S(80, 5), S(70, 10)]), "en", "kg")[0]).toContain("80 kg × 5 → 80 kg × 6");
  });
  it("shows the previous top for new loads and less assistance", () => {
    expect(improvementLines(summary([S(90, 4)], [S(80, 5)]), "en", "kg")[0]).toContain("80 kg × 5 → 90 kg × 4");
    expect(improvementLines(summary([S(20, 6)], [S(30, 8)], "assisted"), "en", "kg")[0]).toContain("30 kg × 8 → 20 kg × 6");
  });
  it("labels a first session as a baseline and avoids improvement claims on ties", () => {
    expect(improvementLines(summary([S(80, 6)], []), "en", "kg")[0]).toContain("baseline");
    expect(improvementLines(summary([S(80, 5)], [S(80, 5)]), "en", "kg")).toEqual([]);
  });
  it("formats pounds, Arabic, and timed comparisons", () => {
    expect(improvementLines(summary([S(80, 6)], [S(80, 5)]), "ar", "lb")[0]).toContain("بنش");
    expect(improvementLines(summary([S(80, 6)], [S(80, 5)]), "en", "lb")[0]).toContain("176.4 lb");
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
