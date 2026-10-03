import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkJump, DEFAULT_JUMP_CONFIRM_PCT, jumpOptions, jumpPct, parseJumpThreshold } from "../src/logic/jumpGuard";
import { ar, en } from "../src/i18n/strings";

const base = { prevLoad: 60, prevReps: 8, targetReps: 6, setup: "free" } as const;

describe("P04 confirm big load jumps", () => {
  it("jumpPct is relative to last time, one decimal", () => {
    expect(jumpPct(60, 66)).toBe(10);
    expect(jumpPct(40, 50)).toBe(25);
    expect(jumpPct(0, 50)).toBe(0);
  });
  it("exactly 10% passes silently; above 10% needs confirmation (default threshold)", () => {
    expect(DEFAULT_JUMP_CONFIRM_PCT).toBe(10);
    expect(checkJump({ ...base, targetLoad: 66 }).needsConfirm).toBe(false);
    expect(checkJump({ ...base, targetLoad: 62.5 }).needsConfirm).toBe(false);
    const big = checkJump({ ...base, targetLoad: 67.5 });
    expect(big.needsConfirm).toBe(true);
    expect(big.pct).toBe(12.5);
  });
  it("offers repeat, one more rep and (when smaller than the jump) a microload", () => {
    const c = checkJump({ ...base, targetLoad: 70, microLoad: 61.25 });
    expect(c.alternatives).toEqual([
      { kind: "repeat", load: 60, reps: 8 },
      { kind: "reps", load: 60, reps: 9 },
      { kind: "microload", load: 61.25, reps: 8 },
    ]);
    // a "microload" as big as the jump is no alternative
    expect(checkJump({ ...base, targetLoad: 70, microLoad: 70 }).alternatives.map((a) => a.kind)).toEqual(["repeat", "reps"]);
    expect(checkJump({ ...base, targetLoad: 70, microLoad: null }).alternatives.map((a) => a.kind)).toEqual(["repeat", "reps"]);
  });
  it("lighter loads, missing history, other setups and a threshold of 0 never ask", () => {
    expect(checkJump({ ...base, targetLoad: 50 }).needsConfirm).toBe(false);
    expect(checkJump({ ...base, prevLoad: null, targetLoad: 100 }).needsConfirm).toBe(false);
    expect(checkJump({ ...base, targetLoad: 100, setup: "assisted" }).needsConfirm).toBe(false);
    expect(checkJump({ ...base, targetLoad: 100, thresholdPct: 0 }).needsConfirm).toBe(false);
    expect(checkJump({ ...base, targetLoad: 100, thresholdPct: 50 }).needsConfirm).toBe(true);
    expect(checkJump({ ...base, targetLoad: 80, thresholdPct: 50 }).needsConfirm).toBe(false);
  });
  it("the threshold setting falls back to 10 for junk", () => {
    expect(parseJumpThreshold(null)).toBe(10);
    expect(parseJumpThreshold("")).toBe(10);
    expect(parseJumpThreshold("abc")).toBe(10);
    expect(parseJumpThreshold("-5")).toBe(10);
    expect(parseJumpThreshold("15")).toBe(15);
    expect(parseJumpThreshold("0")).toBe(0);
  });
  it("jumpOptions puts the proposed jump first and labels every choice", () => {
    const c = checkJump({ ...base, targetLoad: 70, microLoad: 61.25 });
    const o = jumpOptions(c, { load: 70, reps: 6 }, (k, p) => `${k}:${p.load}x${p.reps}`, (kg) => `${kg}kg`);
    expect(o.map((x) => x.kind)).toEqual(["anyway", "repeat", "reps", "microload"]);
    expect(o[0]!.label).toBe("jump.anyway:70kgx6");
  });
  it("the strings exist in both languages and the placeholders match", () => {
    for (const k of ["jump.title", "jump.anyway", "jump.repeat", "jump.reps", "jump.micro"] as const) {
      expect(ar[k]).toMatch(/[\u0600-\u06FF]/);
      expect((en[k].match(/\{\w+\}/g) ?? []).sort()).toEqual((ar[k].match(/\{\w+\}/g) ?? []).sort());
    }
  });
  it("both the logger and the Finish screen run the guard before applying a proposed jump", () => {
    const root = join(__dirname, "..", "src/screens");
    expect(readFileSync(join(root, "WorkoutScreen.tsx"), "utf8")).toContain("checkJump(");
    expect(readFileSync(join(root, "FinishScreen.tsx"), "utf8")).toContain("checkJump(");
  });
});
