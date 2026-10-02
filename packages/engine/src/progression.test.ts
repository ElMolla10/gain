import { describe, expect, it } from "vitest";
import { proposeNext, type ProposeContext } from "./progression";
import { renderReason } from "./reasons";
import { emptyRejectionMemory, recordAcceptance, recordRejection } from "./rejection";
import { lineKey } from "./line";
import type { HistorySession, RejectionMemory } from "./types";
import { ASOF, exBar, exDb, gymA, lineOf, run, S, session, sets } from "./testkit";

const dbLine = lineOf("db-press");
const barLine = lineOf("bench");
const P = (c: Partial<ProposeContext> & Pick<ProposeContext, "history">) =>
  proposeNext({ exercise: exDb(), gym: gymA, asOf: ASOF, ...c });
const rej = (line: string, kind: string, n: number): RejectionMemory => {
  let m = emptyRejectionMemory();
  for (let i = 0; i < n; i++) m = recordRejection(m, line, kind, "2026-09-20");
  return m;
};

describe("no data is said out loud", () => {
  it("no history: proposes nothing, says so", () => {
    const p = P({ history: [] });
    expect(p.status).toBe("no_history");
    expect(p.load).toBeNull();
    expect(p.reps).toBeNull();
    expect(p.currency).toBe("none");
    expect(p.confidence).toBe("none");
    expect(p.jumpKind).toBeNull();
    expect(renderReason(p.reason)).toMatch(/nothing is proposed/);
  });
  it("history only from another gym is not used, and says so", () => {
    const p = P({ history: run(lineOf("db-press", "free", "home"), 30, [10, 10, 10]) });
    expect(p.status).toBe("no_history");
    expect(p.warnings).toContain("only_incomparable_history");
    expect(p.inputs.excluded.incomparableSessions).toBe(3);
  });
  it("warm-ups alone are no history", () => {
    const h = [session(dbLine, "2026-09-30", sets(30, 10, 3, { warmup: true }))];
    expect(P({ history: h }).status).toBe("no_history");
  });
  it("a gym with no loads for this equipment proposes no weight", () => {
    const gym = { gymId: "gymA", loads: [{ equipment: "barbell" as const, increment: 2.5, min: 20 }] };
    const p = P({ gym, history: run(dbLine, 30, [10, 10, 10]) });
    expect(p.status).toBe("no_gym_loads");
    expect(p.load).toBeNull();
    expect(renderReason(p.reason)).toMatch(/no loads saved/);
  });
  it("an invalid rep range throws", () => {
    expect(() => P({ exercise: exDb({ repRange: { min: 12, max: 8 } }), history: [] })).toThrow();
    expect(() => P({ exercise: exDb({ repRange: { min: 0, max: 8 } }), history: [] })).toThrow();
  });
});

describe("low confidence gives a smaller suggestion", () => {
  it("one session: repeat, never a jump, even at the top of the range", () => {
    const p = P({ history: run(dbLine, 30, [12]) });
    expect(p.confidence).toBe("low");
    expect(p.load).toBe(30);
    expect(p.reps).toBe(12);
    expect(p.jumpKind).toBe("repeat");
    expect(p.reason.key).toBe("low_confidence_repeat");
  });
  it("one session below the top: repeat the same reps, do not add one", () => {
    expect(P({ history: run(dbLine, 30, [9]) }).reps).toBe(9);
  });
  it("one session below the range: aim for the bottom of the range", () => {
    expect(P({ history: run(dbLine, 30, [5]) }).reps).toBe(8);
  });
  it("low confidence sets the needsModel flag with reasons (no model is called)", () => {
    const p = P({ history: run(dbLine, 30, [10]) });
    expect(p.needsModel.needed).toBe(true);
    expect(p.needsModel.reasons).toEqual(expect.arrayContaining(["low_confidence", "single_session"]));
  });
  it("enough history does not set needsModel", () => {
    expect(P({ history: run(dbLine, 30, [10, 10, 10]) }).needsModel).toEqual({ needed: false, reasons: [] });
  });
  it("two sessions is medium, three is high", () => {
    expect(P({ history: run(dbLine, 30, [9, 10]) }).confidence).toBe("medium");
    expect(P({ history: run(dbLine, 30, [10, 10, 10]) }).confidence).toBe("high");
  });
  it("stale history lowers confidence one level", () => {
    const p = P({ history: run(dbLine, 30, [10, 10, 10], "2026-07-01") });
    expect(p.confidence).toBe("medium");
    expect(p.inputs.confidenceFactors.some((f) => f.startsWith("stale"))).toBe(true);
  });
  it("noisy recent sessions lower confidence", () => {
    const p = P({ history: run(dbLine, 30, [3, 12, 21]) });
    expect(p.confidence).toBe("medium");
    expect(p.inputs.confidenceFactors).toContain("high_variance");
  });
  it("stale single session stays low and flags stale", () => {
    const p = P({ history: run(dbLine, 30, [10], "2026-05-01") });
    expect(p.confidence).toBe("low");
    expect(p.needsModel.reasons).toContain("stale_history");
  });
});

describe("currency 1: reps inside the range", () => {
  it("one more rep, and the next real dumbbell is named", () => {
    const p = P({ history: run(dbLine, 30, [10, 10, 11]) });
    expect(p.currency).toBe("reps");
    expect(p.load).toBe(30);
    expect(p.reps).toBe(12);
    expect(renderReason(p.reason)).toBe("Stay at 30 kg, aim for 12, the next dumbbell is 32.5.");
  });
  it("uses the minimum reps across the sets at the top load (conservative)", () => {
    const h = [session(dbLine, "2026-09-28", sets(30, 9)), session(dbLine, "2026-09-30", [S(30, 12), S(30, 12), S(30, 10)])];
    expect(P({ history: h }).reps).toBe(11);
  });
  it("the anchor is the heaviest working load of the session", () => {
    const h = [session(dbLine, "2026-09-28", sets(27.5, 10)), session(dbLine, "2026-09-30", [S(27.5, 12), S(30, 9)])];
    const p = P({ history: h });
    expect(p.load).toBe(30);
    expect(p.reps).toBe(10);
  });
  it("below the range: rebuild to the bottom of the range", () => {
    const p = P({ history: run(dbLine, 30, [9, 9, 6]) });
    expect(p.reason.key).toBe("reps_rebuild");
    expect(p.load).toBe(30);
    expect(p.reps).toBe(8);
  });
  it("the last load with no heavier dumbbell: no next load is mentioned", () => {
    const h = [session(dbLine, "2026-09-26", sets(40, 9)), session(dbLine, "2026-09-28", sets(40, 9)), session(dbLine, "2026-09-30", sets(40, 10))];
    const p = P({ history: h });
    expect(renderReason(p.reason)).toBe("Stay at 40 kg, aim for 11.");
  });
});

describe("top of the range: effort, then quality, then load", () => {
  const top = run(dbLine, 30, [12, 12, 12]);
  it("a big jump (30 to 32.5) spends a quality change first", () => {
    const p = P({ history: top });
    expect(p.inputs.gym.jumpTooBig).toBe(true);
    expect(p.currency).toBe("quality");
    expect(p.quality).toBe("pause");
    expect(p.load).toBe(30);
    expect(p.reps).toBe(12);
    expect(renderReason(p.reason)).toContain("32.5");
  });
  it("effort comes before quality when effort is tracked", () => {
    const h = run(dbLine, 30, [12, 12], "2026-09-28").concat(session(dbLine, "2026-09-30", sets(30, 12, 3, { rir: 3 })));
    const p = P({ exercise: exDb({ trackEffort: true }), history: h });
    expect(p.currency).toBe("effort");
    expect(p.targetRir).toBe(2);
    expect(p.load).toBe(30);
  });
  it("effort is ignored when the lifter does not track it", () => {
    const h = [...run(dbLine, 30, [12, 12], "2026-09-28"), session(dbLine, "2026-09-30", sets(30, 12, 3, { rir: 3 }))];
    expect(P({ history: h }).currency).toBe("quality");
  });
  it("tracking effort but not logging it this time: skip effort", () => {
    expect(P({ exercise: exDb({ trackEffort: true }), history: top }).currency).toBe("quality");
  });
  it("effort stops at the floor (no forced failure)", () => {
    const h = [...run(dbLine, 30, [12, 12], "2026-09-28"), session(dbLine, "2026-09-30", sets(30, 12, 3, { rir: 1 }))];
    const p = P({ exercise: exDb({ trackEffort: true }), history: h });
    expect(p.currency).toBe("quality");
  });
  it("quality already spent at this load moves on to the next quality", () => {
    const h = [...run(dbLine, 30, [12, 12], "2026-09-28"), session(dbLine, "2026-09-30", sets(30, 12, 3, { tags: ["pause"] }))];
    expect(P({ history: h }).quality).toBe("slow_eccentric");
  });
  it("all qualities spent: only then the next real load", () => {
    const h = [
      session(dbLine, "2026-09-26", sets(30, 12, 3, { tags: ["pause"] })),
      session(dbLine, "2026-09-28", sets(30, 12, 3, { tags: ["slow_eccentric"] })),
      session(dbLine, "2026-09-30", sets(30, 12)),
    ];
    const p = P({ history: h });
    expect(p.currency).toBe("load");
    expect(p.load).toBe(32.5);
    expect(p.reps).toBe(8);
    expect(p.jumpKind).toBe("load:harder:2.5");
    expect(renderReason(p.reason)).toContain("Go up to 32.5 kg");
  });
  it("an extra set is only offered on a goal lift, and adds one planned set", () => {
    const h = [
      session(dbLine, "2026-09-26", sets(30, 12, 3, { tags: ["pause"] })),
      session(dbLine, "2026-09-28", sets(30, 12, 3, { tags: ["slow_eccentric"] })),
      session(dbLine, "2026-09-30", sets(30, 12)),
    ];
    const goal = P({ exercise: exDb({ isGoalLift: true, plannedSets: 3 }), history: h });
    expect(goal.quality).toBe("extra_set");
    expect(goal.sets).toBe(4);
    const nonGoal = P({ exercise: exDb({ qualityOptions: ["extra_set", "pause"] }), history: top });
    expect(nonGoal.quality).toBe("pause");
  });
  it("a small jump (barbell 100 to 102.5) goes straight to the real load", () => {
    const p = proposeNext({ exercise: exBar(), gym: gymA, asOf: ASOF, history: run(barLine, 100, [10, 10, 10]) });
    expect(p.inputs.gym.jumpTooBig).toBe(false);
    expect(p.currency).toBe("load");
    expect(p.load).toBe(102.5);
    expect(p.reps).toBe(6);
  });
  it("the same 2.5 kg jump at 40 kg is big (6.25%) and spends quality first", () => {
    const p = proposeNext({ exercise: exBar(), gym: gymA, asOf: ASOF, history: run(barLine, 40, [10, 10, 10]) });
    expect(p.inputs.gym.jumpTooBig).toBe(true);
    expect(p.currency).toBe("quality");
  });
  it("the big-jump threshold is configurable", () => {
    const p = proposeNext({ exercise: exBar(), gym: gymA, asOf: ASOF, history: run(barLine, 40, [10, 10, 10]), options: { maxJumpRatio: 0.07 } });
    expect(p.currency).toBe("load");
  });
  it("reps above the range count as the top", () => {
    expect(P({ history: run(dbLine, 30, [15, 15, 15]) }).currency).toBe("quality");
  });
  it("no heavier dumbbell and nothing else to spend: hold and say why", () => {
    const p = P({ exercise: exDb({ qualityOptions: [] }), history: run(dbLine, 40, [12, 12, 12]) });
    expect(p.reason.key).toBe("hold_no_heavier_load");
    expect(p.load).toBe(40);
    expect(p.reps).toBe(12);
  });
  it("top of a machine stack holds too", () => {
    const ex = { exerciseId: "press-m", equipment: "machine" as const, setup: "free" as const, repRange: { min: 8, max: 12 }, qualityOptions: [] };
    const p = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(lineOf("press-m"), 100, [12, 12, 12]) });
    expect(p.reason.key).toBe("hold_no_heavier_load");
    expect(p.load).toBe(100);
  });
});

describe("repeated misses", () => {
  it("two sessions below the range at the same load step the load down one real step", () => {
    const p = P({ history: run(dbLine, 30, [10, 6, 6]) });
    expect(p.reason.key).toBe("step_down");
    expect(p.load).toBe(27.5);
    expect(p.reps).toBe(8);
    expect(p.currency).toBe("load");
    expect(p.jumpKind).toBe("load:easier:2.5");
  });
  it("one miss alone is not a step down", () => {
    expect(P({ history: run(dbLine, 30, [10, 10, 6]) }).currency).toBe("reps");
  });
  it("misses at different loads are not counted together", () => {
    const h = [session(dbLine, "2026-09-26", sets(32.5, 10)), session(dbLine, "2026-09-28", sets(32.5, 6)), session(dbLine, "2026-09-30", sets(30, 6))];
    expect(P({ history: h }).reason.key).toBe("reps_rebuild");
  });
  it("at the lightest dumbbell there is nowhere to step down to", () => {
    const p = P({ history: run(dbLine, 10, [6, 6, 6]) });
    expect(p.reason.key).toBe("reps_rebuild");
    expect(p.load).toBe(10);
  });
});

describe("rejection memory in the proposal", () => {
  const history = run(barLine, 100, [10, 10, 10]);
  const key = lineKey(barLine);
  const kind = "load:harder:2.5";
  const B = (rejections: RejectionMemory, exercise = exBar()) =>
    proposeNext({ exercise, gym: gymA, asOf: ASOF, history, rejections });
  it("two rejections still propose the jump", () => expect(B(rej(key, kind, 2)).currency).toBe("load"));
  it("three rejections stop the jump and spend another currency", () => {
    const p = B(rej(key, kind, 3));
    expect(p.currency).not.toBe("load");
    expect(p.load).toBe(100);
    expect(p.currency).toBe("quality");
  });
  it("the inputs show the blocked kind", () => {
    const p = B(rej(key, kind, 3));
    expect(p.inputs.rejections).toEqual([{ jumpKind: kind, count: 3, blocked: true }]);
  });
  it("nothing else to spend: hold and say the jump was declined", () => {
    const p = B(rej(key, kind, 3), exBar({ qualityOptions: [] }));
    expect(p.reason.key).toBe("hold_jump_declined");
    expect(p.currency).toBe("reps");
    expect(p.load).toBe(100);
    expect(renderReason(p.reason)).toContain("declined");
  });
  it("a different jump size is a different kind and is not blocked", () => {
    expect(B(rej(key, "load:harder:1.25", 3)).currency).toBe("load");
  });
  it("another line's rejections do not apply", () => {
    expect(B(rej("other|gymA|free", kind, 3)).currency).toBe("load");
  });
  it("accepting later clears the block", () => {
    expect(B(recordAcceptance(rej(key, kind, 3), key, kind)).currency).toBe("load");
  });
  it("a big-jump line with the jump blocked after quality is exhausted still spends something else", () => {
    const h: HistorySession[] = [
      session(dbLine, "2026-09-26", sets(30, 12, 3, { tags: ["pause"] })),
      session(dbLine, "2026-09-28", sets(30, 12, 3, { tags: ["slow_eccentric"] })),
      session(dbLine, "2026-09-30", sets(30, 12)),
    ];
    const p = P({ history: h, rejections: rej(lineKey(dbLine), "load:harder:2.5", 3) });
    expect(p.currency).toBe("quality");
    expect(p.load).toBe(30);
  });
  it("a blocked effort target moves on to quality", () => {
    const h = [...run(dbLine, 30, [12, 12], "2026-09-28"), session(dbLine, "2026-09-30", sets(30, 12, 3, { rir: 3 }))];
    const p = P({ exercise: exDb({ trackEffort: true }), history: h, rejections: rej(lineKey(dbLine), "effort:rir2", 3) });
    expect(p.currency).toBe("quality");
  });
  it("a blocked quality kind moves on to the next one", () => {
    const p = P({ history: run(dbLine, 30, [12, 12, 12]), rejections: rej(lineKey(dbLine), "quality:pause", 3) });
    expect(p.quality).toBe("slow_eccentric");
  });
});

describe("what does not drive the target", () => {
  const base = run(dbLine, 30, [10, 10, 10]);
  const withNewest = (newest: HistorySession) => [...base, newest];
  it("an unconfirmed outlier does NOT move the next target, and lowers confidence", () => {
    const p = P({ history: withNewest(session(dbLine, "2026-10-01", sets(40, 10, 3, { outlierStatus: "unconfirmed" }))) });
    expect(p.load).toBe(30);
    expect(p.reps).toBe(11);
    expect(p.warnings).toContain("pending_outlier");
    expect(p.confidence).toBe("medium");
    expect(p.inputs.excluded.unconfirmedOutlierSets).toBe(3);
  });
  it("a rejected outlier is excluded too", () => {
    const p = P({ history: withNewest(session(dbLine, "2026-10-01", sets(40, 10, 3, { outlierStatus: "rejected" }))) });
    expect(p.load).toBe(30);
  });
  it("a confirmed outlier does count", () => {
    const p = P({ history: withNewest(session(dbLine, "2026-10-01", sets(40, 10, 3, { outlierStatus: "confirmed" }))) });
    expect(p.load).toBe(40);
  });
  it("drop sets are excluded", () => {
    const p = P({ history: [...base, session(dbLine, "2026-10-01", [...sets(30, 10), S(20, 25, { tags: ["drop"] })])] });
    expect(p.load).toBe(30);
    expect(p.reps).toBe(11);
    expect(p.inputs.excluded.dropSets).toBe(1);
  });
  it("warm-ups, even heavy ones, are excluded", () => {
    const p = P({ history: [...base, session(dbLine, "2026-10-01", [S(40, 3, { warmup: true }), ...sets(30, 10)])] });
    expect(p.load).toBe(30);
    expect(p.inputs.excluded.warmupSets).toBe(1);
  });
});

describe("gym-aware anchors", () => {
  it("a load that does not exist here (21 kg) is snapped to the lighter real load and flagged", () => {
    const p = P({ history: run(dbLine, 21, [10, 10, 10]) });
    expect(p.load).toBe(20);
    expect(p.warnings).toContain("anchor_off_gym_loads");
    expect(p.needsModel.reasons).toContain("anchor_off_gym_loads");
  });
  it("every proposed load exists in the gym across many starting points", () => {
    for (const load of [10, 12.5, 17.5, 22.5, 27.5, 35, 37.5]) {
      for (const reps of [8, 10, 12]) {
        const p = P({ history: run(dbLine, load, [reps, reps, reps]) });
        expect(DB.includes(p.load!)).toBe(true);
      }
    }
  });
  it("barbell proposals stay on the 2.5 kg grid", () => {
    for (const load of [42.5, 60, 87.5, 100, 140]) {
      const p = proposeNext({ exercise: exBar(), gym: gymA, asOf: ASOF, history: run(barLine, load, [10, 10, 10]) });
      expect((p.load! - 20) % 2.5).toBeCloseTo(0);
    }
  });
});
const DB = gymA.loads.find((l) => l.equipment === "dumbbell")!.loads!;

describe("assisted and bodyweight lines", () => {
  const aLine = lineOf("pullup", "assisted");
  const aEx = (over = {}) => ({ exerciseId: "pullup", equipment: "assisted" as const, setup: "assisted" as const, repRange: { min: 6, max: 10 }, ...over });
  it("an assisted line never uses free-weight history of the same exercise", () => {
    const p = proposeNext({ exercise: aEx(), gym: gymA, asOf: ASOF, history: run(lineOf("pullup", "free"), 20, [8, 8, 8]) });
    expect(p.status).toBe("no_history");
    expect(p.inputs.excluded.incomparableSessions).toBe(3);
  });
  it("a bodyweight+added line never uses assisted history", () => {
    const ex = { ...aEx(), setup: "bodyweight_plus_added" as const, equipment: "plate" as const };
    const p = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(aLine, 30, [8, 8, 8]) });
    expect(p.status).toBe("no_history");
  });
  it("a free-weight line never uses assisted history", () => {
    const p = proposeNext({ exercise: exBar({ exerciseId: "pullup" }), gym: gymA, asOf: ASOF, history: run(aLine, 30, [8, 8, 8]) });
    expect(p.status).toBe("no_history");
  });
  it("progress means LESS assistance: the next load is lower", () => {
    const p = proposeNext({ exercise: aEx({ qualityOptions: [] }), gym: gymA, asOf: ASOF, history: run(aLine, 30, [10, 10, 10]), bodyweightKg: 80 });
    expect(p.inputs.gym.nextHarderLoad).toBe(25);
    expect(p.load).toBe(25);
    expect(p.reps).toBe(6);
    expect(p.jumpKind).toBe("load:harder:5");
  });
  it("the hardest assisted set is the one with the least assistance", () => {
    const h = [session(aLine, "2026-09-28", sets(35, 8)), session(aLine, "2026-09-30", [S(35, 10), S(30, 8)])];
    const p = proposeNext({ exercise: aEx(), gym: gymA, asOf: ASOF, history: h });
    expect(p.inputs.gym.anchorLoad).toBe(30);
  });
  it("an assistance logged off the stack snaps to MORE assistance (the easier side)", () => {
    const p = proposeNext({ exercise: aEx(), gym: gymA, asOf: ASOF, history: run(aLine, 32, [8, 8, 8]) });
    expect(p.inputs.gym.anchorLoad).toBe(35);
  });
  it("zero assistance is the floor: says so instead of proposing a heavier load", () => {
    const p = proposeNext({ exercise: aEx({ qualityOptions: [] }), gym: gymA, asOf: ASOF, history: run(aLine, 0, [10, 10, 10]) });
    expect(p.reason.key).toBe("hold_assisted_floor");
    expect(p.load).toBe(0);
  });
  it("bodyweight added load: with bodyweight on file a 2.5 kg step is small", () => {
    const bLine = lineOf("dip", "bodyweight_plus_added");
    const ex = { exerciseId: "dip", equipment: "plate" as const, setup: "bodyweight_plus_added" as const, repRange: { min: 8, max: 12 } };
    const p = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(bLine, 0, [12, 12, 12]), bodyweightKg: 80 });
    expect(p.currency).toBe("load");
    expect(p.load).toBe(2.5);
  });
  it("bodyweight added load: without bodyweight it is never guessed, so it is cautious", () => {
    const bLine = lineOf("dip", "bodyweight_plus_added");
    const ex = { exerciseId: "dip", equipment: "plate" as const, setup: "bodyweight_plus_added" as const, repRange: { min: 8, max: 12 } };
    const p = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(bLine, 0, [12, 12, 12]) });
    expect(p.inputs.bodyweightKg).toBeNull();
    expect(p.currency).toBe("quality");
  });
});

describe("result shape", () => {
  it("carries rule version, inputs, reason key + params and is JSON-safe", () => {
    const p = P({ history: run(dbLine, 30, [10, 10, 11]) });
    expect(p.ruleVersion).toBe("rule-v0.1");
    expect(p.reason.key).toBe("reps_in_range");
    expect(p.reason.params).toMatchObject({ load: 30, reps: 12, nextLoad: 32.5, equipment: "dumbbell" });
    expect(p.inputs.sessions[0]).toMatchObject({ topLoad: 30, repsAtTop: 11 });
    expect(p.inputs.gym).toMatchObject({ anchorLoad: 30, nextHarderLoad: 32.5, jump: 2.5 });
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
  it("is deterministic and does not mutate its input", () => {
    const h = run(dbLine, 30, [10, 10, 11]);
    const copy = JSON.parse(JSON.stringify(h));
    const a = P({ history: h });
    const b = P({ history: h });
    expect(a).toEqual(b);
    expect(h).toEqual(copy);
  });
  it("renders in Arabic with readable numbers", () => {
    const p = P({ history: run(dbLine, 30, [10, 10, 11]) });
    const ar = renderReason(p.reason, "ar");
    expect(ar).toContain("30");
    expect(ar).toContain("12");
    expect(ar).toContain("32.5");
    expect(ar).toMatch(/[\u0600-\u06FF]/);
    expect(ar).not.toMatch(/\{/);
  });
});
