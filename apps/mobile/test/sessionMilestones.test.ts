import { describe, expect, it } from "vitest";
import { sessionMilestones } from "../src/logic/sessionMilestones";
import type { HistorySession, LoggedSet } from "@gain/engine";

const line = { exerciseId: "bench", gymId: "g", setup: "free" as const };
const T0 = Date.UTC(2026, 0, 5);
const DAY = 86_400_000;
const w = (load: number, reps: number): LoggedSet => ({ load, reps });
const sess = (day: number, sets: LoggedSet[]): HistorySession => ({ line, performedAt: new Date(T0 + day * DAY).toISOString(), sets });

describe("sessionMilestones", () => {
  it("reports a reached goal and a streak of 3, and a positive month percent", () => {
    const facts = sessionMilestones({
      finishedAt: [T0, T0 + 2 * DAY, T0 + 4 * DAY],
      nowMs: T0 + 4 * DAY,
      monthHistory: [sess(0, [w(100, 5)]), sess(4, [w(110, 5)])],
      monthSetup: "free",
      trainedGoalLift: true,
      paceBefore: "on_pace",
      paceAfter: "reached",
    });
    expect(facts.map((f) => f.kind)).toEqual(["goal_reached", "streak", "month_pct"]);
    expect(facts.find((f) => f.kind === "streak")?.streak).toBe(3);
    expect(facts.find((f) => f.kind === "month_pct")?.pct).toBe(10);
  });
  it("does not treat one workout as a streak or a negative month change as improvement", () => {
    const facts = sessionMilestones({
      finishedAt: [T0],
      nowMs: T0,
      monthHistory: [sess(0, [w(110, 5)]), sess(4, [w(100, 5)])],
      monthSetup: "free",
      trainedGoalLift: false,
      paceBefore: null,
      paceAfter: null,
    });
    expect(facts).toEqual([]);
  });
  it("reports pace improved without changing the target", () => {
    expect(sessionMilestones({
      finishedAt: [],
      nowMs: T0,
      monthHistory: null,
      monthSetup: null,
      trainedGoalLift: true,
      paceBefore: "behind",
      paceAfter: "on_pace",
    }).map((f) => f.kind)).toEqual(["goal_improved"]);
  });
});
