import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/strings";
import { jumpKindText, parseJumpKind } from "../src/logic/jumpText";

const t = (k: string, p?: Record<string, string | number>) => {
  let s = (en as Record<string, string>)[k] ?? k;
  for (const [a, b] of Object.entries(p ?? {})) s = s.replace(`{${a}}`, String(b));
  return s;
};

describe("jump kind text", () => {
  it("parses every kind the engine writes and never throws", () => {
    expect(parseJumpKind("load:harder:2.5")).toEqual({ kind: "load", dir: "harder", deltaKg: 2.5 });
    expect(parseJumpKind("load:easier:5")).toEqual({ kind: "load", dir: "easier", deltaKg: 5 });
    expect(parseJumpKind("effort:rir1")).toEqual({ kind: "effort", rir: 1 });
    expect(parseJumpKind("quality:slow_eccentric")).toEqual({ kind: "quality", change: "slow_eccentric" });
    expect(parseJumpKind("weird")).toEqual({ kind: "unknown", raw: "weird" });
    expect(parseJumpKind("")).toEqual({ kind: "unknown", raw: "" });
  });
  it("shows load jumps in the lifter's unit", () => {
    expect(jumpKindText("load:harder:2.5", "kg", t)).toBe("Heavier by 2.5 kg");
    expect(jumpKindText("load:easier:5", "lb", t)).toBe("Lighter by 11 lb");
  });
  it("describes effort and quality jumps, and falls back to the raw kind", () => {
    expect(jumpKindText("effort:rir1", "kg", t)).toContain("1 reps in reserve");
    expect(jumpKindText("quality:pause", "kg", t)).toBe("Add a pause");
    expect(jumpKindText("quality:extra_set", "kg", t)).toBe("Add a set");
    expect(jumpKindText("x:y", "kg", t)).toBe("x:y");
  });
});
