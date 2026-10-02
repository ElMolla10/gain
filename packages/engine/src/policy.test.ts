import { describe, expect, it } from "vitest";
import { bodyRegionFromTitle, DEFAULT_TRIGGER, INCREMENT_BY_REGION, PRESETS, resolveProgression } from "./policy";

describe("resolveProgression", () => {
  it("defaults: upper body 2-5%, lower 5-10%, two sessions at the top, stall handling on", () => {
    const u = resolveProgression("upper");
    expect(u.increment).toEqual({ minPct: 0.02, maxPct: 0.05 });
    expect(resolveProgression("lower").increment).toEqual({ minPct: 0.05, maxPct: 0.1 });
    expect(u.trigger).toEqual(DEFAULT_TRIGGER);
    expect(u.stepDownAfterMisses).toBe(3);
    expect(u.stall).toEqual({ sessions: 4, deloadPct: 0.1 });
    expect(INCREMENT_BY_REGION.upper.maxPct).toBeLessThanOrEqual(INCREMENT_BY_REGION.lower.maxPct);
  });
  it("region defaults to upper", () => {
    expect(resolveProgression().bodyRegion).toBe("upper");
  });
  it("presets: double progression, ACSM 2009 and 2-for-2", () => {
    expect(resolveProgression("upper", { preset: "double_progression" }).trigger).toMatchObject({ extraReps: 0, sessions: 1 });
    const acsm = resolveProgression("upper", { preset: "acsm_2009" });
    expect(acsm.trigger).toMatchObject({ extraReps: 1, sessions: 2 });
    expect(acsm.increment).toEqual({ minPct: 0.02, maxPct: 0.1 });
    expect(resolveProgression("lower", { preset: "two_for_two" }).trigger).toMatchObject({ extraReps: 2, sessions: 2, repsBasis: "last_set" });
    expect(Object.keys(PRESETS).sort()).toEqual(["acsm_2009", "double_progression", "two_for_two"]);
  });
  it("explicit overrides win over the preset, which wins over the region default", () => {
    const c = resolveProgression("lower", { preset: "acsm_2009", trigger: { extraReps: 2 }, increment: { maxPct: 0.08 } });
    expect(c.trigger.extraReps).toBe(2);
    expect(c.trigger.sessions).toBe(2);
    expect(c.increment).toEqual({ minPct: 0.02, maxPct: 0.08 });
  });
  it("stall can be switched off per lift", () => {
    expect(resolveProgression("upper", { stall: null }).stall).toBeNull();
    expect(resolveProgression("upper", { stall: { sessions: 6 } }).stall).toEqual({ sessions: 6, deloadPct: 0.1 });
  });
  it("rejects nonsense", () => {
    expect(() => resolveProgression("upper", { trigger: { sessions: 0 } })).toThrow();
    expect(() => resolveProgression("upper", { trigger: { extraReps: -1 } })).toThrow();
    expect(() => resolveProgression("upper", { increment: { minPct: 0.06, maxPct: 0.05 } })).toThrow();
    expect(() => resolveProgression("upper", { stepDownAfterMisses: 0 })).toThrow();
    expect(() => resolveProgression("upper", { stall: { deloadPct: 0.7 } })).toThrow();
    expect(() => resolveProgression("upper", { trigger: { fastTrackRir: 0 } })).toThrow();
    expect(() => resolveProgression("upper", { preset: "nope" as never })).toThrow();
  });
});

describe("bodyRegionFromTitle", () => {
  it("recognises lower-body lifts, everything else is upper", () => {
    for (const t of ["Squat (Barbell)", "Hack Squat", "Romanian Deadlift (Barbell)", "Leg Press (Machine)", "Seated Calf Raise", "Hip Thrust (Barbell)"])
      expect(bodyRegionFromTitle(t)).toBe("lower");
    for (const t of ["Bench Press (Barbell)", "Lat Pulldown (Cable)", "Bicep Curl (Barbell)", "Triceps Pushdown"]) expect(bodyRegionFromTitle(t)).toBe("upper");
  });
});
