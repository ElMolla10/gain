import { describe, expect, it } from "vitest";
import { editRow, initialRows, markSaved, mergeRows, pendingCount, rowCanLog, unloggedFilled } from "../src/logic/workoutRows";
describe("invalid typed numbers cannot become ghost-target saves", () => {
  it.each(["invalidLoad", "invalidReps", "invalidRir"] as const)("blocks %s, counts it as unsaved and recovers when corrected/cleared", flag => {
    const rows = initialRows([], 1, { load: 60, reps: 8 }, () => "draft");
    const invalid = editRow(rows, "draft", { [flag]: true });
    expect(rowCanLog(invalid[0]!)).toBe(false);
    expect(pendingCount(invalid)).toBe(1);
    expect(unloggedFilled(invalid)).toBe(1);
    expect(rowCanLog(editRow(invalid, "draft", { [flag]: false })[0]!)).toBe(true);
  });
  it("preserves an invalid saved edit across a database reload and does not mark it saved", () => {
    const saved = markSaved(initialRows([], 1, { load: 60, reps: 8 }, () => "draft"), "draft");
    const invalid = editRow(saved, "draft", { reps: null, invalidReps: true });
    const merged = mergeRows(invalid, [{ id: "draft", load: 60, reps: 8, rir: null, warmup: false }]);
    expect(rowCanLog(merged[0]!)).toBe(false);
    expect(pendingCount(merged)).toBe(1);
    expect(merged[0]!.dirty).toBe(true);
    expect(unloggedFilled(merged)).toBe(1);
  });
});
