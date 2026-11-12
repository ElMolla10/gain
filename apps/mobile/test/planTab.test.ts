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
  it("Build me a program is the primary button on the populated Plan tab; Edit is secondary; Reorder moved to the editor", () => {
    const populated = f.slice(f.indexOf("<Screen tab>"));
    expect(populated).toMatch(/<BigButton hero label=\{t\("coach\.build"\)\}/);
    expect(populated).toMatch(/<BigButton variant="secondary" icon="edit"/);
    expect(populated.indexOf('hero label={t("coach.build")}')).toBeLessThan(populated.indexOf('variant="secondary" icon="edit"'));
    expect(populated).not.toContain("prog.workouts.reorder");
    expect(src("components/ProgrammeEditorView.tsx")).toContain("setReorderWorkouts(true)");
  });
  it("opens workout import from the bottom of Plan without a subtitle, with and without an active program", () => {
    expect(f.match(/<BigButton label=\{t\("import.entry"\)\} onPress=\{\(\) => nav.navigate\("Import"\)\}/g)).toHaveLength(2);
    expect(f).not.toContain('t("import.entryNote")');
    expect(f.indexOf('t("import.entry")')).toBeLessThan(f.indexOf('<Screen tab>'));
    const populated = f.slice(f.indexOf('<Screen tab>'));
    expect(populated.indexOf('t("import.entry")')).toBeGreaterThan(populated.indexOf('SectionTitle>{t("prog.more")}</SectionTitle>'));
    expect(populated.indexOf('t("import.entry")')).toBeGreaterThan(populated.indexOf('<PlanMuscleRadar'));
  });
  it("removes exposure and versions from the details list while keeping quieter version access", () => {
    const more = f.slice(f.indexOf('SectionTitle>{t("prog.more")}</SectionTitle>'));
    const listCard = more.slice(0, more.indexOf("</Card>"));
    expect(listCard).not.toContain('t("prog.exposure.title")');
    expect(listCard).not.toContain('t("prog.versions")');
    expect(f).toContain('onPress={() => nav.navigate("ProgrammeVersions")}');
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
