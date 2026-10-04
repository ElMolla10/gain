import { describe, expect, it } from "vitest";
import { proposeNext } from "./progression";
import { ASOF, exBar, gymA, lineOf, run } from "./testkit";

const bench = { exerciseId: "bench", name: "Barbell Bench Press", equipment: "barbell" as const, setup: "free" as const };

describe("the stored decision keeps the program's range next to the range used, and says why the top is what it is", () => {
  it("rule-v0.4 default: the program's own 8-12 is kept, source = program", () => {
    const p = proposeNext({ exercise: { ...bench, repRange: { min: 8, max: 12 } }, gym: gymA, asOf: ASOF, history: run(lineOf("bench"), 60, [8, 9, 9]) });
    expect(p.inputs.programmeRepRange).toEqual({ min: 8, max: 12 });
    expect(p.inputs.repRange).toEqual({ min: 8, max: 12 });
    expect(p.inputs.repTopBasis).toBe("program");
    expect(p.inputs.policy.ceilingSource).toBe("program");
    expect(p.inputs.gainCeiling).toBe(10);
  });
  it("'Use GAIN rep ceilings' on: the GAIN ceiling replaces the program's top, both ranges recorded, basis gain_setting", () => {
    const p = proposeNext({ exercise: { ...bench, repRange: { min: 8, max: 12 } }, gym: gymA, asOf: ASOF, history: run(lineOf("bench"), 60, [8, 9, 9]), options: { useGainCeilings: true } });
    expect(p.inputs.programmeRepRange).toEqual({ min: 8, max: 12 });
    expect(p.inputs.repRange).toEqual({ min: 8, max: 10 });
    expect(p.inputs.repTopBasis).toBe("gain_setting");
    expect(p.inputs.policy.ceilingSource).toBe("default");
  });
  it("a program with no upper bound uses the GAIN ceiling and records that it did", () => {
    const p = proposeNext({ exercise: { ...bench, repRange: { min: 8 } }, gym: gymA, asOf: ASOF, history: run(lineOf("bench"), 60, [8, 9, 9]) });
    expect(p.inputs.programmeRepRange).toEqual({ min: 8, max: null });
    expect(p.inputs.repRange).toEqual({ min: 8, max: 10 });
    expect(p.inputs.repTopBasis).toBe("no_upper_bound");
  });
  it("a per-lift ceiling is recorded as the lift's own, over both the program's top and the setting", () => {
    for (const useGainCeilings of [false, true]) {
      const p = proposeNext({ exercise: exBar({ repRange: { min: 6, max: 12 }, progression: { repCeiling: 8 } }), gym: gymA, asOf: ASOF, history: run(lineOf("bench"), 60, [6, 7, 7]), options: { useGainCeilings } });
      expect(p.inputs.programmeRepRange).toEqual({ min: 6, max: 12 });
      expect(p.inputs.repRange.max).toBe(8);
      expect(p.inputs.repTopBasis).toBe("lift");
      expect(p.inputs.policy.ceilingSource).toBe("lift");
    }
  });
});
