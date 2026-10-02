import { describe, expect, it } from "vitest";
import { fellTwice, reviewWeek, weekStartOf, WEEKLY_RULE_VERSION, type WeeklyInput } from "./weekly";

const base = (over: Partial<WeeklyInput> = {}): WeeklyInput => ({
  weekStart: "2026-09-21",
  plannedSessions: 4,
  sessionsDone: 4,
  priorWeeks: [4, 4],
  historyDays: 60,
  goal: { kind: "lift", status: "on_pace", targetDate: "2027-01-01", dateGone: false, projectedDate: "2026-12-20", ratePerExposure: 1, lastE1rm: [100, 101, 102] },
  ...over,
});
const goal = (o: Partial<NonNullable<WeeklyInput["goal"]>>): WeeklyInput["goal"] => ({ ...base().goal!, ...o });

describe("reviewWeek", () => {
  it("is labelled with the rule version and the week, and reports what was observed", () => {
    const r = reviewWeek(base());
    expect(r.ruleVersion).toBe(WEEKLY_RULE_VERSION);
    expect(r.weekStart).toBe("2026-09-21");
    expect(r.observed).toEqual({ sessionsDone: 4, plannedSessions: 4, attendance: 1, goalStatus: "on_pace" });
  });
  it("says 'too thin' and keeps the plan when the history is under 14 days or nothing was trained for 3 weeks", () => {
    expect(reviewWeek(base({ historyDays: 9 }))).toMatchObject({ thin: true, reason: "thin_history", change: { kind: "keep" } });
    expect(reviewWeek(base({ sessionsDone: 0, priorWeeks: [0, 0] }))).toMatchObject({ thin: true, reason: "thin_history" });
  });
  it("no goal: keep", () => {
    expect(reviewWeek(base({ goal: null }))).toMatchObject({ reason: "no_goal", change: { kind: "keep" } });
  });
  it("goal reached: propose choosing a new goal", () => {
    expect(reviewWeek(base({ goal: goal({ status: "reached" }) }))).toMatchObject({ change: { kind: "new_goal" } });
  });
  it("goal pace too thin: keep, flagged thin", () => {
    expect(reviewWeek(base({ goal: goal({ status: "too_thin" }) }))).toMatchObject({ thin: true, reason: "goal_too_thin", change: { kind: "keep" } });
  });
  it("on pace or ahead: keep", () => {
    expect(reviewWeek(base()).change).toEqual({ kind: "keep" });
    expect(reviewWeek(base({ goal: goal({ status: "ahead" }) })).reason).toBe("on_track");
  });
  it("behind with a short week: keep, a missed week is not a plan failure", () => {
    const r = reviewWeek(base({ sessionsDone: 2, goal: goal({ status: "behind" }) })); // 2 < 4 - 1
    expect(r).toMatchObject({ reason: "short_week_keep", change: { kind: "keep" } });
    expect(reviewWeek(base({ sessionsDone: 2, goal: goal({ status: "behind", targetDate: null }) })).reason).toBe("short_week_keep");
  });
  it("behind and the projection slips past the date by more than 28 days: propose the projected date", () => {
    const r = reviewWeek(base({ goal: goal({ status: "behind", targetDate: "2026-11-01", projectedDate: "2026-12-15" }) })); // 44 days later
    expect(r).toMatchObject({ reason: "date_slipping", change: { kind: "move_date", newDate: "2026-12-15" } });
  });
  it("behind, date slips by under 28 days, rate positive: one more exposure of the goal lift", () => {
    const r = reviewWeek(base({ goal: goal({ status: "behind", targetDate: "2026-11-01", projectedDate: "2026-11-20" }) }));
    expect(r).toMatchObject({ reason: "behind_add_exposure", change: { kind: "extra_exposure" } });
  });
  it("behind, full attendance and a flat lift: a two-week variation", () => {
    const r = reviewWeek(base({ goal: goal({ status: "behind", targetDate: null, projectedDate: null, ratePerExposure: 0, lastE1rm: [100, 100, 100] }) }));
    expect(r).toMatchObject({ reason: "flat_full_attendance", change: { kind: "variation", weeks: 2 } });
  });
  it("date passed and no projection: no invented date; falls through to a behind-pace option", () => {
    const r = reviewWeek(base({ goal: goal({ status: "behind", dateGone: true, projectedDate: null, ratePerExposure: 0 }) }));
    expect(r.change.kind).toBe("variation");
  });
  it("a date that has passed with a projection proposes that later date", () => {
    expect(reviewWeek(base({ goal: goal({ status: "behind", dateGone: true, projectedDate: "2027-03-01" }) })).change).toEqual({ kind: "move_date", newDate: "2027-03-01" });
  });
  it("estimates fell twice in two full weeks: an easier week is offered, as one option", () => {
    const r = reviewWeek(base({ goal: goal({ status: "behind", lastE1rm: [100, 97, 94], ratePerExposure: -1.5 }) }));
    expect(r).toMatchObject({ reason: "numbers_fell", change: { kind: "easier_week" } });
  });
  it("estimates fell twice but last week was short: no easier-week claim", () => {
    const r = reviewWeek(base({ sessionsDone: 2, goal: goal({ status: "behind", lastE1rm: [100, 97, 94], ratePerExposure: -1.5 }) }));
    expect(r.change.kind).not.toBe("easier_week");
  });
  it("bodyweight goals never get lift-only changes", () => {
    const r = reviewWeek(base({ goal: goal({ kind: "bodyweight", status: "behind", targetDate: null, projectedDate: null, ratePerExposure: null, lastE1rm: [] }) }));
    expect(r.change).toEqual({ kind: "keep" });
  });
  it("unknown planned days: one session counts as a full week", () => {
    const r = reviewWeek(base({ plannedSessions: null, sessionsDone: 1, goal: goal({ status: "behind", targetDate: null, ratePerExposure: 0 }) }));
    expect(r.observed.attendance).toBeNull();
    expect(r.change.kind).toBe("variation");
  });
});

describe("helpers", () => {
  it("fellTwice needs two drops of at least 2%", () => {
    expect(fellTwice([100, 97, 94])).toBe(true);
    expect(fellTwice([100, 99.5, 94])).toBe(false);
    expect(fellTwice([100, 97])).toBe(false);
  });
  it("weekStartOf finds the Monday (or another start day)", () => {
    expect(weekStartOf(Date.UTC(2026, 9, 2, 20))).toBe("2026-09-28"); // Friday 2026-10-02
    expect(weekStartOf(Date.UTC(2026, 9, 5, 1))).toBe("2026-10-05"); // Monday
    expect(weekStartOf(Date.UTC(2026, 9, 4, 1))).toBe("2026-09-28"); // Sunday
    expect(weekStartOf(Date.UTC(2026, 9, 2), 6)).toBe("2026-09-26"); // week starting Saturday
  });
});
