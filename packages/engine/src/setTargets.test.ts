import { describe, expect, it } from "vitest";
import { proposeNext } from "./progression";
import { acceptSetTargets, applyHeadlineLoad, applySlotLoad, buildSetTargets, parseSetTargets, ROLE_BACKOFF_TAG, ROLE_TOP_TAG, selectJudgedSets } from "./setTargets";
import { ASOF, exBar, gymA, lineOf, S, session } from "./testkit";

const line = lineOf("bench");
const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}T10:00:00Z`;
const P = (history: ReturnType<typeof session>[], over: { plannedSets?: number; topSets?: number } = {}) =>
  proposeNext({ exercise: exBar({ plannedSets: 4, ...over }), gym: gymA, asOf: ASOF, history });

describe("selectJudgedSets", () => {
  const sets = [S(80, 10), S(70, 12), S(100, 8)];
  it("straight sets keep every working set, so a later heavier set is still the top", () => {
    expect(selectJudgedSets(sets, undefined, 3)).toEqual(sets);
    expect(selectJudgedSets(sets, null, 3)).toEqual(sets);
    expect(selectJudgedSets(sets, 3, 3)).toEqual(sets);
  });
  it("a scheme with no role tags judges the first n sets, not the heaviest", () => {
    expect(selectJudgedSets(sets, 1, 3).map((s) => s.load)).toEqual([80]);
    expect(selectJudgedSets(sets, 2, 3).map((s) => s.load)).toEqual([80, 70]);
  });
  it("role tags win over position, and a lighter tagged top set is not dropped", () => {
    const tagged = [S(70, 8, { tags: [ROLE_TOP_TAG] }), S(100, 10, { tags: [ROLE_BACKOFF_TAG] }), S(90, 10, { tags: [ROLE_TOP_TAG] })];
    expect(selectJudgedSets(tagged, 1, 3).map((s) => s.load)).toEqual([70, 90]);
  });
  it("role tags that name no top set fall back to the first n", () => {
    const onlyBack = [S(60, 8, { tags: [ROLE_BACKOFF_TAG] }), S(100, 8)];
    expect(selectJudgedSets(onlyBack, 1, 2).map((s) => s.load)).toEqual([60]);
  });
});

describe("buildSetTargets", () => {
  it("is null for straight sets", () => {
    expect(buildSetTargets({ plannedSets: 3, topSets: null, top: { load: 100, reps: 8 }, lastWorking: [] })).toBeNull();
    expect(buildSetTargets({ plannedSets: 3, topSets: 3, top: { load: 100, reps: 8 }, lastWorking: [] })).toBeNull();
  });
  it("copies the proposal onto top slots and last session's set onto later slots, never the top load", () => {
    const t = buildSetTargets({
      plannedSets: 4,
      topSets: 1,
      top: { load: 100, reps: 8 },
      lastWorking: [
        { load: 100, reps: 8 },
        { load: 80, reps: 12 },
        { load: 80, reps: 11 },
      ],
    });
    expect(t).toEqual([
      { position: 1, role: "top", load: 100, reps: 8 },
      { position: 2, role: "backoff", load: 80, reps: 12 },
      { position: 3, role: "backoff", load: 80, reps: 11 },
      { position: 4, role: "backoff", load: null, reps: null },
    ]);
  });
  it("a headline edit moves every top slot and leaves back-offs; a back-off edit moves one slot", () => {
    const t = buildSetTargets({
      plannedSets: 4,
      topSets: 2,
      top: { load: 100, reps: 8 },
      lastWorking: [{ load: 100, reps: 8 }, { load: 100, reps: 8 }, { load: 80, reps: 12 }, { load: 70, reps: 12 }],
    })!;
    expect(applyHeadlineLoad(t, 102.5).filter((s) => s.role === "top").every((s) => s.load === 102.5)).toBe(true);
    expect(applyHeadlineLoad(t, 102.5).find((s) => s.position === 3)!.load).toBe(80);
    const one = applySlotLoad(t, 3, 75);
    expect(one.find((s) => s.position === 3)!.load).toBe(75);
    expect(one.find((s) => s.position === 1)!.load).toBe(100);
    expect(one.find((s) => s.position === 4)!.load).toBe(70);
    const accepted = acceptSetTargets(applyHeadlineLoad(one, 110), { load: 100, reps: 8 });
    expect(accepted.filter((s) => s.role === "top").every((s) => s.load === 100 && s.reps === 8)).toBe(true);
    expect(accepted.find((s) => s.position === 3)!.load).toBe(75);
  });
  it("parses stored JSON and refuses a bad shape", () => {
    const raw = JSON.stringify(buildSetTargets({ plannedSets: 2, topSets: 1, top: { load: 40, reps: 8 }, lastWorking: [] }));
    expect(parseSetTargets(raw)?.[0]).toMatchObject({ role: "top", load: 40 });
    expect(parseSetTargets(null)).toBeNull();
    expect(parseSetTargets("")).toBeNull();
    expect(parseSetTargets("[]")).toBeNull();
    expect(parseSetTargets("{")).toBeNull();
    expect(parseSetTargets(JSON.stringify([{ position: 1, role: "drop", load: 1, reps: 1 }]))).toBeNull();
  });
});

describe("progression uses position, not weight, once a top-set scheme is on", () => {
  it("a heavier set logged after the top-set slot is not the anchor", () => {
    const h = [session(line, day(28), [S(80, 10), S(80, 12), S(100, 8), S(100, 8)])];
    const p = P(h, { topSets: 1 });
    expect(p.inputs.sessions[0]!.topLoad).toBe(80);
    expect(p.load).toBe(80);
  });
  it("the same session with no scheme still anchors on the heaviest set", () => {
    const h = [session(line, day(28), [S(80, 10), S(100, 8)])];
    const p = proposeNext({ exercise: exBar({ plannedSets: 2 }), gym: gymA, asOf: ASOF, history: h });
    expect(p.inputs.sessions[0]!.topLoad).toBe(100);
    expect(p.load).toBe(100);
  });
  it("a lighter set inside the first n is still judged, so one heavy set is not enough when two top sets are prescribed", () => {
    const one = (d: number) => session(line, day(d), [S(100, 10), S(80, 12), S(110, 8), S(80, 12)]);
    const p = P([one(20), one(24), one(28)], { topSets: 2 });
    expect(p.inputs.sessions[0]!.topLoad).toBe(100);
    expect(p.inputs.sessions[0]!.setsAtTop).toBe(1);
    expect(p.currency).not.toBe("load");
    expect(p.reason.key).toBe("partial_session");
  });
  it("explicit role tags: a heavier back-off does not become the top, and a lighter tagged top set still counts", () => {
    const h = [
      session(line, day(28), [
        S(70, 10, { tags: [ROLE_TOP_TAG] }),
        S(120, 6, { tags: [ROLE_BACKOFF_TAG] }),
      ]),
    ];
    const p = P(h, { plannedSets: 2, topSets: 1 });
    expect(p.inputs.sessions[0]!.topLoad).toBe(70);
    expect(p.load).toBe(70);
  });
});
