import { describe, expect, it } from "vitest";
import { resolveRepTop } from "./policy";
import { proposeNext } from "./progression";
import { RULE_VERSION } from "./version";
import { backtest } from "./backtest";
import { ASOF, gymA, lineOf, run } from "./testkit";
import type { ExerciseSpec } from "./types";

// rule-v0.4: the program's own rep range wins; the GAIN ceilings (10 / 12 / 15) only apply when asked for or when the program has no top.
const bench = (repRange: ExerciseSpec["repRange"], progression?: ExerciseSpec["progression"]): ExerciseSpec => ({
  exerciseId: "bench",
  name: "Barbell Bench Press",
  equipment: "barbell",
  setup: "free",
  repRange,
  progression,
});
const P = (ex: ExerciseSpec, reps: number[], options?: Parameters<typeof proposeNext>[0]["options"]) =>
  proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(lineOf("bench"), 100, reps), options });

describe("rule version", () => {
  it("is rule-v0.4", () => expect(RULE_VERSION).toBe("rule-v0.4"));
});

describe("resolveRepTop", () => {
  it("order: lift ceiling, then the setting, then the program's top, then the GAIN ceiling when there is no top", () => {
    expect(resolveRepTop({ programMax: 12, liftCeiling: 8, gainCeiling: 10, useGainCeilings: true })).toEqual({ top: 8, basis: "lift" });
    expect(resolveRepTop({ programMax: 12, gainCeiling: 10, useGainCeilings: true })).toEqual({ top: 10, basis: "gain_setting" });
    expect(resolveRepTop({ programMax: 12, gainCeiling: 10 })).toEqual({ top: 12, basis: "program" });
    expect(resolveRepTop({ programMax: null, gainCeiling: 10 })).toEqual({ top: 10, basis: "no_upper_bound" });
    expect(resolveRepTop({ programMax: undefined, gainCeiling: 12 })).toEqual({ top: 12, basis: "no_upper_bound" });
  });
});

describe("the program's range wins by default", () => {
  it("8-12: reaching 10 reps no longer earns load, 12 does", () => {
    const at10 = P(bench({ min: 8, max: 12 }), [9, 10]);
    expect(at10.currency).toBe("reps");
    expect(at10.load).toBe(100);
    expect(at10.reps).toBe(11);
    expect(at10.inputs.repRange).toEqual({ min: 8, max: 12 });
    expect(at10.inputs.readiness.targetReps).toBe(12);
    const at12 = P(bench({ min: 8, max: 12 }), [11, 12]);
    expect(at12.currency).toBe("load");
    expect(at12.load).toBeGreaterThan(100);
    expect(at12.reps).toBe(8);
  });
  it("a program top below the GAIN ceiling is kept too (5x5: load goes up at 5, not 10)", () => {
    const p = P(bench({ min: 3, max: 5 }), [4, 5]);
    expect(p.currency).toBe("load");
    expect(p.inputs.repRange).toEqual({ min: 3, max: 5 });
  });
  it("legs and lateral raises follow their program's top as well", () => {
    const leg: ExerciseSpec = { exerciseId: "leg", name: "Leg Press (Machine)", equipment: "machine", setup: "free", repRange: { min: 10, max: 15 } };
    const p = proposeNext({ exercise: leg, gym: gymA, asOf: ASOF, history: run(lineOf("leg"), 100, [12, 12]) });
    expect(p.currency).toBe("reps");
    expect(p.inputs.repRange.max).toBe(15);
    expect(p.inputs.repTopBasis).toBe("program");
  });
  it("an explicit per-lift ceiling still wins over the program's top", () => {
    const p = P(bench({ min: 8, max: 12 }, { repCeiling: 10 }), [9, 10]);
    expect(p.currency).toBe("load");
    expect(p.inputs.repTopBasis).toBe("lift");
  });
  it("the progression history rule is otherwise untouched: same load grid, same step, same sets requirement", () => {
    const a = P(bench({ min: 8, max: 10 }), [9, 10]);
    const b = P(bench({ min: 8 }), [9, 10]); // no top -> the GAIN ceiling 10
    expect({ ...a, inputs: undefined, reason: a.reason.key }).toEqual({ ...b, inputs: undefined, reason: b.reason.key });
  });
});

describe("the setting 'Use GAIN rep ceilings'", () => {
  it("on: 8-12 progresses at 10 again (the rule-v0.3 behaviour)", () => {
    const p = P(bench({ min: 8, max: 12 }), [9, 10], { useGainCeilings: true });
    expect(p.currency).toBe("load");
    expect(p.inputs.repRange).toEqual({ min: 8, max: 10 });
  });
  it("on, edited app-wide ceilings are used", () => {
    const p = P(bench({ min: 8, max: 12 }), [9, 10], { useGainCeilings: true, repCeilings: { upper: 11 } });
    expect(p.currency).toBe("reps");
    expect(p.inputs.repRange.max).toBe(11);
    expect(p.inputs.gainCeiling).toBe(11);
  });
  it("on, a ceiling above the program top is applied too (the setting is honest about replacing it)", () => {
    const p = P(bench({ min: 6, max: 8 }), [8, 8], { useGainCeilings: true });
    expect(p.inputs.repRange.max).toBe(10);
    expect(p.currency).toBe("reps");
  });
});

describe("no upper bound", () => {
  it("falls back to the GAIN ceiling for the kind of lift and says so", () => {
    const p = P(bench({ min: 8 }), [9, 10]);
    expect(p.currency).toBe("load");
    expect(p.inputs.repTopBasis).toBe("no_upper_bound");
    expect(p.inputs.policy.ceilingSource).toBe("default");
    expect(p.inputs.programmeRepRange).toEqual({ min: 8, max: null });
  });
  it("max null behaves like a missing max; an invalid range still throws", () => {
    expect(P(bench({ min: 8, max: null }), [9, 10]).inputs.repTopBasis).toBe("no_upper_bound");
    expect(() => P(bench({ min: 8, max: 6 }), [9, 10])).toThrow();
    expect(() => P(bench({ min: 0 }), [9, 10])).toThrow();
  });
  it("JSON-safe decision inputs (null, not undefined)", () => {
    const p = P(bench({ min: 8 }), [9, 10]);
    expect(JSON.parse(JSON.stringify(p.inputs)).programmeRepRange).toEqual({ min: 8, max: null });
  });
});

describe("backtest with a program range", () => {
  const workouts = [] as never[];
  it("accepts a range without a top and the setting (no workouts: nothing evaluated, no throw)", () => {
    expect(backtest(workouts, { repRange: { min: 6 }, minSessions: 4, useGainCeilings: true }).outcomes).toEqual([]);
  });
});
