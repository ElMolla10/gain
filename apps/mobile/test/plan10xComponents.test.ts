import React from "react";
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

vi.mock("../src/haptics", () => ({
  haptics: {
    selection: vi.fn(),
  },
}));

vi.mock("../src/theme", () => ({
  MIN_TOUCH: 48,
  radius: { card: 12, pill: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16 },
  type: { section: 20, label: 14, body: 15, caption: 12 },
  usePalette: () => ({
    tint: "tint",
    raised: "raised",
    accent: "accent",
    edge: "edge",
    muted: "muted",
    text: "text",
  }),
}));

vi.mock("../src/ui", () => ({
  AppText: "AppText",
  Card: "Card",
  QuietAction: (props: any) => React.createElement("QuietAction", props),
}));

import { PlanDayStrip, type PlanDayItem } from "../src/components/PlanDayStrip";
import { PlanMuscleRadar } from "../src/components/PlanMuscleRadar";
import type { ExposureRow } from "../src/logic/exposure";

describe("Plan 10x Components", () => {
  describe("PlanDayStrip", () => {
    it("returns null when days array is empty", () => {
      const tree = PlanDayStrip({ days: [], selectedIndex: null, onSelect: vi.fn() });
      expect(tree).toBeNull();
    });

    it("renders horizontal day items with names and set counts", () => {
      const days: PlanDayItem[] = [
        { name: "Upper A", exerciseCount: 5, setsCount: 16 },
        { name: "Lower A", exerciseCount: 4, setsCount: 14 },
      ];
      const tree = PlanDayStrip({ days, selectedIndex: 0, onSelect: vi.fn() });
      expect(tree).not.toBeNull();
      const str = JSON.stringify(tree);
      expect(str).toContain("Upper A");
      expect(str).toContain("Lower A");
      expect(str).toContain("⁦16⁩");
      expect(str).toContain('"selected":true');
    });
  });

  describe("PlanMuscleRadar", () => {
    it("returns null when exposure rows are empty or have 0 sets", () => {
      expect(PlanMuscleRadar({ rows: [] })).toBeNull();
      const zeroRows: ExposureRow[] = [
        { group: "chest", setsPerWeek: 0, sessionsPerWeek: 0, setsPerRotation: 0, daysPerRotation: 0 },
      ];
      expect(PlanMuscleRadar({ rows: zeroRows })).toBeNull();
    });

    it("renders volume bars for active muscle groups with localized names", () => {
      const rows: ExposureRow[] = [
        { group: "chest", setsPerWeek: 12, sessionsPerWeek: 2, setsPerRotation: 12, daysPerRotation: 2 },
        { group: "back", setsPerWeek: 14, sessionsPerWeek: 2, setsPerRotation: 14, daysPerRotation: 2 },
      ];
      const onOpen = vi.fn();
      const tree = PlanMuscleRadar({ rows, onOpenExposure: onOpen });
      expect(tree).not.toBeNull();
      const str = JSON.stringify(tree);
      expect(str).toContain("prog.volumeRadar.title");
      expect(str).toContain("muscle.chest");
      expect(str).toContain("muscle.back");
      expect(str).toContain("12");
      expect(str).toContain("14");
    });
  });
});
