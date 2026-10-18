import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import { paceGlyph, pickDecision } from "../src/logic/todayWeek";
import { byType, expand, texts } from "./achievementRender";

const svc = vi.hoisted(() => ({
  getPulse: vi.fn(async () => ({ weekStart: "2026-10-12", qualifiedDays: 1, dayTarget: 2, qualified: false })),
  getHome: vi.fn(async () => { throw new Error("Today must never call getHome"); }),
}));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig(), { useContext: () => null }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable" }));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: (cb: () => void) => cb() }));
vi.mock("../src/AppContext", () => ({
  useServices: () => ({
    achievements: { getPulse: svc.getPulse, getHome: svc.getHome },
    history: { getPersonalProgress: async () => ({ done: 1, goal: 4, level: 5 }) },
    weekly: { getDue: async () => null },
    deload: { getState: async () => ({ status: "none" }) },
    weeklyPlan: { getActive: async () => null },
  }),
}));
vi.mock("../src/diagnostics", () => ({ diagnostics: { record: () => {} } }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: "en", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate("en", k, p) }) }));
vi.mock("../src/theme", () => ({ MIN_TOUCH: 48, radius: { button: 12 }, space: { xs: 4, sm: 8 }, type: { label: 14 }, usePalette: () => ({ muted: "muted", raised: "raised" }) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", Sheet: "Sheet" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/components/DeloadCard", () => ({ DeloadCard: "DeloadCard" }));
vi.mock("../src/components/MuscleVolumeCard", () => ({ MuscleVolumeCard: "MuscleVolumeCard" }));
vi.mock("../src/components/PeriodizationCard", () => ({ PeriodizationCard: "PeriodizationCard" }));
vi.mock("../src/components/WeeklyReviewCard", () => ({ WeeklyReviewCard: "WeeklyReviewCard" }));
vi.mock("../src/components/achievements/WeekSleeve", () => ({ WeekSleeve: "WeekSleeve" }));

import { WeekBlock } from "../src/components/today/WeekBlock";

describe("This week on Today", () => {
  it("reads the cheap pulse query and never getHome", async () => {
    const tree = expand(React.createElement(WeekBlock, { pace: "↗ Bench press: ahead of pace", onPace: () => {} }));
    await new Promise((r) => setTimeout(r, 0));
    expect(svc.getPulse).toHaveBeenCalledTimes(1);
    expect(svc.getHome).not.toHaveBeenCalled();
    expect(texts(tree)).toContain("This week's sets by muscle");
    expect(byType(tree, "Sheet")).toHaveLength(1);
  });
  it("no Today file references getHome or the badge level", () => {
    const src = join(__dirname, "..", "src");
    const files = [join(src, "screens", "TodayScreen.tsx"), ...readdirSync(join(src, "components", "today")).map((f) => join(src, "components", "today", f))];
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/\bgetHome\b/);
      expect(s, f).not.toMatch(/progress\.badge|PersonalProgressCard/);
    }
  });
  it("one decision card, by priority: weekly > deload offer > plan active > periodization", () => {
    expect(pickDecision({ weeklyDue: true, deloadStatus: "suggested", planActive: true })).toBe("weekly");
    expect(pickDecision({ weeklyDue: false, deloadStatus: "suggested", planActive: true })).toBe("deload");
    expect(pickDecision({ weeklyDue: false, deloadStatus: "load", planActive: true })).toBe("planActive");
    expect(pickDecision({ weeklyDue: false, deloadStatus: null, planActive: false })).toBe("periodization");
  });
  it("pace glyphs mirror in Arabic except ◌ and ✓", () => {
    expect(paceGlyph("ahead", "en")).toBe("↗");
    expect(paceGlyph("ahead", "ar")).toBe("↖");
    expect(paceGlyph("behind", "ar")).toBe("↙");
    expect(paceGlyph("on_pace", "ar")).toBe("←");
    expect(paceGlyph("too_thin", "ar")).toBe("◌");
    expect(paceGlyph("reached", "ar")).toBe("✓");
  });
});
