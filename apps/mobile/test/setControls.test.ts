import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";
import { translate } from "../src/i18n/format";

const src = readFileSync(join(__dirname, "..", "src", "screens", "WorkoutScreen.tsx"), "utf8");
const parts = readFileSync(join(__dirname, "..", "src", "components", "LogParts.tsx"), "utf8");

describe("set row controls (P19/P20)", () => {
  it("the set number, the tick and the inputs are real 48 x 48 dp targets", () => {
    expect(src).toMatch(/const colSet = \{ width: 48/);
    expect(src).toMatch(/const colTick = \{ width: 48/);
    expect(src).not.toMatch(/width: 34, height: 34|width: 38, height: 38/);
    expect(parts).toMatch(/height: 48,/);
  });
  it("every control in a set row names its exercise and set", () => {
    expect(src).toContain('const ctx = t("workout.setContext"');
    const rowStart = src.indexOf("const ctx = t(");
    const rowEnd = src.indexOf("</SwipeRow>", rowStart);
    const row = src.slice(rowStart, rowEnd);
    expect((row.match(/\$\{ctx\}/g) ?? []).length).toBeGreaterThanOrEqual(5); // set kind, load, reps, rir, tick
  });
  it("the context text exists in both languages and carries both parts", () => {
    expect(translate("en", "workout.setContext", { exercise: "Bench Press", n: 2 }).replace(/[\u2066\u2069]/g, "")).toBe("Bench Press, set 2");
    expect(translate("ar", "workout.setContext", { exercise: "بنش", n: 2 })).toMatch(/2/);
    expect(en["workout.setContext"]).toContain("{exercise}");
    expect(ar["workout.setContext"]).toContain("{n}");
  });
});
