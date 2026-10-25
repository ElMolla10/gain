import React from "react";
import { describe, expect, it, vi } from "vitest";
import { BarbellRunway } from "../src/components/today/BarbellRunway";
import { EngineStrategyCard } from "../src/components/today/EngineStrategyCard";
import { SetMicroSteppers } from "../src/components/workout/SetMicroSteppers";
import { byType, expand, nodes, texts } from "./achievementRender";

vi.mock("../src/haptics", () => ({ haptics: { tick: () => {}, untick: () => {}, selection: () => {}, unrack: () => {} } }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
}));
vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    lang: "en",
    unit: "kg",
    unitText: "kg",
    direction: "ltr",
    t: (k: string, p?: Record<string, string | number>) => {
      if (k === "today.runway.title") return "WARMUP RUNWAY";
      if (k === "today.runway.warmup") return "Warmup";
      if (k === "today.runway.top") return "Top Work Set";
      if (k === "today.emptyBar") return "Empty bar";
      if (k === "today.strategy.title") return "Engine Strategy";
      if (k === "today.strategy.unlock") return `Target: ${p?.target} to progress`;
      if (k === "workout.whyShort") return "Why";
      if (k === "workout.help.button") return "Why this weight";
      if (k === "workout.stepper.loadDown") return `-${p?.n} ${p?.unit}`;
      if (k === "workout.stepper.loadUp") return `+${p?.n} ${p?.unit}`;
      if (k === "workout.stepper.repsDown") return "-1 rep";
      if (k === "workout.stepper.repsUp") return "+1 rep";
      if (k === "workout.rir.label") return "RIR";
      return k;
    },
  }),
}));
vi.mock("../src/theme", () => ({
  radius: { button: 8, card: 12, pill: 24 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
  usePalette: () => ({
    accent: "#3C5700",
    tint: "#EBF5D0",
    border: "#E0E0E0",
    card: "#FFFFFF",
    text: "#111111",
    muted: "#666666",
    raised: "#F5F5F5",
  }),
  useLogPalette: () => ({
    text: "#111111",
    muted: "#666666",
    edge: "#CCCCCC",
    line: "#EEEEEE",
    field: "#FAFAFA",
    accent: "#3C5700",
  }),
}));
vi.mock("../src/ui", () => ({
  AppText: "AppText",
  QuietAction: "QuietAction",
}));

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "").replace(/\u00A0/g, " ");

describe("Page 5: Today Screen & Active Workout Logger 10x Components", () => {
  describe("BarbellRunway", () => {
    const warmups = [
      { load: 20, reps: 10, perSide: [] },
      { load: 60, reps: 5, perSide: [20] },
      { load: 85, reps: 3, perSide: [20, 12.5] },
    ];

    it("renders each warmup progression node and the top work set", () => {
      const onSelect = vi.fn();
      const tree = expand(
        React.createElement(BarbellRunway, {
          warmups,
          topLoad: 100,
          topReps: 8,
          unit: "kg",
          selectedStepIndex: -1,
          onSelectStep: onSelect,
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("WARMUP RUNWAY");
      expect(allTexts).toContain("Empty bar × 10");
      expect(allTexts).toContain("60 kg × 5");
      expect(allTexts).toContain("85 kg × 3");
      expect(allTexts).toContain("100 kg × 8");
    });

    it("calls onSelectStep with correct index when a node is tapped", () => {
      const onSelect = vi.fn();
      const tree = expand(
        React.createElement(BarbellRunway, {
          warmups,
          topLoad: 100,
          topReps: 8,
          unit: "kg",
          selectedStepIndex: -1,
          onSelectStep: onSelect,
        })
      );

      const buttons = nodes(tree).filter((n) => n.props.accessibilityRole === "button");
      expect(buttons.length).toBe(4); // 3 warmups + 1 top work set

      // Tap first warmup
      buttons[0]!.props.onPress();
      expect(onSelect).toHaveBeenCalledWith(0);

      // Tap top work set
      buttons[3]!.props.onPress();
      expect(onSelect).toHaveBeenCalledWith(-1);
    });

    it("applies selected styling to the active node", () => {
      const tree = expand(
        React.createElement(BarbellRunway, {
          warmups,
          topLoad: 100,
          topReps: 8,
          unit: "kg",
          selectedStepIndex: 1,
          onSelectStep: vi.fn(),
        })
      );

      const buttons = nodes(tree).filter((n) => n.props.accessibilityRole === "button");
      expect(buttons[1]!.props.accessibilityState).toEqual({ selected: true });
      expect(buttons[0]!.props.accessibilityState).toEqual({ selected: false });
    });
  });

  describe("EngineStrategyCard", () => {
    it("renders progressive overload target and reason brief", () => {
      const onWhy = vi.fn();
      const tree = expand(
        React.createElement(EngineStrategyCard, {
          leadName: "Barbell Bench Press",
          targetLoad: 100,
          targetReps: 8,
          unit: "kg",
          reasonText: "+2.5 kg earned after 3x8 @ RPE 7 last week",
          lastTimeText: "Last time: 97.5 kg x 8, 8, 7",
          isGoal: true,
          onWhy,
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("Engine Strategy");
      expect(allTexts).toContain("Target: 100 kg × 8 to progress");
      expect(allTexts).toContain("+2.5 kg earned after 3x8 @ RPE 7 last week");
      expect(allTexts).toContain("Last time: 97.5 kg x 8, 8, 7");

      const quiet = byType(tree, "QuietAction");
      expect(quiet.length).toBe(1);
      quiet[0]!.props.onPress();
      expect(onWhy).toHaveBeenCalled();
    });
  });

  describe("SetMicroSteppers", () => {
    it("renders load and rep steppers and triggers adjustment callbacks", () => {
      const onAdjustLoad = vi.fn();
      const onAdjustReps = vi.fn();
      const onSetRir = vi.fn();

      const tree = expand(
        React.createElement(SetMicroSteppers, {
          load: 100,
          reps: 8,
          unit: "kg",
          rir: 2,
          trackEffort: true,
          onAdjustLoad,
          onAdjustReps,
          onSetRir,
        })
      );

      const buttons = nodes(tree).filter((n) => n.props.accessibilityRole === "button");
      // 2 load steppers + 2 rep steppers + 4 RIR chips = 8 buttons
      expect(buttons.length).toBe(8);

      // Test load down (-2.5)
      buttons[0]!.props.onPress();
      expect(onAdjustLoad).toHaveBeenCalledWith(-2.5);

      // Test load up (+2.5)
      buttons[1]!.props.onPress();
      expect(onAdjustLoad).toHaveBeenCalledWith(2.5);

      // Test reps down (-1)
      buttons[2]!.props.onPress();
      expect(onAdjustReps).toHaveBeenCalledWith(-1);

      // Test reps up (+1)
      buttons[3]!.props.onPress();
      expect(onAdjustReps).toHaveBeenCalledWith(1);

      // Test RIR selection: tap RIR 1
      buttons[5]!.props.onPress();
      expect(onSetRir).toHaveBeenCalledWith(1);
    });

    it("uses 5 lb step when unit is lb", () => {
      const onAdjustLoad = vi.fn();
      const tree = expand(
        React.createElement(SetMicroSteppers, {
          load: 225,
          reps: 5,
          unit: "lb",
          rir: null,
          trackEffort: false,
          onAdjustLoad,
          onAdjustReps: vi.fn(),
          onSetRir: vi.fn(),
        })
      );

      const buttons = nodes(tree).filter((n) => n.props.accessibilityRole === "button");
      buttons[0]!.props.onPress();
      expect(onAdjustLoad).toHaveBeenCalledWith(-5);
      buttons[1]!.props.onPress();
      expect(onAdjustLoad).toHaveBeenCalledWith(5);
    });
  });
});
