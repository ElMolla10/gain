import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
}));

vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    lang: "en",
    unit: "kg",
    t: (key: string, params?: Record<string, string | number>) => {
      if (params) {
        let str = key;
        for (const [k, v] of Object.entries(params)) {
          str += ` ${k}=${v}`;
        }
        return str;
      }
      return key;
    },
  }),
}));

vi.mock("../src/theme", () => ({
  radius: { card: 12, button: 10, pill: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  type: { section: 20, label: 14, body: 15, caption: 12 },
  usePalette: () => ({
    tint: "tint",
    raised: "raised",
    accent: "accent",
    fill: "fill",
    fillEdge: "fillEdge",
    edge: "edge",
    muted: "muted",
    text: "text",
    border: "border",
  }),
}));

vi.mock("../src/ui", () => ({
  AppText: (props: any) => React.createElement("AppText", props, props.children),
  Card: (props: any) => React.createElement("Card", props, props.children),
}));

vi.mock("../src/components/Icon", () => ({
  Icon: (props: any) => React.createElement("Icon", props),
}));

import { ProgressRhythmSleeve, rhythmDayKey, type RhythmSession } from "../src/components/ProgressRhythmSleeve";
import { ar, en } from "../src/i18n/strings";

describe("Page 3 History 10x Components", () => {
  describe("rhythmDayKey logical day rollover", () => {
    it("rolls over at 04:00 AM: a 02:00 AM session belongs to previous evening", () => {
      const earlyMorning = new Date(2026, 9, 19, 2, 0).getTime();
      const midday = new Date(2026, 9, 19, 14, 0).getTime();
      expect(rhythmDayKey(earlyMorning)).toBe("2026-10-18");
      expect(rhythmDayKey(midday)).toBe("2026-10-19");
    });
  });

  describe("ProgressRhythmSleeve", () => {
    const fixedNow = new Date(2026, 9, 28, 12, 0).getTime();

    it("titles the card Workouts in English and التمارين in Arabic", () => {
      expect(en["history.rhythm.title"]).toBe("Workouts");
      expect(ar["history.rhythm.title"]).toBe("التمارين");
    });

    it("the footnote is only the 28-day count, singular or plural, with no adaptation line", () => {
      expect(en["history.rhythm.subtext.one"]).toBe("{count} session in last 28 days");
      expect(en["history.rhythm.subtext.few"]).toBe("{count} sessions in last 28 days");
      expect(ar["history.rhythm.subtext.one"]).toBe("{count} تمرينة في آخر 28 يوم");
      expect(ar["history.rhythm.subtext.few"]).toBe("{count} تمرينات في آخر 28 يوم");
      expect("history.rhythm.subtext" in en).toBe(false);
      expect(en["history.rhythm.subtext.one"]).not.toMatch(/adaptation|Rest fuels/i);
      expect(ar["history.rhythm.subtext.one"]).not.toContain("الراحة أساس");
    });

    it("renders empty rhythm state with zero cadence", () => {
      const tree = ProgressRhythmSleeve({ sessions: [], now: fixedNow });
      expect(tree).not.toBeNull();
      const str = JSON.stringify(tree);
      expect(str).toContain("history.rhythm.title");
      expect(str).toContain("history.rhythm.empty");
      expect(str).toContain("history.rhythm.a11y workouts=0");
    });

    it("computes accurate weekly cadence from sessions in the 28-day window", () => {
      // 8 workouts across the 28 days = (8 / 28) * 7 = 2.0 / week
      const sessions: RhythmSession[] = [];
      for (let i = 0; i < 8; i++) {
        sessions.push({
          finishedAt: fixedNow - i * 3 * 86_400_000,
          pr: i === 0,
        });
      }
      const tree = ProgressRhythmSleeve({ sessions, now: fixedNow });
      const str = JSON.stringify(tree);
      expect(str).toContain("history.rhythm.cadence");
      expect(str).toContain("history.rhythm.subtext.few");
      expect(str).toContain("8");
      expect(str).toContain("history.rhythm.a11y workouts=8");
      expect(str).toContain('"backgroundColor":"fill"'); // PR day has fill
      expect(str).toContain('"backgroundColor":"text"'); // Regular workout has text
    });

    it("uses the singular footnote for one session in the window", () => {
      const tree = ProgressRhythmSleeve({ sessions: [{ finishedAt: fixedNow - 86_400_000 }], now: fixedNow });
      const str = JSON.stringify(tree);
      expect(str).toContain("history.rhythm.subtext.one");
      expect(str).not.toContain("history.rhythm.subtext.few");
    });
  });

  describe("HistoryScreen Layout Structure", () => {
    const f = readFileSync(join(__dirname, "..", "src", "screens", "HistoryScreen.tsx"), "utf8");

    it("places ProgressRhythmSleeve first, then SegmentedTabs, with no Cabinet or Ledger entry", () => {
      const rhythmIndex = f.indexOf("<ProgressRhythmSleeve");
      const tabsIndex = f.indexOf("<SegmentedTabs");
      expect(rhythmIndex).toBeGreaterThan(0);
      expect(tabsIndex).toBeGreaterThan(rhythmIndex);
      expect(f).not.toContain("CabinetEntry");
      expect(f).not.toContain('navigate("Ledger"');
    });

    it("renders StatTileRow with lifetime engine metrics", () => {
      expect(f).toContain("<StatTileRow");
      expect(f).toContain('label: t("history.lifetime.sessions")');
      expect(f).toContain('label: t("history.lifetime.sets")');
      expect(f).toContain('label: t("history.lifetime.prs")');
    });
  });
});
