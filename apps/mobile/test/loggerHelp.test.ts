import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";

const screen = readFileSync(join(__dirname, "..", "src/screens/WorkoutScreen.tsx"), "utf8");
const help = readFileSync(join(__dirname, "..", "src/components/WorkoutHelp.tsx"), "utf8");

describe("P10 logger: instructions behind a help button, compact wrapping target line", () => {
  it("the default view no longer shows instruction paragraphs; they are in the help sheet", () => {
    for (const k of ["workout.setHint", "workout.finishNote", "workout.superset.note", "workout.replace.note", "workout.add.note"]) {
      expect(screen, k).not.toContain(`"${k}"`);
      expect(help, k).toContain(`"${k}"`);
    }
    expect(screen).toContain("<WorkoutHelp");
    expect(screen).toMatch(/accessibilityLabel=\{t\("workout\.help\.button"\)\}/);
  });
  it("the target line is 'Target: <target>' with a small Why button and wraps instead of truncating", () => {
    const i = screen.indexOf("Compact target line");
    const block = screen.slice(i, screen.indexOf("</View>\n\n", i));
    expect(block).toContain('t("workout.nextTarget")');
    expect(block).toContain('flexWrap: "wrap"');
    expect(block).not.toContain("numberOfLines");
    expect(block).toContain('t("workout.whyShort")');
  });
  it("previous and target stay next to the inputs (PREVIOUS column + ghost target in the boxes)", () => {
    expect(screen).toContain("workout.col.prev");
    expect(screen).toContain("placeholder={row.ghostLoad");
  });
  it("help strings exist in both languages", () => {
    for (const k of ["workout.help.title", "workout.help.button", "workout.help.target", "workout.nextTarget"] as const) {
      expect(en[k].length).toBeGreaterThan(0);
      expect(ar[k]).toMatch(/[\u0600-\u06FF]/);
    }
    expect(en["workout.nextTarget"]).toBe("Target");
  });
});
