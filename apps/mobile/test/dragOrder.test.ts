import { describe, expect, it } from "vitest";
import { dragDestination, gapOffset, moveIndex } from "../src/logic/dragOrder";

describe("names-only hold-and-drag exercise reorder", () => {
  const ids = ["bench", "incline", "pecdeck", "lateral", "pushdown", "triceps"];
  it("moves an exercise across multiple positions with one drag", () => {
    expect(moveIndex(ids, 5, 1)).toEqual(["bench", "triceps", "incline", "pecdeck", "lateral", "pushdown"]);
    expect(moveIndex(ids, 0, 5)).toEqual(["incline", "pecdeck", "lateral", "pushdown", "triceps", "bench"]);
    expect(ids[0]).toBe("bench");
  });
  it("never removes or duplicates items on invalid drags", () => {
    expect(moveIndex(ids, 99, 0)).toEqual(ids);
    expect(moveIndex(ids, 1, -1)).toEqual(ids);
    expect(moveIndex(ids, 1, 1)).toEqual(ids);
  });
  it("snaps vertical finger movement to a valid target", () => {
    expect(dragDestination(2, 0, 64, ids.length)).toBe(2);
    expect(dragDestination(2, 33, 64, ids.length)).toBe(3);
    expect(dragDestination(2, -97, 64, ids.length)).toBe(0);
    expect(dragDestination(2, 1000, 64, ids.length)).toBe(5);
    expect(dragDestination(0, -1000, 64, ids.length)).toBe(0);
    expect(dragDestination(2, Number.NaN, 64, ids.length)).toBe(2);
  });
  it("slides bystander rows into the temporary gap", () => {
    expect(gapOffset(3, 1, 4, 64)).toBe(-64);
    expect(gapOffset(4, 1, 4, 64)).toBe(-64);
    expect(gapOffset(0, 1, 4, 64)).toBe(0);
    expect(gapOffset(1, 1, 4, 64)).toBe(0);
    expect(gapOffset(1, 4, 1, 64)).toBe(64);
    expect(gapOffset(3, 4, 1, 64)).toBe(64);
  });
});
