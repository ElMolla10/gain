import { describe, expect, it } from "vitest";
import { focusedExercise, focusedRowKey, livePromptVisible } from "../src/logic/workoutFocus";
import { editRow, initialRows, markSaved } from "../src/logic/workoutRows";

describe("current workout focus", () => {
  const unfinished = () => initialRows([], 1, {load:60,reps:8}, () => "set");
  it("starts at the first unfinished exercise and follows an explicitly chosen later exercise", () => {
    const rows = {bench:unfinished(), row:unfinished()};
    expect(focusedExercise(["bench","row"], rows, null)).toBe("bench");
    expect(focusedExercise(["bench","row"], rows, "row")).toBe("row");
  });
  it("advances after completion, respects reorder/removal, and stops highlighting when done", () => {
    const rows = {bench:markSaved(unfinished(), "set"), row:unfinished()};
    expect(focusedExercise(["bench","row"], rows, "bench")).toBe("row");
    expect(focusedExercise(["bench"], rows, "row")).toBeNull();
    expect(focusedExercise(["row","bench"], {bench:unfinished(),row:unfinished()}, null)).toBe("row");
    expect(focusedExercise([], rows, null)).toBeNull();
  });
  it("keeps stop warnings visible while hiding unfocused normal prompts", () => {
    for (const active of [true,false]) expect(livePromptVisible("stop",active)).toBe(true);
    for (const action of ["increase","maintain","decrease"]) {
      expect(livePromptVisible(action,true)).toBe(true);
      expect(livePromptVisible(action,false)).toBe(false);
    }
  });
  it("keeps unsaved edits and invalid saved-row corrections eligible for focus", () => {
    const bench = editRow(markSaved(unfinished(), "set"), "set", {reps:null, invalidReps:true});
    expect(focusedExercise(["bench","row"], {bench,row:unfinished()}, "bench")).toBe("bench");
    expect(bench[0]!.invalidReps).toBe(true);
    expect(focusedRowKey(bench)).toBe("set");
  });
});
