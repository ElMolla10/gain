import { describe, expect, it } from "vitest";
import { proposeNext } from "./progression";
import { ASOF, exBar, gymA, lineOf, run } from "./testkit";

describe("P05 the stored decision keeps the programme's range next to the range used", () => {
  it("default ceiling replaces the programme's top: both ranges are recorded, ceiling source = default", () => {
    // Not pinned: programme says 8-12 for a bench press; the app-wide default ceiling for upper body is 10.
    const ex = { exerciseId: "bench", name: "Barbell Bench Press", equipment: "barbell" as const, setup: "free" as const, repRange: { min: 8, max: 12 } };
    const p = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(lineOf("bench"), 60, [8, 9, 9]) });
    expect(p.inputs.programmeRepRange).toEqual({ min: 8, max: 12 });
    expect(p.inputs.repRange).toEqual({ min: 8, max: 10 });
    expect(p.inputs.policy.ceilingSource).toBe("default");
  });
  it("a per-lift ceiling is recorded as the lift's own", () => {
    const p = proposeNext({ exercise: exBar({ repRange: { min: 6, max: 12 }, progression: { repCeiling: 8 } }), gym: gymA, asOf: ASOF, history: run(lineOf("bench"), 60, [6, 7, 7]) });
    expect(p.inputs.programmeRepRange).toEqual({ min: 6, max: 12 });
    expect(p.inputs.repRange.max).toBe(8);
    expect(p.inputs.policy.ceilingSource).toBe("lift");
  });
});
