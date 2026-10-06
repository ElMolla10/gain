import { describe, expect, it } from "vitest";
import { proposeNext } from "./progression";
import { renderReason } from "./reasons";
import { acceptSetTargets, applyHeadlineLoad, applySlotLoad, buildSetTargets, emptyBackoffStart, parseSetTargets, progressionAnchor, ROLE_BACKOFF_TAG, ROLE_TOP_TAG, selectJudgedSets, SLOT_TAG_PREFIX, tagsForLoggedSet, workingLoadsBySlot } from "./setTargets";
import { findSpec } from "./loads";
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
  it("a scheme with no slot or role tag judges nothing", () => {
    expect(selectJudgedSets(sets, 1, 3)).toEqual([]);
    expect(selectJudgedSets(sets, 2, 3)).toEqual([]);
  });
  it("role tags win over position, and a lighter tagged top set is not dropped", () => {
    const tagged = [S(70, 8, { tags: [ROLE_TOP_TAG] }), S(100, 10, { tags: [ROLE_BACKOFF_TAG] }), S(90, 10, { tags: [ROLE_TOP_TAG] })];
    expect(selectJudgedSets(tagged, 1, 3).map((s) => s.load)).toEqual([70, 90]);
  });
  it("role or slot tags that name no top set do not fall back onto a back-off", () => {
    const onlyBack = [S(60, 8, { tags: [ROLE_BACKOFF_TAG] }), S(100, 8)];
    expect(selectJudgedSets(onlyBack, 1, 2)).toEqual([]);
    const slotted = [S(110, 8, { tags: [`${SLOT_TAG_PREFIX}2`, ROLE_BACKOFF_TAG] })];
    expect(selectJudgedSets(slotted, 1, 3)).toEqual([]);
    const kept = [S(100, 8, { tags: [`${SLOT_TAG_PREFIX}1`, ROLE_TOP_TAG] }), S(110, 8, { tags: [`${SLOT_TAG_PREFIX}2`, ROLE_BACKOFF_TAG] })];
    expect(selectJudgedSets(kept, 1, 3).map((s) => s.load)).toEqual([100]);
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
  it("a missing slot stays empty instead of copying another set", () => {
    const t = buildSetTargets({
      plannedSets: 3,
      topSets: 1,
      top: { load: 100, reps: 8 },
      lastWorking: [{ load: 100, reps: 8 }, null, { load: 70, reps: 12 }],
    });
    expect(t?.[1]).toMatchObject({ role: "backoff", load: null, reps: null });
    expect(t?.[2]).toMatchObject({ role: "backoff", load: 70, reps: 12 });
  });
  it("working loads line up by slot, with a hole where a set is missing", () => {
    expect(
      workingLoadsBySlot([
        { load: 80, reps: 12, tags: [`${SLOT_TAG_PREFIX}3`, ROLE_BACKOFF_TAG] },
        { load: 100, reps: 8, tags: [`${SLOT_TAG_PREFIX}1`, ROLE_TOP_TAG] },
        { load: 40, reps: 5, warmup: true, tags: ["slot:9"] },
      ]),
    ).toEqual([{ load: 100, reps: 8 }, null, { load: 80, reps: 12 }]);
    expect(workingLoadsBySlot([{ load: 90, reps: 8 }, { load: 70, reps: 12, tags: ["drop"] }])).toEqual([{ load: 90, reps: 8 }]);
  });
  it("a logged slot stays put, and a role with no slot is not given a new index", () => {
    expect(tagsForLoggedSet({ tags: [`${SLOT_TAG_PREFIX}2`, ROLE_BACKOFF_TAG], warmup: false, topSets: 1, plannedSets: 4, slot: 1 })).toEqual([`${SLOT_TAG_PREFIX}2`, ROLE_BACKOFF_TAG]);
    expect(tagsForLoggedSet({ tags: [ROLE_BACKOFF_TAG, "failure"], warmup: false, topSets: 1, plannedSets: 4, slot: 1 })).toEqual(["failure", ROLE_BACKOFF_TAG]);
    expect(tagsForLoggedSet({ tags: ["failure"], warmup: false, topSets: 1, plannedSets: 4, slot: 2 })).toEqual(["failure", `${SLOT_TAG_PREFIX}2`, ROLE_BACKOFF_TAG]);
    expect(tagsForLoggedSet({ tags: [`${SLOT_TAG_PREFIX}1`, ROLE_TOP_TAG], warmup: true, topSets: 1, plannedSets: 4, slot: 1 })).toEqual([]);
    expect(tagsForLoggedSet({ tags: ["failure"], warmup: false, topSets: null, plannedSets: 4, slot: 1 })).toEqual(["failure"]);
  });
  it("an empty back-off editor starts one step under the headline, not on it", () => {
    const spec = findSpec(gymA, "barbell");
    expect(emptyBackoffStart(100, spec, false)).toBe(97.5);
    expect(emptyBackoffStart(20, spec, false)).toBe(20);
  });
  it("the jump anchor ignores a heavier back-off and is null when the top set is missing", () => {
    const sets = [S(100, 8, { tags: [`${SLOT_TAG_PREFIX}1`, ROLE_TOP_TAG] }), S(140, 6, { tags: [`${SLOT_TAG_PREFIX}2`, ROLE_BACKOFF_TAG] })];
    expect(progressionAnchor(sets, 1, 4)?.load).toBe(100);
    expect(progressionAnchor([S(140, 6, { tags: [ROLE_BACKOFF_TAG] })], 1, 4)).toBeNull();
    expect(progressionAnchor([S(80, 12), S(100, 8)], 1, 4)).toBeNull();
    expect(progressionAnchor([S(80, 8), S(140, 6)], null, 2)?.load).toBe(140);
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
  it("an unmarked session, heavy set logged last, is not presented as a top and does not earn a jump", () => {
    const h = [session(line, day(28), [S(80, 10), S(80, 12), S(100, 8), S(100, 8)])];
    const p = P(h, { topSets: 1 });
    expect(p.load).toBeNull();
    expect(p.reps).toBeNull();
    expect(p.currency).toBe("none");
    expect(p.confidence).toBe("low");
    expect(p.reason.key).toBe("ambiguous_top");
    expect(p.inputs.sessions).toEqual([]);
    expect(renderReason(p.reason, "en")).toMatch(/Set the weight yourself/);
    expect(renderReason(p.reason, "ar")).toMatch(/[\u0600-\u06FF]/);
  });
  it("the same session with no scheme still anchors on the heaviest set", () => {
    const h = [session(line, day(28), [S(80, 10), S(100, 8)])];
    const p = proposeNext({ exercise: exBar({ plannedSets: 2 }), gym: gymA, asOf: ASOF, history: h });
    expect(p.inputs.sessions[0]!.topLoad).toBe(100);
    expect(p.load).toBe(100);
  });
  it("repeated unmarked sessions logged light first and heavy last do not earn more load", () => {
    const one = (d: number) => session(line, day(d), [S(80, 12), S(100, 10), S(80, 12), S(80, 12)]);
    const p = P([one(20), one(24), one(28)], { topSets: 1 });
    expect(p.currency).not.toBe("load");
    expect(p.load).toBeNull();
    expect(p.confidence).toBe("low");
    expect(p.reason.key).toBe("ambiguous_top");
    expect(p.inputs.sessions).toEqual([]);
  });
  it("the same order with a stored slot on the heavy set is the top and can earn more load", () => {
    const one = (d: number) => session(line, day(d), [
      S(80, 12, { tags: [`${SLOT_TAG_PREFIX}2`, ROLE_BACKOFF_TAG] }),
      S(100, 10, { tags: [`${SLOT_TAG_PREFIX}1`, ROLE_TOP_TAG] }),
      S(80, 12, { tags: [`${SLOT_TAG_PREFIX}3`, ROLE_BACKOFF_TAG] }),
      S(80, 12, { tags: [`${SLOT_TAG_PREFIX}4`, ROLE_BACKOFF_TAG] }),
    ]);
    const p = P([one(24), one(28)], { topSets: 1 });
    expect(p.inputs.sessions[0]!.topLoad).toBe(100);
    expect(p.currency).toBe("load");
    expect(p.load).toBeGreaterThan(100);
  });
  it("a newer unmarked session does not let an older tagged top earn a jump", () => {
    const older = session(line, day(20), [S(100, 10, { tags: [ROLE_TOP_TAG, `${SLOT_TAG_PREFIX}1`] }), S(80, 12, { tags: [ROLE_BACKOFF_TAG, `${SLOT_TAG_PREFIX}2`] })]);
    const newer = session(line, day(28), [S(80, 12), S(140, 8)]);
    const p = P([older, newer], { plannedSets: 2, topSets: 1 });
    expect(p.load).toBeNull();
    expect(p.currency).not.toBe("load");
    expect(p.reason.key).toBe("ambiguous_top");
    expect(p.inputs.sessions).toEqual([]);
  });
  it("a newer tagged top ignores an older unmarked heavier session", () => {
    const older = session(line, day(20), [S(140, 8), S(80, 12)]);
    const tagged = (d: number) => session(line, day(d), [S(100, 10, { tags: [`${SLOT_TAG_PREFIX}1`, ROLE_TOP_TAG] }), S(80, 12, { tags: [`${SLOT_TAG_PREFIX}2`, ROLE_BACKOFF_TAG] })]);
    const p = P([older, tagged(24), tagged(28)], { plannedSets: 2, topSets: 1 });
    expect(p.inputs.sessions.map((s) => s.topLoad)).toEqual([100, 100]);
    expect(p.currency).toBe("load");
    expect(p.load).toBeGreaterThan(100);
  });
  it("a lighter tagged top set is still judged, so one heavy set is not enough when two top sets are prescribed", () => {
    const one = (d: number) => session(line, day(d), [
      S(100, 10, { tags: [`${SLOT_TAG_PREFIX}1`, ROLE_TOP_TAG] }),
      S(80, 12, { tags: [`${SLOT_TAG_PREFIX}2`, ROLE_TOP_TAG] }),
      S(110, 8, { tags: [`${SLOT_TAG_PREFIX}3`, ROLE_BACKOFF_TAG] }),
      S(80, 12, { tags: [`${SLOT_TAG_PREFIX}4`, ROLE_BACKOFF_TAG] }),
    ]);
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
  it("different loads and reps inside the tagged top slots stay inside the group, and a heavier later set does not", () => {
    const mixed = [session(line, day(28), [
      S(100, 8, { tags: [`${SLOT_TAG_PREFIX}1`, ROLE_TOP_TAG] }),
      S(90, 12, { tags: [`${SLOT_TAG_PREFIX}2`, ROLE_TOP_TAG] }),
      S(110, 10, { tags: [`${SLOT_TAG_PREFIX}3`, ROLE_BACKOFF_TAG] }),
    ])];
    const p = P(mixed, { plannedSets: 3, topSets: 2 });
    expect(p.inputs.sessions[0]!.topLoad).toBe(100);
    expect(p.inputs.sessions[0]!.setsAtTop).toBe(1);
    expect(p.inputs.sessions[0]!.repsAtTop).toBe(8);
    const reps = [session(line, day(28), [
      S(100, 10, { tags: [`${SLOT_TAG_PREFIX}1`, ROLE_TOP_TAG] }),
      S(100, 6, { tags: [`${SLOT_TAG_PREFIX}2`, ROLE_TOP_TAG] }),
      S(70, 12, { tags: [`${SLOT_TAG_PREFIX}3`, ROLE_BACKOFF_TAG] }),
    ])];
    const q = P(reps, { plannedSets: 3, topSets: 2 });
    expect(q.inputs.sessions[0]!.topLoad).toBe(100);
    expect(q.inputs.sessions[0]!.repsAtTop).toBe(6);
    expect(q.inputs.sessions[0]!.setsAtTop).toBe(2);
  });
  it("a session with only back-offs repeats the previous top load and does not jump", () => {
    const older = session(line, day(20), [S(100, 10, { tags: [ROLE_TOP_TAG] }), S(80, 12, { tags: [ROLE_BACKOFF_TAG] })]);
    const newer = session(line, day(28), [S(110, 8, { tags: [ROLE_BACKOFF_TAG] })]);
    const p = P([older, newer], { plannedSets: 2, topSets: 1 });
    expect(p.inputs.sessions[0]!.topLoad).toBe(100);
    expect(p.inputs.sessions[0]!.setsAtTop).toBe(0);
    expect(p.load).toBe(100);
    expect(p.currency).not.toBe("load");
  });
  it("a first session that is only back-offs does not invent that load", () => {
    const p = P([session(line, day(28), [S(110, 8, { tags: [ROLE_BACKOFF_TAG] })])], { plannedSets: 2, topSets: 1 });
    expect(p.status).toBe("no_history");
    expect(p.load).toBeNull();
  });
});
