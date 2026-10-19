import React from "react";
import { describe, expect, it, vi } from "vitest";
import { GoalHeroIronCard } from "../src/components/goals/GoalHeroIronCard";
import { StrengthTierRadar } from "../src/components/goals/StrengthTierRadar";
import { RepMaxPowerCurve } from "../src/components/trend/RepMaxPowerCurve";
import { byType, expand, nodes, texts } from "./achievementRender";

vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
}));
vi.mock("react-native-svg", () => ({
  default: "Svg",
  Svg: "Svg",
  Defs: "Defs",
  Ellipse: "Ellipse",
  G: "G",
  LinearGradient: "LinearGradient",
  Rect: "Rect",
  Stop: "Stop",
  Line: "Line",
  Circle: "Circle",
  Text: "Text",
  Path: "Path",
}));
vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    lang: "en",
    unit: "kg",
    unitText: "kg",
    direction: "ltr",
    t: (k: string, p?: Record<string, string | number>) => {
      if (k === "goals.northStar.title") return "THE NORTH STAR";
      if (k === "goals.targetGoal") return `Target Milestone: ${p?.target}`;
      if (k === "goals.bar.goal") return "TARGET BAR";
      if (k === "goals.bar.current") return "CURRENT RECORD";
      if (k === "plates.each") return `Each side: ${p?.plates}`;
      if (k === "plates.bar") return "Empty bar";
      if (k === "goals.deltaEarn") return `${p?.delta} needed to unlock`;
      if (k === "goals.milestoneReached") return "Milestone Reached! Outstanding work.";
      if (k === "goals.progressPercent") return `${p?.percent}% of milestone`;
      if (k === "goals.projectedDate") return `Target: ${p?.date}`;
      if (k === "goals.milestones.title") return "CHECKPOINT MILESTONES";
      if (k === "goals.pace.ahead") return "Ahead of Schedule";
      if (k === "goals.pace.onPace") return "On Pace";
      if (k === "goals.pace.behind") return "Needs Focus";
      if (k === "goals.pace.maintaining") return "Maintaining";
      if (k === "goals.strengthTier.title") return "ATHLETIC STRENGTH TIER";
      if (k === "goals.tier.novice") return "Novice";
      if (k === "goals.tier.intermediate") return "Intermediate";
      if (k === "goals.tier.proficient") return "Proficient";
      if (k === "goals.tier.advanced") return "Advanced";
      if (k === "goals.tier.elite") return "Elite";
      if (k === "goals.bodyweightRatio") return "Bodyweight";
      if (k === "goals.bw") return "BW";
      if (k === "trend.powerCurve.title") return "REP MAX POWER CURVE";
      if (k === "trend.powerCurve.subtitle") return "Strength Profile by Rep Range";
      if (k === "trend.peakE1rm") return "Peak e1RM";
      if (k === "trend.calcE1rm") return `e1RM: ${p?.load}`;
      if (k === "trend.powerCurve.insight") return `Your strongest potential was unlocked at ${p?.reps} reps (${p?.load} e1RM).`;
      return k;
    },
  }),
}));
vi.mock("../src/theme", () => ({
  radius: { button: 8, card: 12, pill: 24 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
  useIsDark: () => false,
  usePalette: () => ({
    accent: "#3C5700",
    tint: "#EBF5D0",
    border: "#E0E0E0",
    card: "#FFFFFF",
    text: "#111111",
    muted: "#666666",
    raised: "#F5F5F5",
  }),
}));
vi.mock("../src/ui", () => ({
  AppText: "AppText",
}));

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

describe("Page 6: Goals & Lift Trend 10x Components", () => {
  describe("GoalHeroIronCard", () => {
    it("renders exercise name, target e1RM, plate breakdown, and pace status", () => {
      const tree = expand(
        React.createElement(GoalHeroIronCard, {
          exerciseName: "Barbell Back Squat",
          currentE1rm: 120,
          targetE1rm: 140,
          unit: "kg",
          projectedDate: "2026-12-01",
          paceStatus: "ahead",
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("THE NORTH STAR");
      expect(allTexts).toContain("Ahead of Schedule");
      expect(allTexts).toContain("Barbell Back Squat");
      expect(allTexts).toContain("Target Milestone: 140 kg");
      expect(allTexts).toContain("TARGET BAR (140 kg)");
      expect(allTexts).toContain("CURRENT RECORD (120 kg e1RM)");
      // Delta
      expect(allTexts).toContain("+20 kg needed to unlock");
      // Progress
      expect(allTexts).toContain("86% of milestone");
      // Checkpoints ladder
      expect(allTexts).toContain("CHECKPOINT MILESTONES");
      expect(allTexts).toContain("✓ 120 kg");
      expect(allTexts).toContain("⭐ 140 kg");
    });

    it("displays milestone reached message when target load is met or exceeded", () => {
      const tree = expand(
        React.createElement(GoalHeroIronCard, {
          exerciseName: "Deadlift",
          currentE1rm: 200,
          targetE1rm: 200,
          unit: "kg",
          paceStatus: "on_pace",
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("Milestone Reached! Outstanding work.");
      expect(allTexts).toContain("100% of milestone");
    });
  });

  describe("StrengthTierRadar", () => {
    it("returns null if bodyweight is not provided or zero", () => {
      const tree1 = expand(
        React.createElement(StrengthTierRadar, {
          currentE1rm: 100,
          bodyweightKg: null,
          unit: "kg",
        })
      );
      expect(tree1).toBeNull();

      const tree2 = expand(
        React.createElement(StrengthTierRadar, {
          currentE1rm: 100,
          bodyweightKg: 0,
          unit: "kg",
        })
      );
      expect(tree2).toBeNull();
    });

    it("calculates ratio and classifies athlete into the correct tier", () => {
      // 80kg lifter with 120kg squat -> 1.5x BW -> Advanced (1.45 < ratio <= 1.8)
      const tree = expand(
        React.createElement(StrengthTierRadar, {
          currentE1rm: 120,
          bodyweightKg: 80,
          unit: "kg",
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("ATHLETIC STRENGTH TIER");
      expect(allTexts).toContain("Advanced · 1.5× Bodyweight");
      expect(allTexts).toContain("80 kg BW");
      expect(allTexts).toContain("Novice");
      expect(allTexts).toContain("Elite");
    });

    it("correctly identifies Elite tier when ratio exceeds 1.8x", () => {
      // 70kg lifter with 160kg squat -> 2.29x BW -> Elite
      const tree = expand(
        React.createElement(StrengthTierRadar, {
          currentE1rm: 160,
          bodyweightKg: 70,
          unit: "kg",
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("Elite · 2.29× Bodyweight");
    });
  });

  describe("RepMaxPowerCurve", () => {
    it("returns null when repMaxes array is empty", () => {
      const tree = expand(
        React.createElement(RepMaxPowerCurve, {
          repMaxes: [],
          unit: "kg",
        })
      );
      expect(tree).toBeNull();
    });

    it("renders rep max bars, calculates Brzycki e1RMs, and highlights peak potential", () => {
      const repMaxes = [
        { reps: 1, set: { load: 100, reps: 1, at: 1000 } }, // e1rm = 100
        { reps: 3, set: { load: 95, reps: 3, at: 2000 } },  // e1rm = 95 * 36 / 34 = 100.6
        { reps: 5, set: { load: 92.5, reps: 5, at: 3000 } }, // e1rm = 92.5 * 36 / 32 = 104.1 (Peak!)
        { reps: 8, set: { load: 80, reps: 8, at: 4000 } },  // e1rm = 80 * 36 / 29 = 99.3
      ];

      const tree = expand(
        React.createElement(RepMaxPowerCurve, {
          repMaxes,
          unit: "kg",
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("REP MAX POWER CURVE");
      expect(allTexts).toContain("Strength Profile by Rep Range");
      expect(allTexts).toContain("Peak e1RM");
      expect(allTexts).toContain("1RM: 100 kg");
      expect(allTexts).toContain("3RM: 95 kg");
      expect(allTexts).toContain("5RM: 92.5 kg");
      expect(allTexts).toContain("8RM: 80 kg");
      // Untapped potential callout highlighting 5 reps peak
      expect(allTexts).toContain("Your strongest potential was unlocked at 5 reps");
      expect(allTexts).toContain("104.1 kg e1RM");
    });
  });
});
