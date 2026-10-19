import React from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionPostMortemHero } from "../src/components/history/SessionPostMortemHero";
import { ExerciseChronicleCard } from "../src/components/history/ExerciseChronicleCard";
import type { SessionDetail } from "../src/db/historyRepo";
import type { SessionSummary } from "../src/db/finishRepo";
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
      if (k === "history.postmortem.title") return "POST-MORTEM CHRONICLE";
      if (k === "history.postmortem.tonnage") return "Total Tonnage";
      if (k === "history.postmortem.workSets") return "Work Sets";
      if (k === "history.postmortem.warmups") return `+${p?.n} warmups`;
      if (k === "history.postmortem.prs") return "Records Smashed";
      if (k === "history.postmortem.duration") return `${p?.min} min`;
      if (k === "history.postmortem.apexLift") return "APEX LIFT OF SESSION";
      if (k === "history.postmortem.tonnageDist") return "VOLUME DISTRIBUTION";
      if (k === "history.postmortem.topSet") return "TOP SET";
      if (k === "history.record.heaviest") return "🏆 All-Time Heaviest";
      if (k === "history.record.repPr") return `⚡ ${p?.reps}-Rep Record`;
      if (k === "history.record.e1rmPr") return `⭐ New Peak e1RM (${p?.load})`;
      if (k === "history.rirPill") return `RIR ${p?.n}`;
      if (k === "workout.col.set") return "SET";
      if (k === "workout.col.reps") return "REPS";
      if (k === "history.warmup") return "Warm-up";
      if (k === "history.drop") return "Drop set";
      if (k === "history.failure") return "Failure";
      if (k === "tab.history") return "History";
      return k;
    },
  }),
}));
vi.mock("../src/theme", () => ({
  MIN_TOUCH: 48,
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
  Card: "Card",
  BigButton: "BigButton",
  Field: "Field",
  InlineStatus: "InlineStatus",
}));

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

const mockDetail: SessionDetail = {
  id: "s1",
  dayName: "Upper Power A",
  gymName: "Downtown Barbell Club",
  finishedAt: 1700000000000 + 3600000,
  startedAt: 1700000000000,
  pausedMs: 0,
  imported: false,
  exercises: [
    {
      exerciseId: "bench",
      nameEn: "Barbell Bench Press",
      nameAr: "بنش بار حر",
      setup: "barbell",
      measure: "reps",
      sets: [
        { id: "s1_1", exerciseId: "bench", load: 60, reps: 10, rir: null, warmup: true, tags: [], outlierStatus: "none", at: 1000 },
        { id: "s1_2", exerciseId: "bench", load: 90, reps: 6, rir: 2, warmup: false, tags: [], outlierStatus: "none", at: 2000 },
        { id: "s1_3", exerciseId: "bench", load: 100, reps: 5, rir: 1, warmup: false, tags: [], outlierStatus: "none", at: 3000 },
      ],
    },
    {
      exerciseId: "row",
      nameEn: "Barbell Bent-Over Row",
      nameAr: "تجديف بار",
      setup: "barbell",
      measure: "reps",
      sets: [
        { id: "s2_1", exerciseId: "row", load: 80, reps: 8, rir: null, warmup: false, tags: [], outlierStatus: "none", at: 4000 },
        { id: "s2_2", exerciseId: "row", load: 80, reps: 8, rir: null, warmup: false, tags: [], outlierStatus: "none", at: 5000 },
      ],
    },
  ],
};

const mockSummary: SessionSummary = {
  sessionId: "s1",
  totals: { exercises: 2, counted: 4, warmups: 1, unconfirmed: 0, records: 2 },
  exercises: [
    {
      exerciseId: "bench",
      nameEn: "Barbell Bench Press",
      nameAr: "بنش بار حر",
      counted: 2,
      warmups: 1,
      dropSets: 0,
      unconfirmed: 0,
      firstTime: false,
      top: { load: 100, reps: 5 },
      records: ["load", "rep"],
      repPr: { load: 100, reps: 5 },
      estimated1rm: 116.7,
    },
  ],
};

describe("Page 7: Workout Post-Mortem & Heavy Chronicle 10x Components", () => {
  describe("SessionPostMortemHero", () => {
    it("computes total working tonnage, work sets count, duration, and apex lift", () => {
      const tree = expand(
        React.createElement(SessionPostMortemHero, {
          detail: mockDetail,
          summary: mockSummary,
          unit: "kg",
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("POST-MORTEM CHRONICLE");
      expect(allTexts).toContain("Upper Power A");
      expect(allTexts).toContain("Downtown Barbell Club");
      expect(allTexts).toContain("60 min");

      // Total Tonnage: Bench (90*6 + 100*5 = 1040) + Row (80*8 + 80*8 = 1280) = 2320 kg
      expect(allTexts).toContain("2,320");
      expect(allTexts).toContain("Total Tonnage");

      // Work Sets: 4 working sets (+1 warmups)
      expect(allTexts).toContain("4");
      expect(allTexts).toContain("+1 warmups");

      // PRs: 2
      expect(allTexts).toContain("⭐ 2");

      // Apex Lift: 100 kg x 5 on Barbell Bench Press
      expect(allTexts).toContain("APEX LIFT OF SESSION");
      expect(allTexts).toContain("Barbell Bench Press");
      expect(allTexts).toContain("100 kg × 5");

      // Tonnage Distribution
      expect(allTexts).toContain("VOLUME DISTRIBUTION");
    });
  });

  describe("ExerciseChronicleCard", () => {
    it("renders exercise volume, PR badges, and set rows with RIR shown only when logged", () => {
      const tree = expand(
        React.createElement(ExerciseChronicleCard, {
          exercise: mockDetail.exercises[0]!,
          summary: mockSummary.exercises[0]!,
          unit: "kg",
          editing: false,
          editState: null,
          askingId: null,
          errorMessage: null,
          onStartEdit: vi.fn(),
          onSaveEdit: vi.fn(),
          onCancelEdit: vi.fn(),
          onChangeEdit: vi.fn(),
          onAskDelete: vi.fn(),
          onConfirmDelete: vi.fn(),
          onCancelDelete: vi.fn(),
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("Barbell Bench Press");
      // Exercise volume: 90*6 + 100*5 = 1,040 kg
      expect(allTexts).toContain("1,040 kg");

      // Records
      expect(allTexts).toContain("🏆 All-Time Heaviest");
      expect(allTexts).toContain("⚡ 5-Rep Record");

      // Set rows
      expect(allTexts).toContain("60");
      expect(allTexts).toContain("Warm-up");
      expect(allTexts).toContain("90");
      expect(allTexts).toContain("RIR 2");
      expect(allTexts).toContain("100");
      expect(allTexts).toContain("RIR 1");
      expect(allTexts).toContain("⭐"); // Top set indicator
    });

    it("leaves row clean without empty dashes when RIR is null", () => {
      const tree = expand(
        React.createElement(ExerciseChronicleCard, {
          exercise: mockDetail.exercises[1]!, // Rows without RIR
          summary: undefined,
          unit: "kg",
          editing: false,
          editState: null,
          askingId: null,
          errorMessage: null,
          onStartEdit: vi.fn(),
          onSaveEdit: vi.fn(),
          onCancelEdit: vi.fn(),
          onChangeEdit: vi.fn(),
          onAskDelete: vi.fn(),
          onConfirmDelete: vi.fn(),
          onCancelDelete: vi.fn(),
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("Barbell Bent-Over Row");
      expect(allTexts).toContain("80");
      // Does not contain any RIR text since it was null
      expect(allTexts).not.toContain("RIR");
    });
  });
});
