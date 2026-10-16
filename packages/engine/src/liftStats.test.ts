import { describe, expect, it } from "vitest";
import { epley } from "./line";
import {
  bestEstimated1rm,
  bestSessionVolume,
  bestSetVolume,
  FEATURED_REP_COUNTS,
  heaviestSet,
  prKindsForSet,
  repMaxes,
  setVolume,
} from "./liftStats";
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

describe("setVolume", () => {
  it("is load times reps", () => {
    expect(setVolume(w(100, 5))).toBe(500);
  });
});

describe("heaviestSet", () => {
  it("is the heaviest trusted working set, with its reps", () => {
    const h = [sess(0, [w(60, 8), w(80, 5)]), sess(7, [w(70, 6)])];
    expect(heaviestSet(h, "free")).toMatchObject({ load: 80, reps: 5, setIndex: 1, at: T0 });
  });
  it("ignores warm-ups, drop sets and unconfirmed outliers", () => {
    const h = [sess(0, [w(120, 3, { warmup: true }), w(110, 2, { tags: ["drop"] }), w(200, 1, { outlierStatus: "unconfirmed" }), w(70, 5)])];
    expect(heaviestSet(h, "free")).toMatchObject({ load: 70, reps: 5 });
  });
  it("assisted: the least assistance is heaviest", () => {
    const h = [sess(0, [w(30, 8), w(20, 6)])];
    expect(heaviestSet(h, "assisted")).toMatchObject({ load: 20, reps: 6 });
  });
  it("is null with no trusted working set", () => {
    expect(heaviestSet([], "free")).toBeNull();
    expect(heaviestSet([sess(0, [w(20, 10, { warmup: true })])], "free")).toBeNull();
  });
});

describe("bestSetVolume", () => {
  it("picks load times reps, even when that set is not the heaviest", () => {
    const h = [sess(0, [w(100, 1), w(60, 10)])];
    expect(bestSetVolume(h)).toMatchObject({ volume: 600, set: { load: 60, reps: 10 } });
  });
});

describe("bestSessionVolume", () => {
  it("sums trusted working sets that day and skips warm-ups", () => {
    const h = [
      sess(0, [w(60, 8), w(60, 8), w(40, 8, { warmup: true })]),
      sess(7, [w(100, 5)]),
    ];
    expect(bestSessionVolume(h)).toMatchObject({ volume: 960, at: T0 });
  });
});

describe("bestEstimated1rm", () => {
  it("uses epley and labels the set it came from, which may not be the heaviest", () => {
    const h = [sess(0, [w(100, 1), w(80, 10)])];
    const got = bestEstimated1rm(h)!;
    expect(got.e1rm).toBeCloseTo(epley(80, 10));
    expect(got.set).toMatchObject({ load: 80, reps: 10 });
    expect(got.e1rm).toBeGreaterThan(100);
  });
  it("a single is its own estimated 1RM", () => {
    expect(bestEstimated1rm([sess(0, [w(100, 1)])])!.e1rm).toBe(100);
  });
});

describe("repMaxes", () => {
  it("shows heaviest load at each performed rep count, including featured 1/5/6/8/10/12 when present", () => {
    expect(FEATURED_REP_COUNTS).toEqual([1, 5, 6, 8, 10, 12]);
    const h = [
      sess(0, [w(100, 1), w(80, 5), w(70, 5), w(60, 7)]),
      sess(7, [w(85, 5), w(90, 8)]),
    ];
    const rows = repMaxes(h, "free");
    expect(rows.map((r) => [r.reps, r.set.load])).toEqual([
      [1, 100],
      [5, 85],
      [8, 90],
      [7, 60],
    ]);
  });
  it("omits featured counts the lifter never did", () => {
    const rows = repMaxes([sess(0, [w(60, 9)])], "free");
    expect(rows.map((r) => r.reps)).toEqual([9]);
  });
});

describe("prKindsForSet", () => {
  it("marks heaviest, best volume and rep-specific records on the sets that set them", () => {
    const h = [sess(0, [w(100, 1), w(60, 10)])];
    const records = {
      heaviest: heaviestSet(h, "free"),
      bestSetVolume: bestSetVolume(h),
      repMaxes: repMaxes(h, "free"),
    };
    expect(prKindsForSet(records, T0, 0)).toEqual(["heaviest", "rep"]);
    expect(prKindsForSet(records, T0, 1)).toEqual(["volume", "rep"]);
  });
});
