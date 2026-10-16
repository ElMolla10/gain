import { describe, expect, it } from "vitest";
import { elapsedMs, foldPausedMs, pauseClock, resumeClock } from "../src/logic/workoutClock";

describe("workout duration clock", () => {
  const T = 1_700_000_000_000;

  it("counts wall time from start while running", () => {
    expect(elapsedMs(T, 0, null, T + 28_000)).toBe(28_000);
  });

  it("freezes at pausedAt and ignores later now", () => {
    const paused = pauseClock(0, null, T + 30_000);
    expect(paused.pausedAt).toBe(T + 30_000);
    expect(elapsedMs(T, paused.pausedMs, paused.pausedAt, T + 90_000)).toBe(30_000);
    expect(elapsedMs(T, paused.pausedMs, paused.pausedAt, T + 120_000)).toBe(30_000);
  });

  it("resume adds the paused interval and starts counting again", () => {
    const paused = pauseClock(0, null, T + 30_000);
    const running = resumeClock(paused.pausedMs, paused.pausedAt, T + 90_000);
    expect(running).toEqual({ pausedMs: 60_000, pausedAt: null });
    expect(elapsedMs(T, running.pausedMs, running.pausedAt, T + 120_000)).toBe(60_000);
  });

  it("pause and resume are idempotent", () => {
    expect(pauseClock(5, T + 1, T + 9)).toEqual({ pausedMs: 5, pausedAt: T + 1 });
    expect(resumeClock(5, null, T + 9)).toEqual({ pausedMs: 5, pausedAt: null });
  });

  it("finish folds an open pause into pausedMs so active time excludes it", () => {
    expect(foldPausedMs(10_000, T + 40_000, T + 70_000)).toBe(40_000);
    expect(foldPausedMs(10_000, null, T + 70_000)).toBe(10_000);
    expect(elapsedMs(T, foldPausedMs(0, T + 60_000, T + 90_000), null, T + 90_000)).toBe(60_000);
  });

  it("never goes negative", () => {
    expect(elapsedMs(T, 0, null, T - 5)).toBe(0);
    expect(elapsedMs(T, 80_000, null, T + 10_000)).toBe(0);
  });
});
