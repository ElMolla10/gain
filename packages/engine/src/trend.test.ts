import { describe, expect, it } from "vitest";
import { liftTrend, topSet, TREND_MIN_POINTS } from "./trend";
import type { HistorySession, LoggedSet } from "./types";
import { lineOf } from "./testkit";

const line = lineOf("bench");
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 5);
const sess = (dayOffset: number, sets: LoggedSet[]): HistorySession => ({ line, performedAt: new Date(T0 + dayOffset * DAY).toISOString(), sets });
const w = (load: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...extra });

describe("topSet", () => {
  it("is the heaviest trusted working set; ties go to more reps", () => {
    expect(topSet([w(60, 8), w(70, 5), w(70, 6), w(65, 10)], "free")).toMatchObject({ load: 70, reps: 6 });
  });
  it("ignores warm-ups, drop sets and unconfirmed or rejected outliers", () => {
    const sets = [w(100, 3, { warmup: true }), w(90, 8, { tags: ["drop"] }), w(300, 5, { outlierStatus: "unconfirmed" }), w(40, 5, { outlierStatus: "rejected" }), w(60, 8), w(62.5, 6, { outlierStatus: "confirmed" })];
    expect(topSet(sets, "free")).toMatchObject({ load: 62.5, reps: 6 });
  });
  it("is null with no trusted working set", () => {
    expect(topSet([], "free")).toBeNull();
    expect(topSet([w(20, 10, { warmup: true })], "free")).toBeNull();
    expect(topSet([w(50, 0)], "free")).toBeNull();
  });
  it("assisted lines: the least assistance is the top set (lower is harder)", () => {
    expect(topSet([w(30, 8), w(20, 6), w(20, 7), w(25, 10)], "assisted")).toMatchObject({ load: 20, reps: 7 });
  });
  it("added-load bodyweight lines: the most added load, and zero added counts", () => {
    expect(topSet([w(0, 12), w(10, 8)], "bodyweight_plus_added")).toMatchObject({ load: 10 });
    expect(topSet([w(0, 12)], "bodyweight_plus_added")).toMatchObject({ load: 0, reps: 12 });
  });
});

describe("liftTrend", () => {
  it("steady gains read as better, with a change per 30 days", () => {
    const h = [0, 7, 14, 21, 28, 35].map((d, i) => sess(d, [w(60 + i * 2.5, 8)]));
    const t = liftTrend(h, "free");
    expect(t.measure).toBe("top_set");
    expect(t.direction).toBe("better");
    expect(t.loadChangePer30d).toBeCloseTo(10.714, 2);
    expect(t.points).toHaveLength(6);
    expect(t.best).toMatchObject({ load: 72.5 });
    expect(t.latest).toMatchObject({ load: 72.5, reps: 8 });
  });
  it("a flat line is flat, a falling line is worse", () => {
    const flat = [0, 7, 14, 21].map((d) => sess(d, [w(80, 5)]));
    expect(liftTrend(flat, "free").direction).toBe("flat");
    const down = [0, 7, 14, 21].map((d, i) => sess(d, [w(80 - i * 5, 5)]));
    expect(liftTrend(down, "free").direction).toBe("worse");
  });
  it("assisted: less assistance over time is better", () => {
    const h = [0, 10, 20, 30].map((d, i) => sess(d, [w(40 - i * 5, 6)]));
    const t = liftTrend(h, "assisted");
    expect(t.direction).toBe("better");
    expect(t.loadChangePer30d!).toBeLessThan(0);
    expect(t.best).toMatchObject({ load: 25 });
  });
  it("one odd session does not flip the direction", () => {
    const loads = [60, 62.5, 65, 40, 70, 72.5, 75];
    const h = loads.map((l, i) => sess(i * 7, [w(l, 5)]));
    expect(liftTrend(h, "free").direction).toBe("better");
  });
  it("too few points or too short a span says thin, never a direction", () => {
    expect(liftTrend([], "free")).toMatchObject({ direction: "thin", points: [], best: null, latest: null });
    expect(liftTrend([sess(0, [w(60, 5)]), sess(20, [w(65, 5)])], "free").direction).toBe("thin");
    expect(TREND_MIN_POINTS).toBe(3);
    expect(liftTrend([sess(0, [w(60, 5)]), sess(3, [w(62.5, 5)]), sess(6, [w(65, 5)])], "free").direction).toBe("thin");
  });
  it("sessions with only warm-ups or unconfirmed sets add no point; imported points are labelled", () => {
    const h = [sess(0, [w(60, 5)]), sess(7, [w(20, 10, { warmup: true })]), sess(14, [w(62.5, 5)]), sess(21, [w(300, 5, { outlierStatus: "unconfirmed" })]), sess(28, [w(65, 5)])];
    const t = liftTrend(h, "free", new Set([T0]));
    expect(t.points.map((p) => p.load)).toEqual([60, 62.5, 65]);
    expect(t.points[0]!.imported).toBe(true);
    expect(t.points[1]!.imported).toBeUndefined();
  });
  it("history out of order and 25 sessions are handled", () => {
    const h = Array.from({ length: 25 }, (_, i) => sess(i * 3, [w(50 + i, 5)])).reverse();
    const t = liftTrend(h, "free");
    expect(t.points[0]!.load).toBe(50);
    expect(t.points[24]!.load).toBe(74);
    expect(t.direction).toBe("better");
  });
});
