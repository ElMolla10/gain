import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("2.4 Picker search and the current-program badge (P-8, P-10)", () => {
  it("search field has a glyph and a conditional clear that keeps focus", () => {
    const ui = src("ui.tsx");
    expect(ui).toMatch(/<Icon name="search" color=\{p\.muted\} size=\{20\} \/>/);
    expect(ui).toMatch(/props\.search && props\.value \?/);
    expect(ui).toMatch(/props\.onChangeText\(""\); inputRef\.current\?\.focus\(\);/);
    expect(src("components/ExercisePicker.tsx")).toContain('search={{ clearLabel: t("pick.clearSearch") }}');
    expect(src("components/Icon.tsx")).toMatch(/\| "search"/);
  });
  it("the current program is a tint pill with a check, not a success status", () => {
    const f = src("screens/ProgrammeSwitchScreen.tsx");
    expect(f).not.toMatch(/InlineStatus kind="success" text=\{t\("prog\.current"\)\}/);
    expect(f).toMatch(/<Icon name="check" color=\{p\.accent\} size=\{16\} \/>/);
  });
});
