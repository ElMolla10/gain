import { describe, expect, it } from "vitest";
import type { HistorySession, LoggedSet } from "@gain/engine";
import { exercisePath, pathFromSessionStrengths } from "../src/logic/exercisePath";

const set = (load: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...extra });
const session = (day: string, ...sets: LoggedSet[]): HistorySession => ({
  line: { exerciseId: "bench", gymId: "gym", setup: "free" }, performedAt: `${day}T12:00:00Z`, sets,
});

describe("Exercise Path", () => {
  it("anchors to the first session and reaches a tier from a later strength gain", () => {
    const path = exercisePath([session("2026-02-01", set(50, 5)), session("2026-03-01", set(60, 5))], "free");
    expect(path).toMatchObject({ score: 120, tier: "climber", next: "drive", nextScore: 135 });
    expect(path?.progress).toBe(0);
  });
  it("uses the strongest first-session set and ignores warmups, drops, and pending outliers", () => {
    const path = exercisePath([
      session("2026-02-01", set(50, 5), set(100, 1, { warmup: true })),
      session("2026-03-01", set(60, 5), set(200, 2, { outlierStatus: "unconfirmed" }), set(90, 3, { tags: ["drop"] })),
    ], "free");
    expect(path?.score).toBe(120);
    expect(exercisePath([session("2026-02-01", set(50, 5))], "assisted")).toBeNull();
  });
  it("excludes long sets and never invents a population percentile", () => {
    expect(exercisePath([session("2026-02-01", set(50, 15))], "free")).toBeNull();
    expect(pathFromSessionStrengths([{ at: 1, strength: 100 }, { at: 2, strength: 150 }]))
      .toMatchObject({ baseline: 100, best: 150, score: 150, tier: "ascent" });
  });
});
