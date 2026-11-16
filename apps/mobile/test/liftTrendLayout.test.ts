import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TrendPoint } from "@gain/engine";
import { chartBars } from "../src/logic/trendChart";
import { smoothPath } from "../src/logic/chartPath";
import { en, ar } from "../src/i18n/strings";

// The approved exercise progression redesign (Summary / Rep Max / History, gear setup sheet).
const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
const pt = (i: number, load: number, imported = false): TrendPoint => ({ at: 1_000_000 * (i + 1), load, reps: 5, sets: 3, ...(imported ? { imported } : {}) });

describe("exercise progression layout", () => {
  const view = src("screens/LiftTrendView.tsx");
  const screen = src("screens/LiftTrendScreen.tsx");
  const at = (needle: string) => {
    const i = view.indexOf(needle);
    expect(i, needle).toBeGreaterThan(-1);
    return i;
  };
  it("Summary: next workout → estimated 1RM chart (range, goal) → three tiles → recent", () => {
    const summary = view.slice(at("const summary = ("));
    const order = ["{hero}", "{chartCard}", 't("trend.stat.bestSet")', 't("trend.stat.bestVolume")', 't("trend.stat.prs")', "{recent}"].map((n) => summary.indexOf(n));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(at("<E1rmChart")).toBeLessThan(at('{ value: "3m", label: t("trend.range.3mShort") }'));
    expect(at('{ value: "3m", label: t("trend.range.3mShort") }')).toBeLessThan(at("{goalRow}"));
  });
  it("the removed clutter stays gone: sticky button, subtitle, path score, explainer, metric chips and legend", () => {
    for (const gone of ["footer=", "loads.open", "trend.setupLine", "path.", "trend.whatShows", "trend.metric", "trend.chartHint", "QuietAction", "RepMaxPowerCurve", "TrendChart"]) expect(view, gone).not.toContain(gone);
    expect(screen).not.toContain("footer=");
  });
  it("the gear in the native header opens the setup sheet; each row opens the existing editor", () => {
    expect(screen).toContain('headerRight: () => <IconButton icon="settings" label={t("trend.setup.open")} onPress={() => setSheet("menu")} />');
    for (const row of ['t("trend.setup.target")', 't("trend.setup.setsReps")', 't("trend.setup.jumps")', 't("trend.setup.focus")']) expect(screen, row).toMatch(new RegExp(`<ListRow\\s+title={${row.replace(/[.()]/g, "\\$&")}}`));
    for (const editor of ["achievements.setPin(", "programmes.setExercisePrescription(", "specWithJump(", '"ExerciseLoads"', "programmes.updateExercise("]) expect(screen, editor).toContain(editor);
    expect(screen).toContain("<Sheet visible={sheet !== null}");
  });
  it("the goal is kept per exercise and setup in a device setting", () => {
    expect(screen).toContain("repos.getSetting(goalSettingKey(r.lift.exerciseId, r.lift.setup))");
    expect(screen).toContain("repos.setSetting(goalSettingKey(data.lift.exerciseId, data.lift.setup)");
  });
  it("tabs use the new strings in both languages", () => {
    for (const k of ["trend.tab.summary", "trend.tab.repMax", "trend.tab.history", "trend.goal.beyond", "trend.goal.notOnPace", "trend.setup.title"] as const) {
      expect(en[k]).toBeTruthy();
      expect(ar[k]).toMatch(/[\u0600-\u06FF]/);
    }
    expect(en["trend.goal.beyond"]).toBe("Over 12 months at this pace");
  });
});

describe("estimated 1RM chart", () => {
  const c = src("components/trend/E1rmChart.tsx");
  it("is drawn left-to-right in both languages, with a dashed projection and a goal marker", () => {
    expect(c).toMatch(/direction: "ltr"/);
    expect(c).toContain('strokeDasharray="5 5"');
    expect(c).toContain("{marker ? (");
    expect(c).toContain('accessibilityRole="image" accessibilityLabel={summary}');
  });
  it("smooth path passes through every point", () => {
    const d = smoothPath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 5 }]);
    expect(d.startsWith("M0,10")).toBe(true);
    expect(d).toContain("10.0,0.0");
    expect(d.endsWith("20.0,5.0")).toBe(true);
    expect(smoothPath([])).toBe("");
  });
  it("bars helper still carries values (used by other trend views)", () => {
    expect(chartBars([pt(0, 60), pt(1, 65, true)], false).map((b) => [b.value, b.imported])).toEqual([[60, false], [65, true]]);
  });
});
