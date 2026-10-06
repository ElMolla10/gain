import { describe, expect, it } from "vitest";
import { proposeNext } from "./progression";
import { renderReason } from "./reasons";
import { ROLE_BACKOFF_TAG, ROLE_TOP_TAG, SLOT_TAG_PREFIX } from "./setTargets";
import { ASOF, exBar, gymA, lineOf, S, session } from "./testkit";

const line = lineOf("bench");
const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}T10:00:00Z`;
const P = (history: ReturnType<typeof session>[], over = {}) => proposeNext({ exercise: exBar({ plannedSets: 3, ...over }), gym: gymA, asOf: ASOF, history });
// exBar: range 6-10, ceiling pinned to 10, one session at the ceiling is enough (default trigger is NOT used: pinned legacy keeps it 1 session).

describe("P21 partial completion", () => {
  const full = [session(line, day(20), [S(60, 10), S(60, 10), S(60, 10)]), session(line, day(24), [S(60, 10), S(60, 10), S(60, 10)]), session(line, day(28), [S(60, 10), S(60, 10), S(60, 10)])];
  it("all prescribed sets at the ceiling earn the load", () => {
    expect(P(full).currency).toBe("load");
  });
  it("only 1 of 3 prescribed sets done (at the ceiling) does NOT earn load; it says so", () => {
    const partial = [...full.slice(0, 2), session(line, day(28), [S(60, 10)])];
    const p = P(partial);
    expect(p.currency).not.toBe("load");
    expect(p.load).toBe(60);
    expect(p.reason.key).toBe("partial_session");
    expect(p.warnings).toContain("fewer_sets_than_planned");
    expect(renderReason(p.reason)).toMatch(/only 1 of 3 sets/);
    expect(p.inputs.readiness.requiredSetsAtTop).toBe(3);
  });
  it("2 of 3 sets at the top load, third lighter: not earned either (the lighter set is not a top set)", () => {
    const p = P([...full.slice(0, 2), session(line, day(28), [S(60, 10), S(60, 10), S(55, 10)])]);
    expect(p.currency).not.toBe("load");
    expect(p.reason.key).toBe("partial_session");
  });
  it("extra sets beyond the prescription are fine", () => {
    const p = P([...full.slice(0, 2), session(line, day(28), [S(60, 10), S(60, 10), S(60, 10), S(60, 10)])]);
    expect(p.currency).toBe("load");
  });
  it("the weakest set at the top load decides: one set short of the ceiling blocks the jump", () => {
    const p = P([...full.slice(0, 2), session(line, day(28), [S(60, 10), S(60, 9), S(60, 10)])]);
    expect(p.currency).toBe("reps");
    expect(p.load).toBe(60);
    expect(p.inputs.sessions[0]!.repsAtTop).toBe(9);
  });
  it("a partial session below the ceiling still just asks for one more rep, with the warning", () => {
    const p = P([...full.slice(0, 2), session(line, day(28), [S(60, 8)])]);
    expect(p.reason.key).toBe("reps_in_range");
    expect(p.warnings).toContain("fewer_sets_than_planned");
  });
  it("unknown plan (no plannedSets): one set is enough, as before", () => {
    const p = proposeNext({ exercise: exBar(), gym: gymA, asOf: ASOF, history: [...full.slice(0, 2), session(line, day(28), [S(60, 10)])] });
    expect(p.currency).toBe("load");
    expect(p.warnings).not.toContain("fewer_sets_than_planned");
  });
});

describe("P21 top set + back-off prescription", () => {
  const tb = { plannedSets: 4, topSets: 1 };
  const tagged = (load: number, reps: number, slot: number, role: "top" | "backoff") =>
    S(load, reps, { tags: [`${SLOT_TAG_PREFIX}${slot}`, role === "top" ? ROLE_TOP_TAG : ROLE_BACKOFF_TAG] });
  it("one heavy top set at the ceiling plus lighter back-off sets earns load; back-offs are ignored", () => {
    const row = [tagged(100, 10, 1, "top"), tagged(80, 12, 2, "backoff"), tagged(80, 12, 3, "backoff"), tagged(80, 12, 4, "backoff")];
    const h = [session(line, day(24), row), session(line, day(28), row)];
    const p = P(h, tb);
    expect(p.currency).toBe("load");
    expect(p.inputs.readiness.requiredSetsAtTop).toBe(1);
    expect(p.warnings).not.toContain("fewer_sets_than_planned");
  });
  it("two top sets prescribed: one tagged top set is not enough", () => {
    const one = (d: number) => session(line, day(d), [tagged(100, 10, 1, "top"), tagged(80, 12, 2, "top"), tagged(80, 12, 3, "backoff"), tagged(80, 12, 4, "backoff")]);
    const p = P([one(20), one(24), one(28)], { plannedSets: 4, topSets: 2 });
    expect(p.currency).not.toBe("load");
    expect(p.reason.key).toBe("partial_session");
  });
  it("an old session with no slot or role, logged light first, does not earn load", () => {
    const one = (d: number) => session(line, day(d), [S(80, 12), S(100, 10), S(80, 12), S(80, 12)]);
    const p = P([one(24), one(28)], tb);
    expect(p.currency).not.toBe("load");
    expect(p.load).toBeNull();
    expect(p.reason.key).toBe("ambiguous_top");
    expect(p.inputs.sessions).toEqual([]);
  });
});
