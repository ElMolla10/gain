import { describe, expect, it } from "vitest";
import { classifyLift, ceilingClassOf, isLateralRaise } from "./policy";
import { proposeNext, type ProposeContext } from "./progression";
import { ASOF, lineOf, run, S, session } from "./testkit";
import type { ExerciseSpec, GymFingerprint } from "./types";

/** Fine-grained gym so a real step is always inside ACSM's 2-10% band: these tests are about the ceiling, not about load grids. */
const gym: GymFingerprint = {
  gymId: "gymA",
  loads: [
    { equipment: "barbell", increment: 2.5, min: 20 },
    { equipment: "machine", increment: 5, min: 5, max: 300 },
    { equipment: "cable", increment: 1, min: 1, max: 60 },
    { equipment: "dumbbell", increment: 1, min: 1, max: 60 },
  ],
};

const P = (exercise: ExerciseSpec, history: ProposeContext["history"], options?: ProposeContext["options"]) =>
  proposeNext({ exercise, gym, history, asOf: ASOF, options });

// NOTE: no testkit spec helpers here: the ceiling must come from the lift's NAME / region, not from a pinned test value.
const bench: ExerciseSpec = { exerciseId: "Bench Press (Barbell)", equipment: "barbell", setup: "free", repRange: { min: 6, max: 10 } };
const legPress: ExerciseSpec = { exerciseId: "Leg Press (Machine)", equipment: "machine", setup: "free", repRange: { min: 8, max: 12 } };
const lateral: ExerciseSpec = { exerciseId: "Lateral Raise (Cable)", equipment: "cable", setup: "free", repRange: { min: 10, max: 15 } };

describe("classification by name", () => {
  it("lateral raises, every variant", () => {
    for (const t of [
      "Lateral Raise (Dumbbell)",
      "Lateral Raise (Cable)",
      "Single Arm Lateral Raise (Cable)",
      "Lateral Raise (Machine)",
      "Seated Lateral Raise",
      "Dumbbell Lateral Raises",
      "Cable Lateral Raise",
      "One-Arm Cable Lateral Raise",
      "Side Raise",
      "Side Lateral Raise",
      "lateral_raise_db",
      "Machine Lateral Raise",
      "LATERAL RAISE",
      "رفرفة جانبي بالدمبل",
    ]) {
      expect(isLateralRaise(t), t).toBe(true);
      expect(ceilingClassOf(undefined, t), t).toBe("lateral_raise");
    }
  });
  it("not lateral raises: front raise, rear-delt work, lateral lunge", () => {
    for (const t of ["Front Raise (Dumbbell)", "Reverse Lateral Raise", "Bent Over Lateral Raise", "Rear Delt Fly", "Lat Pulldown (Cable)", "Lateral Lunge", "Shoulder Press (Dumbbell)"])
      expect(isLateralRaise(t), t).toBe(false);
  });
  it("legs", () => {
    for (const t of [
      "Squat (Barbell)",
      "Back Squat",
      "Front Squat",
      "Hack Squat (Machine)",
      "Bulgarian Split Squat",
      "Leg Press (Machine)",
      "Leg Extension (Machine)",
      "Seated Leg Curl (Machine)",
      "Lying Leg Curl",
      "Walking Lunge (Dumbbell)",
      "Lateral Lunge",
      "Romanian Deadlift (Barbell)",
      "RDL",
      "Deadlift (Barbell)",
      "Sumo Deadlift",
      "Trap Bar Deadlift",
      "Stiff Leg Deadlift",
      "Standing Calf Raise (Machine)",
      "Seated Calf Raise",
      "Hip Thrust (Barbell)",
      "Glute Bridge",
      "Glute Kickback (Cable)",
      "Hip Abduction (Machine)",
      "Hip Adductor (Machine)",
      "Good Morning (Barbell)",
      "Step Up",
      "Nordic Hamstring Curl",
      "ليج بريس",
      "سكوات بالبار",
    ]) {
      expect(classifyLift(t).bodyRegion, t).toBe("lower");
      expect(ceilingClassOf(undefined, t), t).toBe("lower");
    }
  });
  it("everything else is upper (including abs 'leg raise')", () => {
    for (const t of ["Bench Press (Barbell)", "Incline Dumbbell Press", "Lat Pulldown (Cable)", "Seated Cable Row", "Bicep Curl (Dumbbell)", "Hammer Curl", "Triceps Pushdown", "Face Pull", "Overhead Press", "Pull Up", "Hanging Leg Raise", "Front Raise", "Shrug (Dumbbell)", "Chest Fly"]) {
      expect(classifyLift(t).bodyRegion, t).toBe("upper");
      expect(ceilingClassOf(undefined, t), t).toBe("upper");
    }
  });
  it("an explicit body region wins over the name", () => {
    expect(ceilingClassOf("upper", "Back Squat")).toBe("upper");
    expect(ceilingClassOf("lower", "Lateral Raise (Cable)")).toBe("lower");
  });
});

describe("the ceiling is where load goes up: 10 upper, 12 legs, 15 lateral raises", () => {
  it("upper body: 10 reps (not 12)", () => {
    const below = P(bench, run(lineOf(bench.exerciseId), 100, [9, 9]));
    expect(below.inputs.readiness.targetReps).toBe(10);
    expect(below.inputs.policy.repCeiling).toBe(10);
    expect(below.inputs.repRange).toEqual({ min: 6, max: 10 });
    expect(below.currency).toBe("reps");
    expect(below.load).toBe(100);
    expect(below.reps).toBe(10);
    const at = P(bench, run(lineOf(bench.exerciseId), 100, [9, 10]));
    expect(at.currency).toBe("load");
    expect(at.load).toBeGreaterThan(100);
    expect(at.reps).toBe(6);
  });
  it("upper body: even an old 8-12 range does not hold the load past 10", () => {
    const ex: ExerciseSpec = { ...bench, repRange: { min: 8, max: 12 } };
    expect(P(ex, run(lineOf(ex.exerciseId), 100, [10, 10])).currency).toBe("load");
  });
  it("legs: 11 reps is not enough, 12 is", () => {
    const l = lineOf(legPress.exerciseId);
    const at11 = P(legPress, run(l, 100, [10, 11]));
    expect(at11.currency).toBe("reps");
    expect(at11.load).toBe(100);
    expect(at11.reps).toBe(12);
    expect(at11.inputs.policy).toMatchObject({ bodyRegion: "lower", ceilingClass: "lower", repCeiling: 12 });
    const at12 = P(legPress, run(l, 100, [11, 12]));
    expect(at12.currency).toBe("load");
    expect(at12.load).toBe(105); // 5 kg step = 5%, inside ACSM 2-10%
  });
  it("lateral raise (cable): 14 reps is not enough, 15 is", () => {
    const l = lineOf(lateral.exerciseId);
    const at14 = P(lateral, run(l, 20, [13, 14]));
    expect(at14.currency).toBe("reps");
    expect(at14.load).toBe(20);
    expect(at14.reps).toBe(15);
    expect(at14.inputs.policy).toMatchObject({ ceilingClass: "lateral_raise", repCeiling: 15 });
    const at15 = P(lateral, run(l, 20, [14, 15]));
    expect(at15.currency).toBe("load");
    expect(at15.load).toBe(21);
  });
  it("lateral raise variants all get 15 (dumbbell, single-arm cable, machine)", () => {
    for (const [name, equipment] of [
      ["Lateral Raise (Dumbbell)", "dumbbell"],
      ["Single Arm Lateral Raise (Cable)", "cable"],
      ["Lateral Raise (Machine)", "machine"],
    ] as const) {
      const ex: ExerciseSpec = { exerciseId: name, equipment, setup: "free", repRange: { min: 8, max: 12 } };
      const p = P(ex, run(lineOf(name), 40, [13, 14]));
      expect(p.inputs.policy.repCeiling, name).toBe(15);
      expect(p.load, name).toBe(40);
    }
  });
  it("the name can come from `name` while the id is an opaque key", () => {
    const ex: ExerciseSpec = { exerciseId: "7f3a-uuid", name: "Seated Lateral Raise (Machine)", equipment: "machine", setup: "free", repRange: { min: 10, max: 12 } };
    expect(P(ex, run(lineOf("7f3a-uuid"), 20, [12, 12])).inputs.policy.repCeiling).toBe(15);
    const sq: ExerciseSpec = { exerciseId: "7f3a-uuid", name: "Barbell Back Squat", equipment: "barbell", setup: "free", repRange: { min: 6, max: 10 } };
    expect(P(sq, run(lineOf("7f3a-uuid"), 100, [10, 10])).inputs.policy.repCeiling).toBe(12);
  });
  it("one session reaching the ceiling is enough; the rep before it is not", () => {
    const l = lineOf(bench.exerciseId);
    const p = P(bench, run(l, 100, [8, 10]));
    expect(p.inputs.readiness).toMatchObject({ qualifyingSessions: 1, requiredSessions: 1, fastTracked: false });
    expect(p.currency).toBe("load");
  });
  it("the WEAKEST working set decides: 10, 10, 9 is not the ceiling", () => {
    const l = lineOf(bench.exerciseId);
    const h = [session(l, "2026-09-27", [S(100, 9), S(100, 9), S(100, 9)]), session(l, "2026-09-30", [S(100, 10), S(100, 10), S(100, 9)])];
    const p = P(bench, h);
    expect(p.currency).toBe("reps");
    expect(p.load).toBe(100);
    expect(p.reps).toBe(10);
  });
  it("reps above the ceiling also count", () => {
    expect(P(bench, run(lineOf(bench.exerciseId), 100, [11, 12])).currency).toBe("load");
  });
  it("no early load: every rep count below the ceiling progresses by reps at the same load", () => {
    const l = lineOf(legPress.exerciseId);
    for (let r = 8; r < 12; r++) {
      const p = P(legPress, run(l, 100, [r - 1, r]));
      expect(p.load, `r=${r}`).toBe(100);
      expect(p.currency).toBe("reps");
      expect(p.reps).toBe(r + 1);
    }
  });
});

describe("ceilings are editable", () => {
  it("per lift: progression.repCeiling replaces the default", () => {
    const ex: ExerciseSpec = { ...bench, progression: { repCeiling: 8 } };
    const p = P(ex, run(lineOf(ex.exerciseId), 100, [7, 8]));
    expect(p.inputs.policy).toMatchObject({ repCeiling: 8, ceilingSource: "lift" });
    expect(p.currency).toBe("load");
    const up: ExerciseSpec = { ...bench, progression: { repCeiling: 12 } };
    expect(P(up, run(lineOf(up.exerciseId), 100, [10, 11])).currency).toBe("reps");
  });
  it("app-wide: options.repCeilings edits the defaults per kind of lift", () => {
    const h = run(lineOf(bench.exerciseId), 100, [10, 10]);
    expect(P(bench, h).currency).toBe("load");
    const raised = P(bench, h, { repCeilings: { upper: 12 } });
    expect(raised.inputs.policy.repCeiling).toBe(12);
    expect(raised.currency).toBe("reps");
    expect(P(legPress, run(lineOf(legPress.exerciseId), 100, [12, 12]), { repCeilings: { lower: 15 } }).currency).toBe("reps");
    expect(P(lateral, run(lineOf(lateral.exerciseId), 20, [14, 15]), { repCeilings: { lateral_raise: 20 } }).currency).toBe("reps");
  });
  it("per lift beats app-wide", () => {
    const ex: ExerciseSpec = { ...bench, progression: { repCeiling: 6 } };
    expect(P(ex, run(lineOf(ex.exerciseId), 100, [6, 6]), { repCeilings: { upper: 12 } }).inputs.policy).toMatchObject({ repCeiling: 6, ceilingSource: "lift" });
  });
  it("the programme's bottom of the range survives, but never above the ceiling", () => {
    const ex: ExerciseSpec = { ...bench, repRange: { min: 6, max: 10 }, progression: { repCeiling: 5 } };
    expect(P(ex, run(lineOf(ex.exerciseId), 100, [5, 5])).inputs.repRange).toEqual({ min: 5, max: 5 });
  });
  it("invalid ceilings are rejected", () => {
    expect(() => P({ ...bench, progression: { repCeiling: 0 } }, run(lineOf(bench.exerciseId), 100, [8, 8]))).toThrow();
    expect(() => P(bench, run(lineOf(bench.exerciseId), 100, [8, 8]), { repCeilings: { upper: -1 } })).toThrow();
  });
});

describe("the rest of the default rule is ACSM 2009 and nothing else", () => {
  it("2-10% step: the smallest real step inside the band", () => {
    const p = P(bench, run(lineOf(bench.exerciseId), 100, [10, 10]));
    expect(p.load).toBe(102.5);
    expect(p.inputs.policy.preset).toBe("acsm_2009");
    expect(p.inputs.gym).toMatchObject({ minJumpRatio: 0.02, maxJumpRatio: 0.1 });
  });
  it("lower body gets the same 2-10% band (no 5% minimum)", () => {
    const sq: ExerciseSpec = { exerciseId: "Squat (Barbell)", equipment: "barbell", setup: "free", repRange: { min: 6, max: 12 } };
    expect(P(sq, run(lineOf(sq.exerciseId), 100, [12, 12])).load).toBe(102.5);
  });
  it("no stall deload: four flat sessions below the ceiling just keep asking for the next rep", () => {
    const p = P(bench, run(lineOf(bench.exerciseId), 100, [8, 8, 8, 8]));
    expect(p.reason.key).toBe("reps_in_range");
    expect(p.load).toBe(100);
  });
  it("no step-down: three misses below the range rebuild reps at the same load", () => {
    const p = P(bench, run(lineOf(bench.exerciseId), 100, [4, 4, 4]));
    expect(p.reason.key).toBe("reps_rebuild");
    expect(p.load).toBe(100);
  });
  it("no RIR fast track: a ceiling session with lots in reserve is the trigger anyway, and nothing earlier is", () => {
    const l = lineOf(bench.exerciseId);
    const h = [session(l, "2026-09-27", [S(100, 8, { rir: 4 }), S(100, 8, { rir: 4 }), S(100, 8, { rir: 4 })]), session(l, "2026-09-30", [S(100, 9, { rir: 4 }), S(100, 9, { rir: 4 }), S(100, 9, { rir: 4 })])];
    const p = P({ ...bench, trackEffort: true }, h);
    expect(p.load).toBe(100);
    expect(p.inputs.readiness.fastTracked).toBe(false);
  });
});
