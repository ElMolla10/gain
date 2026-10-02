import { describe, expect, it } from "vitest";
import { checkOutlier, MAX_PLAUSIBLE_REPS } from "./outlier";
import { findSpec } from "./loads";
import { gymA, lineOf, run, S, session, sets } from "./testkit";

const line = lineOf("db-press");
const hist = run(line, 30, [10, 10, 10]);
const spec = findSpec(gymA, "dumbbell");

describe("checkOutlier", () => {
  it("a normal next step is fine", () => {
    const r = checkOutlier(S(32.5, 8), { line, history: hist, gymSpec: spec });
    expect(r.verdict).toBe("ok");
    expect(r.outlierStatus).toBe("none");
    expect(r.expected?.medianLoad).toBe(30);
  });
  it("a back-off set with more reps at a lighter load is fine", () => {
    expect(checkOutlier(S(25, 14), { line, history: hist, gymSpec: spec }).verdict).toBe("ok");
  });
  it("a load double the line (wrong plate / machine) is unconfirmed", () => {
    const r = checkOutlier(S(60, 10), { line, history: hist, gymSpec: spec });
    expect(r.verdict).toBe("unconfirmed");
    expect(r.outlierStatus).toBe("unconfirmed");
    expect(r.reasons).toContain("load_far_from_line");
  });
  it("a missing digit (3 instead of 30) is unconfirmed", () => {
    expect(checkOutlier(S(3, 10), { line, history: hist, gymSpec: spec }).verdict).toBe("unconfirmed");
  });
  it("25 reps at the usual load is unconfirmed through the strength estimate", () => {
    const r = checkOutlier(S(30, 25), { line, history: hist, gymSpec: spec });
    expect(r.verdict).toBe("unconfirmed");
    expect(r.reasons).toContain("e1rm_far_from_line");
  });
  it("impossible values are flagged even with no history", () => {
    const ctx = { line, history: [] };
    expect(checkOutlier(S(30, 0), ctx).reasons).toEqual(["invalid_value"]);
    expect(checkOutlier(S(30, MAX_PLAUSIBLE_REPS + 1), ctx).verdict).toBe("unconfirmed");
    expect(checkOutlier(S(-5, 8), ctx).verdict).toBe("unconfirmed");
    expect(checkOutlier(S(0, 8), ctx).verdict).toBe("unconfirmed");
    expect(checkOutlier(S(NaN, 8), ctx).verdict).toBe("unconfirmed");
  });
  it("no history: cannot judge, says so, stores none", () => {
    const r = checkOutlier(S(30, 10), { line, history: [] });
    expect(r.verdict).toBe("insufficient_history");
    expect(r.outlierStatus).toBe("none");
    expect(r.expected).toBeNull();
  });
  it("a single earlier set is not enough to judge", () => {
    const h = [session(line, "2026-09-30", [S(30, 10)])];
    expect(checkOutlier(S(80, 10), { line, history: h }).verdict).toBe("insufficient_history");
  });
  it("warm-ups, drop sets and unconfirmed sets in history do not define the line", () => {
    const h = [
      session(line, "2026-09-30", [
        S(10, 10, { warmup: true }),
        S(10, 10, { warmup: true }),
        S(80, 3, { tags: ["drop"] }),
        S(80, 3, { outlierStatus: "unconfirmed" }),
        S(80, 3, { outlierStatus: "rejected" }),
      ]),
    ];
    expect(checkOutlier(S(30, 10), { line, history: h }).verdict).toBe("insufficient_history");
  });
  it("other gyms and other setups are not the line", () => {
    const other = run(lineOf("db-press", "free", "home"), 30, [10, 10, 10]);
    expect(checkOutlier(S(30, 10), { line, history: other }).verdict).toBe("insufficient_history");
  });
  it("a confirmed earlier outlier does count towards the line", () => {
    const h = [session(line, "2026-09-30", sets(40, 10, 3, { outlierStatus: "confirmed" }))];
    expect(checkOutlier(S(40, 10), { line, history: h }).verdict).toBe("ok");
  });
  it("bodyweight line without a bodyweight compares reps, never guesses bodyweight", () => {
    const bl = lineOf("dip", "bodyweight_plus_added");
    const h = run(bl, 0, [10, 10, 10]);
    expect(checkOutlier(S(0, 12), { line: bl, history: h }).verdict).toBe("ok");
    expect(checkOutlier(S(0, 30), { line: bl, history: h }).verdict).toBe("unconfirmed");
    expect(checkOutlier(S(2.5, 10), { line: bl, history: h }).verdict).toBe("ok");
  });
  it("bodyweight line with a bodyweight uses the moved load", () => {
    const bl = lineOf("dip", "bodyweight_plus_added");
    const h = run(bl, 10, [10, 10, 10]);
    const ctx = { line: bl, history: h, bodyweightKg: 80 };
    expect(checkOutlier(S(12.5, 9), ctx).verdict).toBe("ok");
    expect(checkOutlier(S(10, 40), ctx).verdict).toBe("unconfirmed");
  });
});

describe("fat-finger typos (Step 5)", () => {
  it("100 reps instead of 10 at the usual load is unconfirmed", () => {
    const r = checkOutlier(S(30, 100), { line, history: hist, gymSpec: spec });
    expect(r.verdict).toBe("unconfirmed");
    expect(r.outlierStatus).toBe("unconfirmed");
  });
  it("100 kg instead of 10 kg on a light lift is unconfirmed", () => {
    const light = run(line, 10, [10, 10, 10]);
    const r = checkOutlier(S(100, 10), { line, history: light, gymSpec: spec });
    expect(r.verdict).toBe("unconfirmed");
    expect(r.reasons).toContain("load_far_from_line");
  });
  it("an extra zero (300 instead of 30) is unconfirmed", () => {
    expect(checkOutlier(S(300, 10), { line, history: hist, gymSpec: spec }).verdict).toBe("unconfirmed");
  });
  it("a comma slip (3 reps typed as 33) is unconfirmed on a heavy line", () => {
    const heavy = run(line, 30, [3, 3, 3]);
    expect(checkOutlier(S(30, 33), { line, history: heavy, gymSpec: spec }).verdict).toBe("unconfirmed");
  });
  it("a real small jump in reps is not a typo", () => {
    expect(checkOutlier(S(30, 12), { line, history: hist, gymSpec: spec }).verdict).toBe("ok");
  });
});
