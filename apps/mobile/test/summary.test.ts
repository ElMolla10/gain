import { describe, expect, it } from "vitest";
import type { LoggedSet } from "@gain/engine";
import { summarizeExercise } from "../src/logic/summary";

const S = (load: number, reps: number, x: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...x });

describe("summarizeExercise", () => {
  it("counts only trusted working sets and reports the rest", () => {
    const r = summarizeExercise("free", [S(20, 10, { warmup: true }), S(60, 8), S(60, 7), S(40, 15, { tags: ["drop"] }), S(120, 8, { outlierStatus: "unconfirmed" })], []);
    expect(r).toMatchObject({ counted: 2, warmups: 1, dropSets: 1, unconfirmed: 1, top: { load: 60, reps: 8 } });
  });
  it("first time: no record claimed", () => {
    expect(summarizeExercise("free", [S(60, 8)], [])).toMatchObject({ firstTime: true, records: [] });
  });
  it("heavier than any earlier working set is a load record", () => {
    expect(summarizeExercise("free", [S(62.5, 6)], [S(60, 10), S(60, 9)]).records).toEqual(["load"]);
  });
  it("same load with more reps than ever at that load is a reps record", () => {
    expect(summarizeExercise("free", [S(60, 11)], [S(60, 10), S(57.5, 12)]).records).toEqual(["reps_at_load"]);
  });
  it("same load, same or fewer reps: no record", () => {
    expect(summarizeExercise("free", [S(60, 10)], [S(60, 10)]).records).toEqual([]);
    expect(summarizeExercise("free", [S(60, 8)], [S(60, 10)]).records).toEqual([]);
  });
  it("lighter than before and no earlier sets at that load: nothing to compare, no record", () => {
    expect(summarizeExercise("free", [S(50, 20)], [S(60, 8)]).records).toEqual([]);
  });
  it("earlier warm-ups, drop sets and unconfirmed sets do not set records", () => {
    expect(summarizeExercise("free", [S(60, 8)], [S(100, 5, { warmup: true }), S(100, 5, { outlierStatus: "unconfirmed" }), S(100, 5, { tags: ["drop"] })])).toMatchObject({ firstTime: true, records: [] });
  });
  it("assisted lines: LESS assistance is the record", () => {
    expect(summarizeExercise("assisted", [S(25, 8)], [S(30, 8)]).records).toEqual(["load"]);
    expect(summarizeExercise("assisted", [S(35, 8)], [S(30, 8)]).records).toEqual([]);
    expect(summarizeExercise("assisted", [S(30, 8), S(35, 12)], []).top).toEqual({ load: 30, reps: 8 });
  });
  it("no counted sets: no top and nothing claimed", () => {
    expect(summarizeExercise("free", [S(20, 10, { warmup: true })], [S(60, 8)])).toMatchObject({ counted: 0, top: null, records: [] });
  });
  it("top reps is the best reps at the top load", () => {
    expect(summarizeExercise("free", [S(60, 8), S(60, 10), S(57.5, 12)], []).top).toEqual({ load: 60, reps: 10 });
  });
});
