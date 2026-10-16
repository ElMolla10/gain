import { describe, expect, it } from "vitest";
import { expectationPenaltyReps, orderAdjustedReps, parseReadiness, readinessPenaltyReps, sessionOrderFatigue, type SessionOrderSlot } from "./sessionOrder";

const slot = (over: Partial<SessionOrderSlot> & Pick<SessionOrderSlot, "exerciseId" | "name">): SessionOrderSlot => ({
  muscle: "chest",
  done: true,
  ...over,
});

describe("sessionOrderFatigue", () => {
  it("first for the muscle has no penalty, even with later same-muscle work listed", () => {
    expect(sessionOrderFatigue([
      slot({ exerciseId: "bench", name: "Bench Press", done: true }),
      slot({ exerciseId: "fly", name: "Chest Fly", done: false }),
    ], "bench")).toBeNull();
  });

  it("second for the muscle has a modest reduction after earlier work is done", () => {
    const f = sessionOrderFatigue([
      slot({ exerciseId: "bench", name: "Bench Press", done: true }),
      slot({ exerciseId: "fly", name: "Chest Fly", done: false }),
    ], "fly");
    expect(f).toMatchObject({ earlierName: "Bench Press", earlierCount: 1, penaltyReps: 1 });
  });

  it("does not penalise until the earlier same-muscle exercise has logged work", () => {
    expect(sessionOrderFatigue([
      slot({ exerciseId: "bench", name: "Bench Press", done: false }),
      slot({ exerciseId: "fly", name: "Chest Fly", done: false }),
    ], "fly")).toBeNull();
  });

  it("reordering so the later lift is first removes the penalty", () => {
    const slots = [
      slot({ exerciseId: "fly", name: "Chest Fly", done: false }),
      slot({ exerciseId: "bench", name: "Bench Press", done: true }),
    ];
    expect(sessionOrderFatigue(slots, "fly")).toBeNull();
    expect(sessionOrderFatigue(slots, "bench")).toBeNull();
  });

  it("same exercise later in the session is treated as later work", () => {
    const f = sessionOrderFatigue([
      slot({ exerciseId: "bench", name: "Bench Press", done: true }),
      slot({ exerciseId: "bench", name: "Bench Press", done: false }),
    ], "bench");
    // findIndex hits the first slot; a second identical id is not a separate current. Callers use unique ids.
    expect(f).toBeNull();
  });

  it("unknown muscles do not match each other", () => {
    expect(sessionOrderFatigue([
      slot({ exerciseId: "a", name: "A", muscle: "other", done: true }),
      slot({ exerciseId: "b", name: "B", muscle: "other", done: false }),
    ], "b")).toBeNull();
  });

  it("two earlier same-muscle lifts cap the penalty at 2", () => {
    const f = sessionOrderFatigue([
      slot({ exerciseId: "bench", name: "Bench Press", done: true }),
      slot({ exerciseId: "incline", name: "Incline Press", done: true }),
      slot({ exerciseId: "fly", name: "Chest Fly", done: false }),
    ], "fly");
    expect(f).toMatchObject({ earlierName: "Bench Press", earlierCount: 2, penaltyReps: 2 });
  });
});

describe("orderAdjustedReps", () => {
  it("drops 1–2 reps and never goes below 1", () => {
    expect(orderAdjustedReps(8, 0)).toBe(8);
    expect(orderAdjustedReps(8, 1)).toBe(7);
    expect(orderAdjustedReps(8, 2)).toBe(6);
    expect(orderAdjustedReps(8, 9)).toBe(6);
    expect(orderAdjustedReps(1, 2)).toBe(1);
  });

  it("a protected PR path is unchanged", () => {
    expect(orderAdjustedReps(8, 2, true)).toBe(8);
  });
});

describe("readiness flag", () => {
  it("normal has no penalty; fatigued is 1; returning is 2", () => {
    expect(parseReadiness(null)).toBeNull();
    expect(parseReadiness("normal")).toBe("normal");
    expect(readinessPenaltyReps(null)).toBe(0);
    expect(readinessPenaltyReps("normal")).toBe(0);
    expect(readinessPenaltyReps("fatigued")).toBe(1);
    expect(readinessPenaltyReps("returning")).toBe(2);
    expect(orderAdjustedReps(8, readinessPenaltyReps("normal"))).toBe(8);
    expect(orderAdjustedReps(8, readinessPenaltyReps("fatigued"))).toBe(7);
    expect(orderAdjustedReps(8, readinessPenaltyReps("returning"))).toBe(6);
  });
  it("combines with session-order and still caps at 2; clearing restores the full expectation", () => {
    expect(expectationPenaltyReps(1, 1)).toBe(2);
    expect(expectationPenaltyReps(2, 2)).toBe(2);
    expect(expectationPenaltyReps(0, 0)).toBe(0);
    expect(orderAdjustedReps(8, expectationPenaltyReps(1, readinessPenaltyReps("fatigued")))).toBe(6);
    expect(orderAdjustedReps(8, expectationPenaltyReps(1, readinessPenaltyReps(null)))).toBe(7);
  });
});
