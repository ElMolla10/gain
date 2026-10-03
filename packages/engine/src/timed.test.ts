import { describe, expect, it } from "vitest";
import { isTimedMeasure, proposeForMeasure, proposeTimed, quantityOf, timedStep, MAX_SECONDS, type TimedContext } from "./timed";
import { proposeNext } from "./progression";
import { renderReason } from "./reasons";
import { emptyRejectionMemory, recordRejection } from "./rejection";
import { lineKey } from "./line";
import type { ExerciseSpec, HistorySession, LoggedSet, RejectionMemory } from "./types";
import { ASOF, gymA, lineOf, session } from "./testkit";

const plank: ExerciseSpec & { measure: "time" } = { exerciseId: "plank", equipment: "plate", setup: "bodyweight_plus_added", repRange: { min: 30, max: 60 }, measure: "time" };
const walk: ExerciseSpec & { measure: "distance" } = { exerciseId: "walk", equipment: "dumbbell", setup: "free", repRange: { min: 20, max: 40 }, measure: "distance" };
const hang = lineOf("plank", "bodyweight_plus_added");
const walkLine = lineOf("walk", "free");

/** n identical timed sets of `secs` seconds at `load`. */
const hold = (load: number, secs: number, n = 3): LoggedSet[] => Array.from({ length: n }, () => ({ load, reps: 1, durationS: secs }));
const carry = (load: number, m: number, n = 3): LoggedSet[] => Array.from({ length: n }, () => ({ load, reps: 1, distanceM: m }));
const days = (n: number) => new Date(Date.parse("2026-09-30") - n * 3 * 86_400_000).toISOString().slice(0, 10);
const runT = (line: ReturnType<typeof lineOf>, mk: (q: number) => LoggedSet[], qs: number[]): HistorySession[] => qs.map((q, i) => session(line, days(qs.length - 1 - i), mk(q)));
const P = (c: Partial<TimedContext> & Pick<TimedContext, "history">) => proposeTimed({ exercise: plank, gym: gymA, asOf: ASOF, ...c });

describe("step size", () => {
  it("is about 10%, at least 5, in fives", () => {
    expect(timedStep(20)).toBe(5);
    expect(timedStep(30)).toBe(5);
    expect(timedStep(60)).toBe(5);
    expect(timedStep(90)).toBe(10);
    expect(timedStep(120)).toBe(10);
    expect(timedStep(200)).toBe(20);
  });
});

describe("time holds", () => {
  it("no history: nothing is proposed and it says so", () => {
    const p = P({ history: [] });
    expect(p.status).toBe("no_history");
    expect(p.durationS).toBeNull();
    expect(p.currency).toBe("none");
    expect(p.ruleVersion).toBe("timed-v0.1");
  });
  it("one session is a low-confidence repeat, never a jump", () => {
    const p = P({ history: runT(hang, (q) => hold(0, q), [40]) });
    expect(p.confidence).toBe("low");
    expect(p.durationS).toBe(40);
    expect(p.reps).toBeNull();
    expect(p.jumpKind).toBe("repeat");
    expect(p.load).toBe(0);
  });
  it("below the top: a little longer, capped at the top of the range", () => {
    const p = P({ history: runT(hang, (q) => hold(0, q), [40, 45]) });
    expect(p.durationS).toBe(50);
    expect(p.reason.key).toBe("timed_longer");
    expect(renderReason(p.reason)).toBe("Stay at 0 kg, aim for 50 s. Last time your weakest set was 45 s; a little longer each time.");
    const p2 = P({ history: runT(hang, (q) => hold(0, q), [50, 58]) });
    expect(p2.durationS).toBe(60);
  });
  it("uses the weakest working set of the session", () => {
    const h = [session(hang, days(1), [{ load: 0, reps: 1, durationS: 50 }, { load: 0, reps: 1, durationS: 35 }, { load: 0, reps: 1, durationS: 45 }]), session(hang, days(0), hold(0, 40))];
    expect(P({ history: h }).inputs.sessions[0]!.repsAtTop).toBe(40);
    expect(P({ history: [h[0]!, session(hang, days(0), [{ load: 0, reps: 1, durationS: 50 }, { load: 0, reps: 1, durationS: 36 }])] }).durationS).toBe(40);
  });
  it("below the range: rebuild to the bottom", () => {
    const p = P({ history: runT(hang, (q) => hold(0, q), [25, 20]) });
    expect(p.durationS).toBe(30);
    expect(p.reason.key).toBe("timed_rebuild");
  });
  it("at the top once: repeat; twice: the load goes up one real step and the target restarts at the bottom", () => {
    const once = P({ history: runT(hang, (q) => hold(0, q), [50, 60]) });
    expect(once.reason.key).toBe("timed_confirm");
    expect(once.durationS).toBe(60);
    expect(once.load).toBe(0);
    const twice = P({ history: runT(hang, (q) => hold(0, q), [55, 60, 60]) });
    expect(twice.reason.key).toBe("timed_load_up");
    expect(twice.currency).toBe("load");
    expect(twice.load).toBe(2.5);
    expect(twice.durationS).toBe(30);
    expect(twice.jumpKind).toBe("load:harder:2.5");
    expect(renderReason(twice.reason)).toMatch(/^Go up to 2.5 kg and aim for 30 s\. You reached 60 s at 0 kg\.$/);
  });
  it("a declined load jump (3 times) is not proposed again; the hold says so", () => {
    let m: RejectionMemory = emptyRejectionMemory();
    for (let i = 0; i < 3; i++) m = recordRejection(m, lineKey(hang), "load:harder:2.5", "2026-09-20");
    const p = P({ history: runT(hang, (q) => hold(0, q), [60, 60, 60]), rejections: m });
    expect(p.reason.key).toBe("timed_hold_declined");
    expect(p.durationS).toBe(60);
    expect(p.load).toBe(0);
  });
  it("no heavier load on the rack: stay at the top and say so", () => {
    const noPlates = { gymId: "gymA", loads: [{ equipment: "dumbbell" as const, loads: [10, 12.5] }] };
    const p = P({ gym: noPlates, history: runT(hang, (q) => hold(0, q), [60, 60, 60]) });
    expect(p.reason.key).toBe("timed_hold_top");
    expect(p.durationS).toBe(60);
  });
  it("warm-ups, drop sets and rejected sets never count; other gyms and setups are not compared", () => {
    const noisy: LoggedSet[] = [...hold(0, 40, 2), { load: 0, reps: 1, durationS: 300, warmup: true }, { load: 0, reps: 1, durationS: 300, tags: ["drop"] }, { load: 0, reps: 1, durationS: 300, outlierStatus: "rejected" }];
    const other = session(lineOf("plank", "bodyweight_plus_added", "gymB"), days(0), hold(0, 55));
    const p = P({ history: [session(hang, days(1), noisy), session(hang, days(0), hold(0, 40)), other] });
    expect(p.inputs.sessions.map((s) => s.repsAtTop)).toEqual([40, 40]);
    expect(p.inputs.excluded).toMatchObject({ warmupSets: 1, dropSets: 1, unconfirmedOutlierSets: 1, incomparableSessions: 1 });
    expect(p.durationS).toBe(45);
  });
  it("sets that carry reps but no duration are ignored (a time line holds seconds only)", () => {
    const p = P({ history: [session(hang, days(0), [{ load: 0, reps: 12 }])] });
    expect(p.status).toBe("no_history");
  });
  it("stale history lowers confidence", () => {
    const p = P({ asOf: "2026-12-30", history: runT(hang, (q) => hold(0, q), [40, 45, 50]) });
    expect(p.confidence).toBe("medium");
    expect(p.inputs.confidenceFactors.some((f) => f.startsWith("stale:"))).toBe(true);
  });
  it("never proposes more than an hour", () => {
    const long: ExerciseSpec & { measure: "time" } = { ...plank, repRange: { min: 30, max: 7200 } };
    const p = proposeTimed({ exercise: long, gym: gymA, asOf: ASOF, history: runT(hang, (q) => hold(0, q), [3590, 3598]) });
    expect(p.durationS).toBeLessThanOrEqual(MAX_SECONDS);
  });
  it("the stored inputs say what was measured", () => {
    const p = P({ history: runT(hang, (q) => hold(0, q), [40, 45]) });
    expect(p.inputs.measure).toBe("time");
    expect(p.inputs.repRange).toEqual({ min: 30, max: 60 });
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
});

describe("distance carries", () => {
  const W = (c: Partial<TimedContext> & Pick<TimedContext, "history">) => proposeTimed({ exercise: walk, gym: gymA, asOf: ASOF, ...c });
  it("adds metres below the top, then adds load from the rack after two sessions at the top", () => {
    const a = W({ history: runT(walkLine, (q) => carry(30, q), [20, 25]) });
    expect(a.distanceM).toBe(30);
    expect(a.durationS).toBeNull();
    expect(a.load).toBe(30);
    expect(renderReason(a.reason)).toContain("30 m");
    const b = W({ history: runT(walkLine, (q) => carry(30, q), [35, 40, 40]) });
    expect(b.reason.key).toBe("timed_load_up");
    expect(b.load).toBe(32.5);
    expect(b.distanceM).toBe(20);
  });
  it("Arabic text renders", () => {
    const a = W({ history: runT(walkLine, (q) => carry(30, q), [20, 25]) });
    expect(renderReason(a.reason, "ar")).toContain("30 م");
  });
});

describe("dispatch", () => {
  it("reps exercises still go through rule-v0.3 untouched", () => {
    const ex: ExerciseSpec = { exerciseId: "bench", equipment: "barbell", setup: "free", repRange: { min: 6, max: 10 } };
    const h = [session(lineOf("bench"), "2026-09-29", [{ load: 60, reps: 8 }, { load: 60, reps: 8 }]), session(lineOf("bench"), "2026-09-26", [{ load: 60, reps: 7 }])];
    expect(proposeForMeasure({ exercise: ex, gym: gymA, asOf: ASOF, history: h })).toEqual(proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: h }));
    expect(proposeForMeasure({ exercise: { ...ex, measure: "reps" }, gym: gymA, asOf: ASOF, history: h }).ruleVersion).toBe("rule-v0.3");
  });
  it("time and distance go to the timed rule", () => {
    expect(proposeForMeasure({ exercise: plank, gym: gymA, asOf: ASOF, history: [] }).ruleVersion).toBe("timed-v0.1");
    expect(isTimedMeasure("time") && isTimedMeasure("distance") && !isTimedMeasure("reps") && !isTimedMeasure(undefined)).toBe(true);
  });
  it("quantityOf", () => {
    expect(quantityOf({ load: 0, reps: 1, durationS: 45 }, "time")).toBe(45);
    expect(quantityOf({ load: 0, reps: 1, durationS: 45 }, "distance")).toBeNull();
    expect(quantityOf({ load: 0, reps: 1, durationS: 0 }, "time")).toBeNull();
  });
});
