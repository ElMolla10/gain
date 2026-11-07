import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tabBarLayout } from "../src/logic/tabBarLayout";

describe("tab bar contains its icon and scaled labels", () => {
  it("sets the navigator's measured container height, rather than overflowing an item minimum", () => {
    const app = readFileSync(join(__dirname, "../App.tsx"), "utf8");
    const barStyle = app.match(/tabBarStyle:\s*\{([^}]*)\}/)?.[1];
    expect(barStyle).toMatch(/\bheight:\s*tabLayout.height/);
    expect(app).toContain("tabBarLayout(fontScale, insets.bottom, lang === \"ar\")");
    expect(app).toContain('tabBarLabelPosition: "below-icon"');
  });

  it.each([1, 1.2, 1.5, 2])("contains a 32 dp icon and scaled labels at %sx text on SE and notched phones", (fontScale) => {
    for (const bottom of [0, 34]) for (const arabic of [false, true]) {
      const layout = tabBarLayout(fontScale, bottom, arabic);
      // AppText's actual 13 dp font has 18 dp Latin / 21 dp Arabic line boxes; scaling is capped at 1.4.
      const textHeight = (fontScale > 1.2 ? 2 : 1) * (arabic ? 21 : 18) * Math.min(fontScale, 1.4);
      expect(layout.itemHeight).toBeGreaterThanOrEqual(32 + textHeight + 10);
      expect(layout.height - bottom - layout.paddingTop - 1).toBeGreaterThanOrEqual(layout.itemHeight);
      const screenBottom = 667;
      const itemBottom = screenBottom - layout.height + layout.paddingTop + 1 + layout.itemHeight;
      expect(itemBottom).toBeLessThanOrEqual(screenBottom - bottom);
    }
  });

  it("adds a home-indicator inset once and matches the label's existing 1.4 scale cap", () => {
    expect(tabBarLayout(1, 34, false).height - tabBarLayout(1, 0, false).height).toBe(34);
    expect(tabBarLayout(1.5, 0, true)).toEqual(tabBarLayout(2, 0, true));
    expect(tabBarLayout(1.5, 0, true).height).toBeGreaterThan(tabBarLayout(1, 0, true).height);
  });

  it("keeps the standard bar compact and reserves taller Arabic glyphs", () => {
    expect(tabBarLayout(1, 0, false).height).toBe(65);
    expect(tabBarLayout(1, 0, true).height).toBe(68);
    expect(tabBarLayout(1, 0, true).itemHeight).toBeGreaterThan(tabBarLayout(1, 0, false).itemHeight);
  });
});
