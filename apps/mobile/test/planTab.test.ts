import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar } from "../src/i18n/strings";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("2.1 Plan tab (P-1, P-2, P-6, P-7)", () => {
  const f = src("screens/ProgrammeScreen.tsx");
  const rows = f.slice(f.indexOf("day.exercises.map((e, k)"), f.indexOf("prog.workoutSettings"));
  it("the rule sentence is not inside the per-exercise map; it is said once under the title", () => {
    expect(rows).not.toContain("rangeText(");
    expect(f.match(/t\("prog\.ruleNote"\)/g)).toHaveLength(1);
    expect(f.indexOf("prog.ruleNote")).toBeLessThan(f.indexOf("day.exercises.map((e, k)"));
  });
  it("the scheme is one isolated run with an en dash", () => {
    expect(rows).toMatch(/isolateLtr\(`\$\{e\.sets\}\$\{NBSP\}×\$\{NBSP\}\$\{range\.min\}\$\{EN_DASH\}\$\{range\.max\}`\)/);
  });
  it("no primary button on the populated Plan tab; Reorder moved to the editor", () => {
    const populated = f.slice(f.indexOf("<Screen tab>"));
    expect(populated).toMatch(/<BigButton variant="secondary" icon="edit"/);
    expect(populated).not.toMatch(/<BigButton (?!variant)/);
    expect(populated).not.toContain("prog.workouts.reorder");
    expect(src("components/ProgrammeEditorView.tsx")).toContain("setReorderWorkouts(true)");
  });
  it("no gear in collapsed headers; workout settings is a row inside the open card", () => {
    expect(f).not.toMatch(/icon="settings"/);
    expect(f).toMatch(/expanded \? <ListRow title=\{t\("prog\.workoutSettings"\)\}/);
  });
  it("ceiling override is a pill with a spoken label; overrides explained in a sheet", () => {
    expect(f).toContain('accessibilityLabel={t("prog.ceilingUp", { n: range.max })}');
    expect(f).toMatch(/<Sheet visible=\{ruleOpen\}/);
    expect(ar["prog.ceilingUp"]).toMatch(/[\u0600-\u06FF]/);
  });
});
