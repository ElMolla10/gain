import React from "react";
import { describe, expect, it, vi } from "vitest";
import { RackEquipmentPresets } from "../src/components/loads/RackEquipmentPresets";
import { IronRackVisualizer } from "../src/components/loads/IronRackVisualizer";
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
vi.mock("../src/haptics", () => ({
  haptics: {
    selection: () => {},
    tick: () => {},
  },
}));
vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    lang: "en",
    unit: "kg",
    unitText: "kg",
    direction: "ltr",
    t: (k: string, p?: Record<string, string | number>) => {
      if (k === "loads.rack.title") return "THE IRON RACK";
      if (k === "loads.rack.presets") return "QUICK EQUIPMENT PRESETS";
      if (k === "loads.rack.preset.db2") return "Commercial DB (2 kg jumps: 10–40)";
      if (k === "loads.rack.preset.db25") return "CrossFit DB (2.5 kg jumps: 10–50)";
      if (k === "loads.rack.preset.db5lb") return "Heavy Iron (5 lb jumps: 20–100)";
      if (k === "loads.rack.preset.bar25") return "Olympic Bar (2.5 kg jumps)";
      if (k === "loads.rack.preset.bar125") return "Micro-Loaded (1.25 kg jumps)";
      if (k === "loads.rack.preset.stack5") return "Pin Stack (5 kg steps: 5–100)";
      if (k === "loads.rack.preset.stack25") return "Precision Stack (2.5 kg steps)";
      if (k === "loads.rack.selected") return "Selected Rung";
      if (k === "loads.rack.stepDelta") return `+${p?.step} ${p?.unit} jump`;
      if (k === "loads.rack.empty") return "Configure or choose a preset to preview the rack.";
      if (k === "loads.rack.rungs") return `${p?.n} rungs configured`;
      if (k === "plates.each") return `Each side: ${p?.plates}`;
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
    danger: "#BA1A1A",
  }),
}));
vi.mock("../src/ui", () => ({
  AppText: "AppText",
}));

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "").replace(/\u00A0/g, " ");

describe("Page 8: The Iron Rack & Loading Precision 10x Components", () => {
  describe("RackEquipmentPresets", () => {
    it("renders dumbbell presets when equipment is dumbbell", () => {
      const onApply = vi.fn();
      const tree = expand(
        React.createElement(RackEquipmentPresets, {
          equipment: "dumbbell",
          unit: "kg",
          onApplyPreset: onApply,
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("QUICK EQUIPMENT PRESETS");
      expect(allTexts).toContain("Commercial DB (2 kg jumps: 10–40)");
      expect(allTexts).toContain("CrossFit DB (2.5 kg jumps: 10–50)");
      expect(allTexts).toContain("Heavy Iron (5 lb jumps: 20–100)");
    });

    it("renders barbell presets when equipment is barbell", () => {
      const onApply = vi.fn();
      const tree = expand(
        React.createElement(RackEquipmentPresets, {
          equipment: "barbell",
          unit: "kg",
          onApplyPreset: onApply,
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("Olympic Bar (2.5 kg jumps)");
      expect(allTexts).toContain("Micro-Loaded (1.25 kg jumps)");
    });

    it("renders selectorized machine stack presets when equipment is machine", () => {
      const onApply = vi.fn();
      const tree = expand(
        React.createElement(RackEquipmentPresets, {
          equipment: "machine",
          unit: "kg",
          onApplyPreset: onApply,
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("Pin Stack (5 kg steps: 5–100)");
      expect(allTexts).toContain("Precision Stack (2.5 kg steps)");
    });
  });

  describe("IronRackVisualizer", () => {
    it("renders configured weight rungs and ladder count", () => {
      const onSelect = vi.fn();
      const values = [20, 22.5, 25, 27.5, 30, 32.5, 35];
      const tree = expand(
        React.createElement(IronRackVisualizer, {
          values,
          invalid: [],
          unit: "kg",
          equipment: "dumbbell",
          selectedLoad: null,
          onSelectLoad: onSelect,
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("THE IRON RACK");
      expect(allTexts).toContain("7 rungs configured");
      expect(allTexts).toContain("20");
      expect(allTexts).toContain("22.5");
      expect(allTexts).toContain("35");
    });

    it("displays selected rung details, jump delta, and plate breakdown for barbell", () => {
      const onSelect = vi.fn();
      const values = [60, 62.5, 65, 70, 72.5];
      const tree = expand(
        React.createElement(IronRackVisualizer, {
          values,
          invalid: [],
          unit: "kg",
          equipment: "barbell",
          selectedLoad: 62.5,
          onSelectLoad: onSelect,
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("Selected Rung: 62.5 kg");
      // Delta from 60 kg -> +2.5 kg jump
      expect(allTexts).toContain("+2.5 kg jump");
      // Olympic plate breakdown for 62.5 kg on a 20 kg bar: (62.5 - 20) / 2 = 21.25 -> 20 + 1.25 each side
      expect(allTexts).toContain("Each side: 20 · 1.25");
    });

    it("renders empty state placeholder when no rungs are configured", () => {
      const onSelect = vi.fn();
      const tree = expand(
        React.createElement(IronRackVisualizer, {
          values: [],
          invalid: [],
          unit: "kg",
          equipment: "dumbbell",
          selectedLoad: null,
          onSelectLoad: onSelect,
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("Configure or choose a preset to preview the rack.");
    });
  });
});
