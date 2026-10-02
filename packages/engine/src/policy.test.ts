import { describe, expect, it } from "vitest";
import {
  ACSM_INCREMENT,
  bodyRegionFromTitle,
  DEFAULT_PRESET,
  DEFAULT_REP_CEILINGS,
  DEFAULT_TRIGGER,
  INCREMENT_BY_REGION,
  mergeRepCeilings,
  PRESETS,
  resolveProgression,
} from "./policy";

describe("resolveProgression: the default is ACSM 2009 + the lifter's ceilings", () => {
  it("defaults: acsm_2009, one session reaching the ceiling, 2-10% for every region, no extra conventions", () => {
    expect(DEFAULT_PRESET).toBe("acsm_2009");
    for (const region of ["upper", "lower"] as const) {
      const c = resolveProgression(region);
      expect(c.preset).toBe("acsm_2009");
      expect(c.increment).toEqual({ minPct: 0.02, maxPct: 0.1 });
      expect(c.trigger).toEqual({ extraReps: 0, sessions: 1, repsBasis: "all_sets", fastTrackRir: null });
      expect(c.stall).toBeNull();
      expect(c.stepDownAfterMisses).toBeNull();
    }
    expect(ACSM_INCREMENT).toEqual({ minPct: 0.02, maxPct: 0.1 });
    expect(resolveProgression("upper").trigger).toEqual(DEFAULT_TRIGGER);
  });
  it("region defaults to upper", () => {
    expect(resolveProgression().bodyRegion).toBe("upper");
  });
  it("presets: the others stay available but are not the default", () => {
    expect(Object.keys(PRESETS).sort()).toEqual(["acsm_2009", "acsm_2009_strict", "coaching_conventions", "double_progression", "two_for_two"]);
    expect(resolveProgression("upper", { preset: "double_progression" }).trigger).toMatchObject({ extraReps: 0, sessions: 1 });
    const strict = resolveProgression("upper", { preset: "acsm_2009_strict" });
    expect(strict.trigger).toMatchObject({ extraReps: 1, sessions: 2 });
    expect(strict.increment).toEqual({ minPct: 0.02, maxPct: 0.1 });
    expect(resolveProgression("lower", { preset: "two_for_two" }).trigger).toMatchObject({ extraReps: 2, sessions: 2, repsBasis: "last_set" });
  });
  it("coaching_conventions is the opt-in bundle: 2 sessions, RIR fast track 3, region bands, stall 4/10%, step down after 3", () => {
    const u = resolveProgression("upper", { preset: "coaching_conventions" });
    expect(u.trigger).toMatchObject({ sessions: 2, fastTrackRir: 3 });
    expect(u.increment).toEqual(INCREMENT_BY_REGION.upper);
    expect(resolveProgression("lower", { preset: "coaching_conventions" }).increment).toEqual({ minPct: 0.05, maxPct: 0.1 });
    expect(u.stall).toEqual({ sessions: 4, deloadPct: 0.1 });
    expect(u.stepDownAfterMisses).toBe(3);
  });
  it("explicit overrides win over the preset, which wins over the default", () => {
    const c = resolveProgression("lower", { preset: "acsm_2009_strict", trigger: { extraReps: 2 }, increment: { maxPct: 0.08 } });
    expect(c.trigger.extraReps).toBe(2);
    expect(c.trigger.sessions).toBe(2);
    expect(c.increment).toEqual({ minPct: 0.02, maxPct: 0.08 });
  });
  it("stall and step-down are opt-in per lift", () => {
    expect(resolveProgression("upper", { stall: { sessions: 6 } }).stall).toEqual({ sessions: 6, deloadPct: 0.1 });
    expect(resolveProgression("upper", { stall: null }).stall).toBeNull();
    expect(resolveProgression("upper", { stepDownAfterMisses: 2 }).stepDownAfterMisses).toBe(2);
    expect(resolveProgression("upper", { preset: "coaching_conventions", stall: null, stepDownAfterMisses: null })).toMatchObject({ stall: null, stepDownAfterMisses: null });
  });
  it("rejects nonsense", () => {
    expect(() => resolveProgression("upper", { trigger: { sessions: 0 } })).toThrow();
    expect(() => resolveProgression("upper", { trigger: { extraReps: -1 } })).toThrow();
    expect(() => resolveProgression("upper", { increment: { minPct: 0.06, maxPct: 0.05 } })).toThrow();
    expect(() => resolveProgression("upper", { stepDownAfterMisses: 0 })).toThrow();
    expect(() => resolveProgression("upper", { stall: { deloadPct: 0.7 } })).toThrow();
    expect(() => resolveProgression("upper", { trigger: { fastTrackRir: 0 } })).toThrow();
    expect(() => resolveProgression("upper", { preset: "nope" as never })).toThrow();
    expect(() => resolveProgression("upper", { repCeiling: 0 })).toThrow();
    expect(() => resolveProgression("upper", { repCeiling: 10.5 })).toThrow();
  });
  it("default ceilings: 10 upper, 12 legs, 15 lateral raises", () => {
    expect(DEFAULT_REP_CEILINGS).toEqual({ upper: 10, lower: 12, lateral_raise: 15 });
    expect(mergeRepCeilings({ lower: 15 })).toEqual({ upper: 10, lower: 15, lateral_raise: 15 });
    expect(() => mergeRepCeilings({ upper: 0 })).toThrow();
  });
});

describe("bodyRegionFromTitle", () => {
  it("recognises lower-body lifts, everything else is upper", () => {
    for (const t of ["Squat (Barbell)", "Hack Squat", "Romanian Deadlift (Barbell)", "Leg Press (Machine)", "Seated Calf Raise", "Hip Thrust (Barbell)"])
      expect(bodyRegionFromTitle(t)).toBe("lower");
    for (const t of ["Bench Press (Barbell)", "Lat Pulldown (Cable)", "Bicep Curl (Barbell)", "Triceps Pushdown"]) expect(bodyRegionFromTitle(t)).toBe("upper");
  });
});
