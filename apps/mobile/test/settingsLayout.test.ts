import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPEARANCES, parseAppearance } from "../src/palettes";
import { ar, en } from "../src/i18n/strings";

const src = readFileSync(join(__dirname, "..", "src", "screens", "SettingsScreen.tsx"), "utf8");

describe("Settings layout", () => {
  it("is grouped into Training, Display, Data and About", () => {
    for (const g of ["training", "display", "data", "about"]) {
      expect(src).toContain(`settings.group.${g}`);
      expect((en as Record<string, string>)[`settings.group.${g}`]).toBeTruthy();
      expect((ar as Record<string, string>)[`settings.group.${g}`]).toBeTruthy();
    }
  });
  it("language and units are compact selectors, not full-width buttons", () => {
    expect(src).not.toContain("BigButton");
    expect(src).toContain("<SelectRow");
  });
  it("offers appearance and the both-names switch, and every appearance has a label", () => {
    expect(src).toContain('"appearance"');
    expect(src).toContain("setShowSecond");
    for (const a of APPEARANCES) expect(en[`settings.appearance.${a}` as keyof typeof en]).toBeTruthy();
    expect(parseAppearance("light")).toBe("light");
    expect(parseAppearance("nonsense")).toBe("dark");
  });
});
