import { describe, expect, it } from "vitest";
import { formatDuration, liveSummary, previousText, volumeText, workingIndexes } from "../src/logic/liveSummary";

describe("live summary (Duration / Volume / Sets)", () => {
  it("counts working sets only: warm-ups and rejected outliers are left out", () => {
    const s = liveSummary(
      [
        { load: 40, reps: 10, warmup: true },
        { load: 60, reps: 8, warmup: false },
        { load: 60, reps: 7, warmup: false, outlierStatus: "unconfirmed" },
        { load: 600, reps: 8, warmup: false, outlierStatus: "rejected" },
      ],
      1000,
      61_000,
    );
    expect(s).toEqual({ durationMs: 60_000, volumeKg: 60 * 8 + 60 * 7, sets: 2 });
  });
  it("is zero before anything is logged and never negative", () => {
    expect(liveSummary([], null, 5)).toEqual({ durationMs: 0, volumeKg: 0, sets: 0 });
    expect(liveSummary([], 10_000, 5).durationMs).toBe(0);
  });
  it("formats the duration like a stopwatch and the volume in the lifter's unit", () => {
    expect(formatDuration(5_000)).toBe("5s");
    expect(formatDuration(125_000)).toBe("2m 05s");
    expect(formatDuration(3_900_000)).toBe("1h 05m");
    expect(formatDuration(5_000, { h: "س", m: "د", s: "ث" })).toBe("5ث");
    expect(volumeText(1000, "kg")).toBe("1000");
    expect(volumeText(100, "lb")).toBe("221");
  });
});

describe("PREVIOUS column", () => {
  const last = [{ load: 90, reps: 12 }, { load: 80, reps: 10 }];
  it("uses the same-numbered working set of the last session; warm-ups and extra rows get a dash", () => {
    expect(previousText(last, 0, "kg", "kg")).toBe("90kg x 12");
    expect(previousText(last, 1, "kg", "kg")).toBe("80kg x 10");
    expect(previousText(last, 2, "kg", "kg")).toBe("—");
    expect(previousText(last, null, "kg", "kg")).toBe("—");
    expect(previousText(null, 0, "kg", "kg")).toBe("—");
    expect(previousText([{ load: 20, reps: 5 }], 0, "lb", "lb")).toBe("44.1lb x 5");
  });
  it("working index skips warm-ups (lines up with the W / 1 / 2 labels)", () => {
    expect(workingIndexes([{ warmup: true }, { warmup: false }, { warmup: false }])).toEqual([null, 0, 1]);
  });
});
