import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sheetMaxHeight, sheetRelease, SHEET_EXPAND_DRAG } from "../src/logic/sheetLayout";

// Plan 2.11 (N-3): sheets open at content height up to 60%, expand to 90% by dragging up; actions in thumb reach.
const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("sheet height", () => {
  it("caps at 60% collapsed and 90% expanded", () => {
    expect(sheetMaxHeight(900, false)).toBe(540);
    expect(sheetMaxHeight(900, true)).toBe(810);
  });
  it("drag up expands, a short drag down from expanded collapses, a long one dismisses", () => {
    expect(sheetRelease(-SHEET_EXPAND_DRAG, 0, false, false)).toBe("expand");
    expect(sheetRelease(-20, -1.5, false, false)).toBe("expand"); // fast flick up
    expect(sheetRelease(-20, 0, false, false)).toBe("stay");
    expect(sheetRelease(-200, 0, true, false)).toBe("stay"); // already expanded
    expect(sheetRelease(60, 0, true, false)).toBe("collapse");
    expect(sheetRelease(400, 0, true, true)).toBe("dismiss");
    expect(sheetRelease(10, 0, true, false)).toBe("stay");
  });
  it("collapsed sheets keep the #233 drag-dismiss rule", () => {
    expect(sheetRelease(300, 0, false, true)).toBe("dismiss");
    expect(sheetRelease(30, 0.2, false, false)).toBe("stay");
  });
  it("the Sheet uses the new cap, and Reduce Motion skips the resize animation", () => {
    const ui = src("ui.tsx");
    const sheet = ui.slice(ui.indexOf("export function Sheet("), ui.indexOf("export function Sheet(") + 5000);
    expect(sheet).toContain("maxHeight: sheetMaxHeight(height, expanded)");
    expect(sheet).not.toContain("height * 0.9");
    expect(sheet).toMatch(/if \(!latest\.current\.reduced\) LayoutAnimation\.configureNext/);
    expect(sheet).toContain("sheetRelease(g.dy, g.vy, expandedRef.current, sheetShouldDismiss(g.dy, g.vy, cardHeight.current))");
  });
  it("moved callers put the primary action in the footer", () => {
    const ev = src("components/AchievementEvidenceSheet.tsx");
    expect(ev.indexOf('t("achv.viewWorkout")')).toBeGreaterThan(ev.indexOf("footer={"));
    expect(ev.indexOf('t("achv.viewWorkout")')).toBeLessThan(ev.indexOf("    >\n"));
  });
});
