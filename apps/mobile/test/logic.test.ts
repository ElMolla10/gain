import { describe, expect, it } from "vitest";
import type { GymLoadSpec } from "@gain/engine";
import { canLog, initialDraft, repeatLast, stepLoad, stepReps } from "../src/logic/draft";
import {
  adjustTimer, clampSeconds, DEFAULT_REST_SECONDS, formatClock, isDone, isRunning, MAX_REST_SECONDS, MIN_REST_SECONDS,
  newTimer, remainingMs, startTimer, stopTimer,
} from "../src/logic/restTimer";

const db: GymLoadSpec = { equipment: "dumbbell", loads: [10, 12.5, 15, 17.5, 20, 22.5, 25] };
const bar: GymLoadSpec = { equipment: "barbell", increment: 2.5, min: 20 };

describe("draft prefill", () => {
  const today = [
    { load: 40, reps: 8, rir: null, warmup: true },
    { load: 60, reps: 9, rir: 2, warmup: false },
  ];
  it("repeats the previous working set today first", () => {
    expect(initialDraft({ today, target: { load: 62.5, reps: 6 }, last: { load: 57.5, reps: 10 } })).toEqual({ load: 60, reps: 9, rir: 2, warmup: false });
  });
  it("then today's target, then last time", () => {
    expect(initialDraft({ today: [], target: { load: 62.5, reps: 6 }, last: { load: 57.5, reps: 10 } })).toMatchObject({ load: 62.5, reps: 6 });
    expect(initialDraft({ today: [], target: null, last: { load: 57.5, reps: 10 } })).toMatchObject({ load: 57.5, reps: 10 });
  });
  it("a target with no load (nothing proposed) falls through to last time", () => {
    expect(initialDraft({ today: [], target: { load: null, reps: null }, last: { load: 50, reps: 8 } })).toMatchObject({ load: 50 });
  });
  it("warm-ups alone do not become the next working prefill", () => {
    expect(initialDraft({ today: [today[0]!], target: { load: 62.5, reps: 6 }, last: null })).toMatchObject({ load: 62.5 });
  });
  it("with nothing at all it stays empty (never invented)", () => {
    expect(initialDraft({ today: [], target: null, last: null })).toEqual({ load: null, reps: null, rir: null, warmup: false });
  });
  it("repeat last copies the very last set, warm-up or not; none yet gives null", () => {
    expect(repeatLast(today)).toEqual({ load: 60, reps: 9, rir: 2, warmup: false });
    expect(repeatLast([today[0]!])).toMatchObject({ warmup: true });
    expect(repeatLast([])).toBeNull();
  });
  it("canLog needs a load and at least one rep", () => {
    expect(canLog({ load: null, reps: 5, rir: null, warmup: false })).toBe(false);
    expect(canLog({ load: 20, reps: 0, rir: null, warmup: false })).toBe(false);
    expect(canLog({ load: 0, reps: 8, rir: null, warmup: false })).toBe(true);
  });
});

describe("steppers use loads that exist", () => {
  it("dumbbell steps along the rack", () => {
    expect(stepLoad(db, 20, 1).load).toBe(22.5);
    expect(stepLoad(db, 20, -1).load).toBe(17.5);
    expect(stepLoad(db, 21, 1).load).toBe(22.5);
  });
  it("stops at the ends of the rack", () => {
    expect(stepLoad(db, 25, 1).load).toBe(25);
    expect(stepLoad(db, 10, -1).load).toBe(10);
  });
  it("barbell steps by 2.5 from the bar", () => {
    expect(stepLoad(bar, 100, 1).load).toBe(102.5);
    expect(stepLoad(bar, 20, -1).load).toBe(20);
  });
  it("bodyweight lines can step down to zero added load", () => {
    expect(stepLoad({ equipment: "plate", increment: 2.5 }, 2.5, -1, "bodyweight_plus_added").load).toBe(0);
  });
  it("with no gym loads it falls back to 2.5 and flags it as not exact", () => {
    expect(stepLoad(null, 20, 1)).toEqual({ load: 22.5, exact: false });
    expect(stepLoad(null, 1, -1).load).toBe(0);
  });
  it("reps step by one within 1..100", () => {
    expect(stepReps(8, 1)).toBe(9);
    expect(stepReps(1, -1)).toBe(1);
    expect(stepReps(100, 1)).toBe(100);
    expect(stepReps(null, 1)).toBe(1);
  });
});

describe("rest timer (simple, in-app)", () => {
  it("defaults to 90 s and shows the full time before it starts", () => {
    const t = newTimer();
    expect(remainingMs(t, 1000)).toBe(DEFAULT_REST_SECONDS * 1000);
    expect(isRunning(t, 1000)).toBe(false);
  });
  it("counts down from the end time, so a sleeping screen does not drift it", () => {
    const t = startTimer(newTimer(60), 10_000);
    expect(remainingMs(t, 10_000)).toBe(60_000);
    expect(remainingMs(t, 40_000)).toBe(30_000);
    expect(remainingMs(t, 500_000)).toBe(0);
    expect(isDone(t, 70_000)).toBe(true);
    expect(isRunning(t, 69_999)).toBe(true);
  });
  it("stop returns to the full duration", () => {
    const t = stopTimer(startTimer(newTimer(60), 0));
    expect(remainingMs(t, 5)).toBe(60_000);
    expect(isDone(t, 1e9)).toBe(false);
  });
  it("adjusts by 15 s while running and while stopped, within limits", () => {
    const running = adjustTimer(startTimer(newTimer(60), 0), 15, 10_000);
    expect(remainingMs(running, 10_000)).toBe(65_000);
    expect(adjustTimer(newTimer(60), -15, 0).durationMs).toBe(45_000);
    expect(adjustTimer(newTimer(MIN_REST_SECONDS), -15, 0).durationMs).toBe(MIN_REST_SECONDS * 1000);
    expect(adjustTimer(newTimer(MAX_REST_SECONDS), 15, 0).durationMs).toBe(MAX_REST_SECONDS * 1000);
    expect(clampSeconds(1)).toBe(MIN_REST_SECONDS);
  });
  it("formats m:ss and rounds partial seconds up", () => {
    expect(formatClock(90_000)).toBe("1:30");
    expect(formatClock(59_100)).toBe("1:00");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5_000)).toBe("0:05");
  });
});
