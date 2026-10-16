import { describe, expect, it } from "vitest";
import { epley } from "./line";
import { consecutiveWorkouts, monthImprovementPct, sessionFacts } from "./sessionFacts";
import type { HistorySession, LoggedSet } from "./types";
import { lineOf } from "./testkit";

const line = lineOf("bench");
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 5);
const sess = (dayOffset: number, sets: LoggedSet[]): HistorySession => ({
  line,
  performedAt: new Date(T0 + dayOffset * DAY).toISOString(),
  sets,
});
const w = (load: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...extra });

describe("sessionFacts", () => {
  it("claims nothing on the first session", () => {
    expect(sessionFacts("free", [w(60, 8)], [])).toEqual([]);
  });
  it("is a load record when today's top is heavier", () => {
    expect(sessionFacts("free", [w(62.5, 6)], [w(60, 8)]).map((f) => f.kind)).toContain("load");
  });
  it("is a reps-at-load record when the same load has more reps", () => {
    expect(sessionFacts("free", [w(60, 11)], [w(60, 10)]).some((f) => f.kind === "reps_at_load" && f.reps === 11)).toBe(true);
  });
  it("is a rep-count record when the same exact reps is heavier", () => {
    const facts = sessionFacts("free", [w(70, 8)], [w(80, 5), w(65, 8)]);
    expect(facts.some((f) => f.kind === "rep" && f.reps === 8 && f.load === 70)).toBe(true);
  });
  it("is an estimated 1RM record when Epley is higher, even if the bar is lighter", () => {
    const facts = sessionFacts("free", [w(80, 10)], [w(100, 1)]);
    const e1rm = facts.find((f) => f.kind === "e1rm");
    expect(e1rm?.e1rm).toBeCloseTo(epley(80, 10));
    expect(e1rm!.e1rm!).toBeGreaterThan(100);
  });
  it("ignores warm-ups, drop sets and unconfirmed outliers", () => {
    expect(sessionFacts("free", [w(200, 1, { warmup: true }), w(60, 8)], [w(200, 1, { outlierStatus: "unconfirmed" }), w(55, 8)]).some((f) => f.kind === "load")).toBe(true);
  });
  it("assisted: less assistance is the load record", () => {
    expect(sessionFacts("assisted", [w(20, 8)], [w(30, 8)]).some((f) => f.kind === "load")).toBe(true);
    expect(sessionFacts("assisted", [w(35, 8)], [w(30, 8)]).some((f) => f.kind === "load")).toBe(false);
  });
  it("does not also claim a rep record for the same set as a new heaviest load", () => {
    expect(sessionFacts("free", [w(70, 8)], [w(60, 8)]).map((f) => f.kind)).toEqual(["load", "e1rm"]);
  });
  it("does not treat assistance load as an estimated 1RM", () => {
    expect(sessionFacts("assisted", [w(20, 8)], [w(30, 8)]).map((f) => f.kind)).toEqual(["load"]);
  });
});

describe("monthImprovementPct", () => {
  it("is the percent change of the first vs last top set in 30 days", () => {
    const h = [sess(0, [w(100, 5)]), sess(14, [w(110, 5)])];
    expect(monthImprovementPct(h, "free", T0 + 14 * DAY)).toBe(10);
  });
  it("needs two trusted sessions in the window", () => {
    expect(monthImprovementPct([sess(0, [w(100, 5)])], "free", T0)).toBeNull();
    expect(monthImprovementPct([sess(-40, [w(100, 5)]), sess(0, [w(110, 5)])], "free", T0)).toBeNull();
  });
  it("assisted: less assistance is a positive change", () => {
    const h = [sess(0, [w(40, 8)]), sess(10, [w(30, 8)])];
    expect(monthImprovementPct(h, "assisted", T0 + 10 * DAY)).toBe(25);
  });
});

describe("consecutiveWorkouts", () => {
  it("counts finished sessions looking backward, allowing rest days", () => {
    const times = [T0, T0 + 2 * DAY, T0 + 5 * DAY];
    expect(consecutiveWorkouts(times, T0 + 5 * DAY)).toBe(3);
  });
  it("breaks after a gap longer than 8 days", () => {
    const times = [T0, T0 + 10 * DAY];
    expect(consecutiveWorkouts(times, T0 + 10 * DAY)).toBe(1);
  });
  it("is zero when the latest workout is older than the gap", () => {
    expect(consecutiveWorkouts([T0], T0 + 9 * DAY)).toBe(0);
  });
});
