import { describe, expect, it } from "vitest";
import { proposeNext, type ProposeContext } from "./progression";
import { renderReason } from "./reasons";
import { RULE_VERSION } from "./version";
import { ASOF, exBar, exDb, gymA, lineOf, run, S, session } from "./testkit";
import type { ExerciseSpec, ReasonKey } from "./types";

/**
 * The OPT-IN conventions (preset "coaching_conventions"): 2 sessions at the top, RIR fast track, region step bands, stall deload,
 * step-down after 3 misses. None of these is the default any more (the default is ACSM 2009, see policy.test.ts / ceilings.test.ts).
 */
const conv = (over: Partial<ExerciseSpec>): Partial<ExerciseSpec> => ({ ...over, progression: { preset: "coaching_conventions", ...over.progression } });
const cBar = (over: Partial<ExerciseSpec> = {}) => exBar(conv(over));
const cDb = (over: Partial<ExerciseSpec> = {}) => exDb(conv(over));

const barLine = lineOf("bench");
const dbLine = lineOf("db-press");
const B = (c: Partial<ProposeContext> & Pick<ProposeContext, "history">) => proposeNext({ exercise: cBar(), gym: gymA, asOf: ASOF, ...c });
const D = (c: Partial<ProposeContext> & Pick<ProposeContext, "history">) => proposeNext({ exercise: cDb(), gym: gymA, asOf: ASOF, ...c });

describe("rule version", () => {
  it("is rule-v0.4", () => {
    expect(RULE_VERSION).toBe("rule-v0.4");
    expect(B({ history: run(barLine, 100, [10, 10]) }).ruleVersion).toBe("rule-v0.4");
  });
});

describe("trigger: how much evidence before load goes up", () => {
  it("coaching_conventions needs two consecutive sessions at the top of the range", () => {
    const one = B({ history: run(barLine, 100, [8, 9, 10]) });
    expect(one.currency).toBe("reps");
    expect(one.reason.key).toBe("confirm_top_of_range");
    expect(one.load).toBe(100);
    expect(one.reps).toBe(10);
    expect(one.inputs.readiness).toMatchObject({ qualifyingSessions: 1, requiredSessions: 2, fastTracked: false });
    const two = B({ history: run(barLine, 100, [9, 10, 10]) });
    expect(two.currency).toBe("load");
    expect(two.load).toBe(102.5);
    expect(two.reps).toBe(6);
  });
  it("sessions must be consecutive: top, miss, top is one", () => {
    const p = B({ history: run(barLine, 100, [10, 8, 10]) });
    expect(p.reason.key).toBe("confirm_top_of_range");
    expect(p.inputs.readiness.qualifyingSessions).toBe(1);
  });
  it("sessions at a different load do not count toward the streak", () => {
    const h = [session(barLine, "2026-09-26", [S(97.5, 10), S(97.5, 10), S(97.5, 10)]), ...run(barLine, 100, [9, 10])];
    expect(B({ history: h }).inputs.readiness.qualifyingSessions).toBe(1);
  });
  it("double_progression preset: the first session at the top is enough", () => {
    const p = proposeNext({ exercise: cBar({ progression: { preset: "double_progression" } }), gym: gymA, asOf: ASOF, history: run(barLine, 100, [8, 9, 10]) });
    expect(p.currency).toBe("load");
    expect(p.load).toBe(102.5);
  });
  it("acsm_2009_strict (the literal ACSM wording) needs 1+ reps OVER the top, twice", () => {
    const ex = cBar({ progression: { preset: "acsm_2009_strict" } });
    const at = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(barLine, 100, [10, 10, 10]) });
    expect(at.reason.key).toBe("confirm_top_of_range");
    expect(at.reps).toBe(11);
    const over = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(barLine, 100, [10, 11, 12]) });
    expect(over.currency).toBe("load");
  });
  it("2-for-2 preset reads the LAST set only", () => {
    const ex = cBar({ progression: { preset: "two_for_two" } });
    const sess = (d: string) => session(barLine, d, [S(100, 8), S(100, 8), S(100, 12)]);
    const p = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: [sess("2026-09-26"), sess("2026-09-29")] });
    expect(p.inputs.readiness).toMatchObject({ targetReps: 12, qualifyingSessions: 2 });
    expect(p.currency).toBe("load");
    // the same sessions under the default all-sets basis do not qualify
    const d = B({ history: [sess("2026-09-26"), sess("2026-09-29")] });
    expect(d.inputs.readiness.qualifyingSessions).toBe(0);
  });
});

describe("RIR autoregulation (fast track), opt-in", () => {
  const withRir = (rir: number) => [
    session(barLine, "2026-09-26", [S(100, 9), S(100, 9), S(100, 9)]),
    session(barLine, "2026-09-29", [S(100, 10, { rir }), S(100, 10, { rir }), S(100, 10, { rir })]),
  ];
  it("reps at the top with 3+ in reserve earn the load after one session when effort is tracked", () => {
    const p = proposeNext({ exercise: cBar({ trackEffort: true }), gym: gymA, asOf: ASOF, history: withRir(3) });
    expect(p.inputs.readiness.fastTracked).toBe(true);
    expect(p.currency).toBe("load");
  });
  it("with only 1-2 in reserve it still waits for a second session (the lifter was close to the limit)", () => {
    const p = proposeNext({ exercise: cBar({ trackEffort: true }), gym: gymA, asOf: ASOF, history: withRir(1) });
    expect(p.inputs.readiness.fastTracked).toBe(false);
    expect(p.reason.key).not.toBe("load_up");
  });
  it("not tracked: logged RIR is ignored, no fast track", () => {
    const p = proposeNext({ exercise: cBar(), gym: gymA, asOf: ASOF, history: withRir(4) });
    expect(p.inputs.readiness.fastTracked).toBe(false);
  });
  it("fast track can be turned off", () => {
    const ex = cBar({ trackEffort: true, progression: { trigger: { fastTrackRir: null } } });
    expect(proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: withRir(4) }).inputs.readiness.fastTracked).toBe(false);
  });
  it("waiting at the top with room in reserve spends effort before anything else (currency order)", () => {
    const ex = cBar({ trackEffort: true, progression: { trigger: { fastTrackRir: null } } });
    const p = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: withRir(3) });
    expect(p.currency).toBe("effort");
    expect(p.targetRir).toBe(2);
  });
});

describe("increment band by body region, snapped to real loads", () => {
  it("upper body: 2.5 kg on 100 kg is 2.5%, inside 2-5%: take it", () => {
    const p = B({ history: run(barLine, 100, [10, 10]) });
    expect(p.load).toBe(102.5);
    expect(p.inputs.gym.jumpTooBig).toBe(false);
  });
  it("upper body: 2.5 kg on 150 kg is 1.7%, below 2%, so the next real step that fits (5 kg, 3.3%) is used", () => {
    const p = B({ history: run(barLine, 150, [10, 10]) });
    expect(p.load).toBe(155);
    expect(p.inputs.gym.jump).toBe(5);
  });
  it("lower body: 2.5 kg on 100 kg is below 5%, so 5 kg is used", () => {
    const p = proposeNext({ exercise: cBar({ bodyRegion: "lower" }), gym: gymA, asOf: ASOF, history: run(barLine, 100, [10, 10]) });
    expect(p.load).toBe(105);
  });
  it("lower body tolerates a bigger step than upper: 2.5 kg on 40 kg is 6.25%", () => {
    const up = B({ history: run(barLine, 40, [10, 10]) });
    expect(up.inputs.gym.jumpTooBig).toBe(true);
    expect(up.currency).toBe("quality");
    const lo = proposeNext({ exercise: cBar({ bodyRegion: "lower" }), gym: gymA, asOf: ASOF, history: run(barLine, 40, [10, 10]) });
    expect(lo.inputs.gym.jumpTooBig).toBe(false);
    expect(lo.load).toBe(42.5);
  });
  it("the band is configurable per lift", () => {
    const ex = cBar({ progression: { increment: { minPct: 0.01, maxPct: 0.07 } } });
    const p = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(barLine, 40, [10, 10]) });
    expect(p.load).toBe(42.5);
    expect(p.inputs.gym.maxJumpRatio).toBe(0.07);
  });
  it("every proposed load exists in the gym across regions and presets", () => {
    for (const bodyRegion of ["upper", "lower"] as const)
      for (const preset of ["double_progression", "acsm_2009", "acsm_2009_strict", "two_for_two", "coaching_conventions"] as const)
        for (const load of [30, 62.5, 100, 137.5]) {
          const p = proposeNext({ exercise: cBar({ bodyRegion, progression: { preset } }), gym: gymA, asOf: ASOF, history: run(barLine, load, [13, 13, 13]) });
          expect(p.load === null || ((p.load! - 20) / 2.5) % 1 === 0).toBe(true);
        }
  });
});

describe("per-lift rep range", () => {
  it("the same history is a different decision in a different range", () => {
    const h = run(dbLine, 30, [10, 10]);
    expect(D({ history: h }).reason.key).toBe("reps_in_range"); // 8-12: below the top
    const heavy = proposeNext({ exercise: cDb({ repRange: { min: 5, max: 8 } }), gym: gymA, asOf: ASOF, history: h });
    expect(heavy.inputs.readiness.qualifyingSessions).toBe(2); // 10 >= 8 twice
    expect(heavy.reps).not.toBe(11);
  });
});

describe("stall handling", () => {
  it("four sessions at one load with no rep gain: a lighter load, snapped to a real one", () => {
    const p = D({ history: run(dbLine, 30, [9, 9, 9, 9]) });
    expect(p.reason.key).toBe("stall_deload");
    expect(p.load).toBe(27.5); // 30 kg minus 10% = 27, nearest real dumbbell
    expect(p.currency).toBe("load");
    expect(p.reps).toBe(10);
    expect(p.inputs.readiness.stalled).toBe(true);
  });
  it("progress inside the window is not a stall", () => {
    expect(D({ history: run(dbLine, 30, [8, 9, 9, 10]) }).reason.key).not.toBe("stall_deload");
    expect(D({ history: run(dbLine, 30, [9, 9, 9]) }).reason.key).not.toBe("stall_deload");
  });
  it("a different load inside the window resets it", () => {
    const h = [session(dbLine, "2026-09-21", [S(32.5, 9), S(32.5, 9), S(32.5, 9)]), ...run(dbLine, 30, [9, 9, 9], "2026-09-30")];
    expect(D({ history: h }).reason.key).not.toBe("stall_deload");
  });
  it("can be switched off, window and size are configurable", () => {
    const off = proposeNext({ exercise: cDb({ progression: { stall: null } }), gym: gymA, asOf: ASOF, history: run(dbLine, 30, [9, 9, 9, 9]) });
    expect(off.reason.key).not.toBe("stall_deload");
    const wide = proposeNext({ exercise: cDb({ progression: { stall: { sessions: 3, deloadPct: 0.2 } } }), gym: gymA, asOf: ASOF, history: run(dbLine, 30, [9, 9, 9]) });
    expect(wide.reason.key).toBe("stall_deload");
    expect(wide.load).toBe(25);
  });
  it("with effort tracked the deload asks for room in reserve", () => {
    const p = proposeNext({ exercise: cDb({ trackEffort: true }), gym: gymA, asOf: ASOF, history: run(dbLine, 30, [9, 9, 9, 9]) });
    expect(p.targetRir).toBe(3);
  });
  it("a declined deload is not proposed again", () => {
    const key = D({ history: run(dbLine, 30, [9, 9, 9, 9]) }).inputs.lineKey;
    let m = { records: [] as { lineKey: string; jumpKind: string; count: number; lastRejectedAt: string }[] };
    m = { records: [{ lineKey: key, jumpKind: "load:easier:2.5", count: 3, lastRejectedAt: "2026-09-30" }] };
    expect(D({ history: run(dbLine, 30, [9, 9, 9, 9]), rejections: m }).reason.key).not.toBe("stall_deload");
  });
});

describe("step down needs more evidence", () => {
  it("configurable per lift", () => {
    const ex = cDb({ progression: { stepDownAfterMisses: 2 } });
    expect(proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(dbLine, 30, [10, 6, 6]) }).reason.key).toBe("step_down");
    expect(D({ history: run(dbLine, 30, [10, 6, 6]) }).reason.key).toBe("reps_rebuild");
  });
});

describe("new reasons render in both languages with no placeholders left over", () => {
  it("renders", () => {
    const keys: ReasonKey[] = ["stall_deload", "confirm_top_of_range", "step_down"];
    const params = { load: 27.5, unit: "kg", equipment: "dumbbell", lo: 8, hi: 12, lastReps: 9, reps: 10, prevLoad: 30, sessions: 4, pct: 10, have: 1, need: 2, extra: 0, misses: 3 };
    for (const key of keys)
      for (const loc of ["en", "ar"] as const) expect(renderReason({ key, params }, loc)).not.toMatch(/[{}]/);
  });
});
