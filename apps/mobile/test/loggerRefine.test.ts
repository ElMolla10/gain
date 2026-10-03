import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";
import { RESUMED_NOTE_MS, saveStatusKind } from "../src/logic/saveStatus";
import { currentRowKey, initialRows, markSaved, pendingCount, editRow } from "../src/logic/workoutRows";
import { logDarkPalette, logLightPalette } from "../src/palettes";

const src = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");
const screen = src("screens/WorkoutScreen.tsx");
const today = src("screens/TodayScreen.tsx");
const ui = src("ui.tsx");
const parts = src("components/LogParts.tsx");

const base = { failed: false, saving: false, pending: 0, resumedNote: false, savedSets: 0 };

describe("logger save status (pure)", () => {
  it("says what is true: nothing logged, saved on this phone, or unsaved", () => {
    expect(saveStatusKind(base)).toBe("empty");
    expect(saveStatusKind({ ...base, savedSets: 3 })).toBe("saved");
    expect(saveStatusKind({ ...base, savedSets: 3, pending: 1 })).toBe("unsaved");
  });
  it("a failure beats everything, and unsaved work is never covered by the temporary resume note or 'saved'", () => {
    expect(saveStatusKind({ ...base, failed: true, saving: true, pending: 2, resumedNote: true, savedSets: 4 })).toBe("failed");
    expect(saveStatusKind({ ...base, pending: 1, resumedNote: true, savedSets: 4 })).toBe("unsaved");
    expect(saveStatusKind({ ...base, saving: true, resumedNote: true })).toBe("saving");
  });
  it("the resume confirmation is temporary: shown first, then the ordinary status", () => {
    expect(saveStatusKind({ ...base, resumedNote: true, savedSets: 4 })).toBe("resumed");
    expect(saveStatusKind({ ...base, resumedNote: false, savedSets: 4 })).toBe("saved");
    expect(RESUMED_NOTE_MS).toBeGreaterThanOrEqual(3000);
    expect(RESUMED_NOTE_MS).toBeLessThanOrEqual(10000);
    expect(screen).toContain("setResumeNote(false)");
    expect(screen).not.toContain("{loaded.resumed ?"); // no permanent resumed line in the scroll
  });
  it("the status lives in the header (always visible), is announced politely, and a failed save sets it", () => {
    expect(screen).toContain('accessibilityLiveRegion="polite"');
    expect(screen).toContain("setSaveError(true)");
    expect(screen).toContain("setSaveError(false)");
    expect(screen).toContain('t("workout.saveFailed.title")'); // the alert is still shown too
  });
});

describe("logger rows: pending and current set (pure)", () => {
  const rows = () => initialRows([{ id: "s1", load: 50, reps: 8, rir: null, warmup: false, tags: [] }], 3, { load: 50, reps: 8 }, (() => { let n = 0; return () => `k${++n}`; })());
  it("a ticked row is not pending; typed-but-unticked and edited-after-ticking are", () => {
    const r = rows();
    expect(pendingCount(r)).toBe(0);
    const typed = editRow(r, r[1]!.key, { load: 52.5 });
    expect(pendingCount(typed)).toBe(1);
    const edited = editRow(r, r[0]!.key, { reps: 9 });
    expect(pendingCount(edited)).toBe(1);
    expect(pendingCount(markSaved(edited, r[0]!.key))).toBe(0);
    const blank = initialRows([], 2, { load: null, reps: null }, (() => { let n = 0; return () => `b${++n}`; })());
    expect(pendingCount(blank)).toBe(0); // empty boxes (even with a ghost target) are not "unsaved work"
    expect(pendingCount(editRow(blank, blank[0]!.key, { load: 40 }))).toBe(1); // a weight with no reps yet is still unsaved, not hidden
  });
  it("the current set is the first one that is not ticked", () => {
    const r = rows();
    expect(r[0]!.saved).toBe(true);
    expect(currentRowKey(r)).toBe(r[1]!.key);
    expect(currentRowKey([])).toBeNull();
    expect(currentRowKey(r.slice(0, 1))).toBeNull();
  });
});

describe("logger and Today: layout rules (source)", () => {
  it("Today: Suggested today label, a Change workout action and a picker; no chip group, no star, no separate lead-target card", () => {
    expect(today).toContain('t("today.suggestedToday")');
    expect(today).toContain("<ChoiceSheet");
    expect(today).toContain('t("today.change")');
    expect(today).not.toContain("<Chip");
    expect(today).not.toContain("★");
    expect(today).not.toContain("TargetStrip");
    expect(today).toContain("sessionAction(");
  });
  it("Today: the lead exercise is highlighted inside the list with a quiet Why; Start/Resume comes before the sample note", () => {
    expect(today).toContain("isLead");
    expect(today).toContain('navigate("Why"');
    expect(today.indexOf("<BigButton hero")).toBeGreaterThan(0);
    expect(today.indexOf('t("today.starterNote")')).toBeGreaterThan(today.indexOf("<BigButton hero"));
  });
  it("Why/Change actions are the shared QuietAction with a 48 dp minimum touch area", () => {
    const q = ui.slice(ui.indexOf("export function QuietAction"), ui.indexOf("/** Labelled text field"));
    expect(q).toContain("minHeight: MIN_TOUCH");
    expect(q).toContain("minWidth: MIN_TOUCH");
    expect(q).not.toContain("numberOfLines");
    expect(today).toContain("<QuietAction");
  });
  it("the picker is an accessible radio group with a check mark (selection is not colour alone) and wraps long names", () => {
    const c = ui.slice(ui.indexOf("export function ChoiceSheet"), ui.indexOf("Where the data lives"));
    expect(c).toContain('accessibilityRole="radiogroup"');
    expect(c).toContain('accessibilityRole="radio"');
    expect(c).toContain("checked: o.selected");
    expect(c).toContain('<Icon name="check"');
    expect(c).not.toContain("numberOfLines");
    expect(c).toContain("<Sheet"); // close button, Android back, safe area come from the shared Sheet
  });
  it("logger: rest control stays in each exercise header (48 dp), soft done rows, strong current row, outlined current boxes", () => {
    expect(screen).toContain("<RestToggle");
    const r = parts.slice(parts.indexOf("export function RestToggle"));
    expect(r).toContain("minHeight: 48");
    expect(r).toContain("minWidth: 48");
    expect(screen).toContain("currentRowKey(list)");
    expect(screen).toContain("p.activeBg");
    expect(screen).toContain("done={done}");
    expect(screen).toContain("current={current}");
  });
  it("logger: touch targets are not shrunk (tick, set button, inputs, rest, why)", () => {
    expect(screen.match(/width: 48, height: 48/g)?.length).toBeGreaterThanOrEqual(2); // set button + tick
    expect(parts).toContain("height: INPUT_HEIGHT");
  });
  it("new strings exist in English and Egyptian Arabic", () => {
    for (const k of ["today.suggestedToday", "today.yourChoice", "today.change", "today.changeLabel", "today.resumeDay", "workout.status.saving", "workout.status.unsaved", "workout.status.failed", "workout.restOffShort"] as const) {
      expect(en[k].length, k).toBeGreaterThan(0);
      expect(ar[k], k).toMatch(/[\u0600-\u06FF]/);
    }
    expect(en["today.chooseNote"]).not.toContain("★");
    expect(ar["today.chooseNote"]).not.toContain("★");
    expect(en["today.suggestedToday"]).toBe("Suggested today");
  });
});

describe("logger palette: done is quiet, current is strong", () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const [name, p] of [["dark", logDarkPalette], ["light", logLightPalette]] as const) {
    it(`${name}: the done wash is closer to the page than the current-set wash`, () => {
      expect(ratio(p.doneBg, p.bg)).toBeLessThan(ratio(p.activeBg, p.bg) + 0.0001);
      expect(p.doneBg).not.toBe(p.activeBg);
    });
  }
});
