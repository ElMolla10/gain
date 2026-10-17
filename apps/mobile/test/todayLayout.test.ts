import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { darkPalette, lightPalette } from "../src/palettes";
import { choiceListMaxHeight, hasCollapsibleContent } from "../src/logic/sheetLayout";
import { ar, en } from "../src/i18n/strings";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
const today = src("screens/TodayScreen.tsx");
const ui = src("ui.tsx");

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x! + 0.05) / (y! + 0.05); };

describe("Today layout (design audit T-3..T-8)", () => {
  it("T-3: the program name is its own 14 muted line; no dot separator glued to it", () => {
    expect(today).toContain(`<AppText style={{ color: p.muted, fontSize: ty.label }}>{data.programmeName}</AppText>`);
    expect(today).not.toContain("{data.programmeName} ·");
  });
  it("T-4: the lead target row has a 4 dp accent bar on the start edge (mirrors in RTL)", () => {
    expect(today).toMatch(/borderStartWidth: isLead \? 4 : 0, borderStartColor: p\.accent/);
    expect(today).not.toMatch(/borderLeftWidth/);
  });
  it("T-5: order is session card (goal pace under Start) > weights list > one collapsed 'This week' card holding the five cards", () => {
    const start = today.indexOf("<BigButton hero");
    const pace = today.indexOf("{paceLine ? (");
    const list = today.indexOf('t("today.targets")');
    const week = today.indexOf("<CollapsibleCard");
    expect(start).toBeGreaterThan(0);
    expect(pace).toBeGreaterThan(start);
    expect(list).toBeGreaterThan(pace);
    expect(week).toBeGreaterThan(list);
    const inside = today.slice(week, today.indexOf("</CollapsibleCard>"));
    for (const c of ["PersonalProgressCard", "WeeklyReviewCard", "MuscleVolumeCard", "DeloadCard", "PeriodizationCard"]) expect(inside).toContain(`<${c} />`);
    expect(today).not.toContain("<ListCard");
    expect(en["today.thisWeek"]).toBe("This week");
    expect(ar["today.thisWeek"]).toBeTruthy();
  });
  it("T-5: the collapsible is a 56 dp disclosure row, hidden from screen readers while closed, and absent when nothing is inside", () => {
    const c = ui.slice(ui.indexOf("export function CollapsibleCard"), ui.indexOf("/** A whole-card link"));
    expect(c).toContain("minHeight: 56");
    expect(c).toContain("accessibilityState={{ expanded: open }}");
    expect(c).toContain('importantForAccessibility={shown ? "auto" : "no-hide-descendants"}');
    expect(c).toContain("mirror");
    expect(hasCollapsibleContent(0)).toBe(false);
    expect(hasCollapsibleContent(120)).toBe(true);
  });
  it("T-6: the preview note sits behind a 48 dp '?' with a spoken label, closed by default", () => {
    expect(today).toContain(`<QuietAction label="?" accessibilityLabel={t("today.previewNoteToggle")} expanded={noteOpen}`);
    expect(today).toContain("const [noteOpen, setNoteOpen] = useState(false);");
    expect(today).toContain('{noteOpen ? <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("today.previewNote")}</AppText> : null}');
  });
  it("T-7: fillEdge is olive #5C8A00 in light only (>= 3:1 against bone), transparent in dark, and edges enabled primary buttons", () => {
    expect(lightPalette.fillEdge).toBe("#5C8A00");
    expect(darkPalette.fillEdge).toBe("transparent");
    expect(contrast(lightPalette.fillEdge, lightPalette.bg)).toBeGreaterThanOrEqual(3);
    expect(ui).toMatch(/variant === "primary" \? \(props\.disabled && !props\.loading \? "transparent" : p\.fillEdge\)/);
  });
  it("T-8: the picker list is capped at 60% of the screen and its note is one short line in both languages", () => {
    expect(choiceListMaxHeight(892)).toBe(535);
    expect(ui).toContain("maxHeight: choiceListMaxHeight(height)");
    expect(today).toContain('note={t("today.chooseNoteShort")}');
    expect(en["today.chooseNoteShort"].length).toBeLessThanOrEqual(50);
    expect(ar["today.chooseNoteShort"].length).toBeLessThanOrEqual(50);
  });
});
