import { describe, expect, it } from "vitest";
import { detectDeload, reduceSetsByOne, scaleDeloadLoad, topSetOf, type DeloadSession } from "./deload";

const high = (load: number, reps: number, extra: Partial<DeloadSession> = {}): DeloadSession => ({
  load,
  reps,
  rir: 1,
  failure: false,
  ...extra,
});

describe("detectDeload", () => {
  it("needs three consecutive declining high-effort sessions", () => {
    expect(detectDeload([high(100, 5), high(95, 5), high(90, 5)])).toBe(true);
  });
  it("one bad workout is never enough", () => {
    expect(detectDeload([high(100, 5)])).toBe(false);
    expect(detectDeload([high(100, 5), high(90, 5)])).toBe(false);
  });
  it("does not trigger when effort is not high", () => {
    expect(detectDeload([high(100, 5, { rir: 4 }), high(95, 5, { rir: 4 }), high(90, 5, { rir: 4 })])).toBe(false);
    expect(detectDeload([high(100, 5), high(95, 5), high(90, 5, { rir: null })])).toBe(false);
  });
  it("treats failure tags as high effort", () => {
    expect(detectDeload([high(100, 5, { rir: null, failure: true }), high(95, 5, { rir: null, failure: true }), high(90, 5, { rir: null, failure: true })])).toBe(true);
  });
  it("same load with fewer reps counts as a decline", () => {
    expect(detectDeload([high(100, 8), high(100, 6), high(100, 4)])).toBe(true);
  });
  it("does not trigger when the third session recovered", () => {
    expect(detectDeload([high(100, 5), high(90, 5), high(95, 5)])).toBe(false);
  });
  it("assisted: more assistance is a decline", () => {
    expect(detectDeload([high(20, 8), high(25, 8), high(30, 8)], "assisted")).toBe(true);
    expect(detectDeload([high(30, 8), high(25, 8), high(20, 8)], "assisted")).toBe(false);
  });
});

describe("topSetOf", () => {
  it("picks the heaviest trusted working set and reads its effort", () => {
    expect(topSetOf([{ load: 60, reps: 8, warmup: true }, { load: 80, reps: 5, rir: 1, tags: ["failure"] }, { load: 40, reps: 12, tags: ["drop"] }], "free")).toEqual({
      load: 80,
      reps: 5,
      rir: 1,
      failure: true,
    });
  });
});

describe("scaleDeloadLoad", () => {
  it("takes the gym rung at or below 90%", () => {
    expect(scaleDeloadLoad(100, { equipment: "barbell", increment: 2.5, min: 20 })).toBe(90);
    expect(scaleDeloadLoad(102.5, { equipment: "barbell", increment: 2.5, min: 20 })).toBe(90);
  });
});

describe("reduceSetsByOne", () => {
  it("never drops below one set", () => {
    expect(reduceSetsByOne(3)).toBe(2);
    expect(reduceSetsByOne(1)).toBe(1);
  });
});
