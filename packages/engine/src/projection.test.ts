import { describe, expect, it } from "vitest";
import { epley } from "./line";
import { e1rmChangePer30d, e1rmPoints, goalEta, partOfMonth, projectE1rm, strengthProjection, PROJECTION_MIN_SESSIONS } from "./projection";
import type { TrendPoint } from "./trend";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 8, 1, 12);
const pt = (day: number, load: number, reps = 5, imported = false): TrendPoint => ({ at: T0 + day * DAY, load, reps, sets: 3, ...(imported ? { imported } : {}) });
/** A session every 5 days, e1RM rising by exactly 2 kg per session (= 12 kg per 30 days). */
const rising = (n: number) => Array.from({ length: n }, (_, i) => pt(i * 5, (84 + i * 2) / (1 + 5 / 30)));

describe("e1rmPoints", () => {
  it("maps each top set to its Epley e1RM, oldest first, keeping the imported flag", () => {
    const out = e1rmPoints([pt(7, 70, 8), pt(0, 60, 1, true)]);
    expect(out.map((p) => p.at)).toEqual([T0, T0 + 7 * DAY]);
    expect(out[0]).toEqual({ at: T0, e1rm: 60, imported: true });
    expect(out[1]!.e1rm).toBeCloseTo(epley(70, 8), 6);
  });
});

describe("e1rmChangePer30d", () => {
  it("is the Theil-Sen slope per 30 days", () => {
    expect(e1rmChangePer30d(e1rmPoints(rising(8)))).toBeCloseTo(12, 3);
  });
  it("is robust to one odd session", () => {
    const pts = rising(8);
    pts[4] = pt(20, 20, 5);
    expect(e1rmChangePer30d(e1rmPoints(pts))).toBeCloseTo(12, 0);
  });
  it("is null when thin (under 3 sessions or under 2 weeks)", () => {
    expect(e1rmChangePer30d(e1rmPoints(rising(2)))).toBeNull();
    expect(e1rmChangePer30d(e1rmPoints([pt(0, 60), pt(3, 62), pt(6, 64)]))).toBeNull();
  });
});

describe("strengthProjection", () => {
  const now = T0 + 40 * DAY;
  it("projects linearly from the latest session", () => {
    const p = strengthProjection(rising(8), now);
    expect(p.canProject).toBe(true);
    expect(p.current).toBeCloseTo(98, 6);
    expect(p.best).toBeCloseTo(98, 6);
    expect(projectE1rm(p, p.currentAt! + 90 * DAY)).toBeCloseTo(98 + 36, 3);
  });
  it(`needs ${PROJECTION_MIN_SESSIONS} sessions in the last 8 weeks`, () => {
    const p = strengthProjection(rising(8), now + 60 * DAY);
    expect(p.perMonth).not.toBeNull();
    expect(p.canProject).toBe(false);
    expect(projectE1rm(p, now)).toBeNull();
    expect(strengthProjection(rising(3), T0 + 10 * DAY).canProject).toBe(false);
  });
  it("is empty without sessions", () => {
    const p = strengthProjection([], now);
    expect(p).toMatchObject({ current: null, best: null, perMonth: null, canProject: false, notOnPace: false });
  });
  it("flags a flat or falling trend as not on pace", () => {
    const flat = Array.from({ length: 6 }, (_, i) => pt(i * 5, 80));
    expect(strengthProjection(flat, T0 + 30 * DAY).notOnPace).toBe(true);
    const falling = Array.from({ length: 6 }, (_, i) => pt(i * 5, 80 - i * 2));
    expect(strengthProjection(falling, T0 + 30 * DAY).notOnPace).toBe(true);
    expect(strengthProjection(rising(6), T0 + 30 * DAY).notOnPace).toBe(false);
  });
});

describe("goalEta", () => {
  const now = T0 + 35 * DAY; // the latest session (day 35)
  const p = strengthProjection(rising(8), now);
  it("dates a goal ahead at the current pace", () => {
    const eta = goalEta(p, 110, now);
    expect(eta.kind).toBe("eta");
    if (eta.kind === "eta") expect(eta.days).toBeCloseTo(30, 3); // 12 kg at 12 kg / 30 days
  });
  it("says reached when any session already got there", () => {
    expect(goalEta(p, 98, now)).toEqual({ kind: "reached" });
    expect(goalEta(p, 90, now)).toEqual({ kind: "reached" });
  });
  it("is beyond past 12 months", () => {
    expect(goalEta(p, 98 + 12 * 13, now)).toEqual({ kind: "beyond" });
  });
  it("is not on pace for a flat trend, unknown without enough data or a goal", () => {
    const flat = strengthProjection(Array.from({ length: 6 }, (_, i) => pt(i * 5, 80)), T0 + 25 * DAY);
    expect(goalEta(flat, 120, T0 + 25 * DAY)).toEqual({ kind: "notOnPace" });
    expect(goalEta(strengthProjection(rising(2), now), 120, now)).toEqual({ kind: "unknown" });
    expect(goalEta(p, 0, now)).toEqual({ kind: "unknown" });
    expect(goalEta(p, Number.NaN, now)).toEqual({ kind: "unknown" });
  });
  it("never dates a goal in the past", () => {
    const later = now + 20 * DAY;
    const stale = strengthProjection(rising(8), later);
    const eta = goalEta(stale, 99, later);
    expect(eta.kind).toBe("eta");
    if (eta.kind === "eta") expect(eta.at).toBeGreaterThanOrEqual(later);
  });
});

describe("partOfMonth", () => {
  it("splits the month into early / mid / late", () => {
    expect(partOfMonth(new Date(2027, 0, 3).getTime())).toBe("early");
    expect(partOfMonth(new Date(2027, 0, 10).getTime())).toBe("early");
    expect(partOfMonth(new Date(2027, 0, 15).getTime())).toBe("mid");
    expect(partOfMonth(new Date(2027, 0, 28).getTime())).toBe("late");
  });
});
