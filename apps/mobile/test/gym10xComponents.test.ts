import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));

vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Alert: { alert: vi.fn() },
}));

vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    lang: "en",
    unit: "kg",
    unitText: "kg",
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
    celebrate: vi.fn(),
  },
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
  useIsDark: () => true,
}));

vi.mock("../src/ui", () => ({
  AppText: (props: any) => React.createElement("AppText", props, props.children),
  Card: (props: any) => React.createElement("Card", props, props.children),
  BigButton: (props: any) => React.createElement("BigButton", props),
  Field: (props: any) => React.createElement("Field", props),
  SegmentedTabs: (props: any) => React.createElement("SegmentedTabs", props),
  LoadingState: () => React.createElement("LoadingState"),
  Screen: (props: any) => React.createElement("Screen", props, props.children),
}));

vi.mock("../src/components/today/BarArt", () => ({
  BarArt: (props: any) => React.createElement("BarArt", props),
}));

vi.mock("../src/components/today/RackRow", () => ({
  RackGlyph: (props: any) => React.createElement("RackGlyph", props),
  glyphFor: (eq: string) => eq,
}));

import { BarbellPlateStudio } from "../src/components/BarbellPlateStudio";
import type { GymLoadSpec } from "@gain/engine";

describe("Page 4 Gyms & Equipment 10x Components", () => {
  const standardBar: GymLoadSpec = {
    equipment: "barbell",
    increment: 2.5,
    min: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  };

  describe("BarbellPlateStudio", () => {
    it("renders dual-mode selector and Olympic plate total weight", () => {
      const tree = BarbellPlateStudio({ spec: standardBar });
      expect(tree).not.toBeNull();
      const str = JSON.stringify(tree);
      expect(str).toContain("plates.mode.target");
      expect(str).toContain("plates.mode.tally");
      expect(str).toContain("plates.totalWeight");
      expect(str).toContain('"perSide":[25,15]');
    });

    it("renders Bar tare weight selector options", () => {
      const tree = BarbellPlateStudio({ spec: standardBar });
      const str = JSON.stringify(tree);
      expect(str).toContain("plates.bar.mens");
      expect(str).toContain("plates.bar.womens");
      expect(str).toContain("plates.bar.power");
      expect(str).toContain("plates.bar.ez");
    });

    it("renders quick adjustment steppers in target mode", () => {
      const tree = BarbellPlateStudio({ spec: standardBar });
      const str = JSON.stringify(tree);
      expect(str).toContain("10");
      expect(str).toContain("2.5");
    });
  });

  describe("GymsScreen Layout Structure", () => {
    const f = readFileSync(join(__dirname, "..", "src", "screens", "GymsScreen.tsx"), "utf8");

    it("renders Active Sanctuary badge and forged session counter", () => {
      expect(f).toContain('t("gyms.activeSanctuary")');
      expect(f).toContain('t("gyms.forgedSessions"');
      expect(f).toContain("RackGlyph");
    });

    it("offers quick archetype presets for commercial, powerlifting, and garage gyms", () => {
      expect(f).toContain("createFromPreset");
      expect(f).toContain('"commercial"');
      expect(f).toContain('"powerlifting"');
      expect(f).toContain('"garage"');
    });

    it("links directly to the Barbell Plate Studio for the active gym", () => {
      expect(f).toContain('label={t("plates.studio")}');
      expect(f).toContain('nav.navigate("PlateCalc")');
    });
  });

  describe("GymEditScreen Arsenal Studio", () => {
    const f = readFileSync(join(__dirname, "..", "src", "screens", "GymEditScreen.tsx"), "utf8");

    it("provides interactive plate denomination palette toggles", () => {
      expect(f).toContain("togglePlateDenomination");
      expect(f).toContain('t("gyms.platePalette.title")');
      expect(f).toContain("KG_DENOMINATIONS");
    });

    it("offers dumbbell rack presets for standard, heavy, and home", () => {
      expect(f).toContain("applyDumbbellPreset");
      expect(f).toContain('t("gyms.dbRack.title")');
      expect(f).toContain('"standard"');
      expect(f).toContain('"heavy"');
      expect(f).toContain('"home"');
    });
  });
});
