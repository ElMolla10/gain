import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
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
    impact: vi.fn(),
    notification: vi.fn(),
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
}));

vi.mock("../src/components/Icon", () => ({
  Icon: (props: any) => React.createElement("Icon", props),
}));

import { FinishMuscleStrip, type MuscleSetCount } from "../src/components/FinishMuscleStrip";
import { FinishRpeCheck, type RpeOption } from "../src/components/FinishRpeCheck";
import { FinishHeroPlaque } from "../src/components/FinishHeroPlaque";

describe("Finish 10x Components", () => {
  describe("FinishMuscleStrip", () => {
    it("returns null when counts array is empty", () => {
      const tree = FinishMuscleStrip({ counts: [] });
      expect(tree).toBeNull();
    });

    it("renders chips with muscle names and isolated counts", () => {
      const counts: MuscleSetCount[] = [
        { group: "chest", sets: 6 },
        { group: "back", sets: 4 },
      ];
      const tree = FinishMuscleStrip({ counts });
      expect(tree).not.toBeNull();
      const str = JSON.stringify(tree);
      expect(str).toContain("muscle.chest");
      expect(str).toContain("muscle.back");
      expect(str).toContain("⁦6⁩");
      expect(str).toContain("⁦4⁩");
    });
  });

  describe("FinishRpeCheck", () => {
    it("renders the 3 perception options: smooth, target, heavy", () => {
      const onChange = vi.fn();
      const tree = FinishRpeCheck({ value: null, onChange });
      const str = JSON.stringify(tree);
      expect(str).toContain("finish.rpe.title");
      expect(str).toContain("finish.rpe.smooth");
      expect(str).toContain("finish.rpe.target");
      expect(str).toContain("finish.rpe.heavy");
    });

    it("marks the selected option", () => {
      const tree = FinishRpeCheck({ value: "target", onChange: vi.fn() });
      const str = JSON.stringify(tree);
      expect(str).toContain('"selected":true');
    });
  });

  describe("FinishHeroPlaque", () => {
    it("renders PR plaque with trophy when personal bests exist", () => {
      const tree = FinishHeroPlaque({
        pbLines: ["Bench Press — Heaviest load: 100 kg"],
        milestones: ["Target reached"],
        countedSets: 12,
      });
      const str = JSON.stringify(tree);
      expect(str).toContain("recap.personalBests");
      expect(str).toContain("Bench Press");
      expect(str).toContain('"name":"trophy"');
      expect(str).toContain("Target reached");
    });

    it("renders Consistency Ledger Stamp when no PRs but working sets exist", () => {
      const tree = FinishHeroPlaque({
        pbLines: [],
        milestones: [],
        countedSets: 16,
      });
      const str = JSON.stringify(tree);
      expect(str).toContain("finish.heroPlaque.bankedTitle");
      expect(str).toContain('"name":"check"');
      expect(str).toContain("n=16");
    });

    it("renders quiet empty state when 0 sets counted", () => {
      const tree = FinishHeroPlaque({
        pbLines: [],
        milestones: [],
        countedSets: 0,
      });
      const str = JSON.stringify(tree);
      expect(str).toContain("recap.noPbs");
    });
  });
});
