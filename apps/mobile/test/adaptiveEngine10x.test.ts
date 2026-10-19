import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ShortWeekImpactCard } from "../src/components/coach/ShortWeekImpactCard";
import { MusclePriorityGrid } from "../src/components/coach/MusclePriorityGrid";
import { GeneratedProgrammeHero } from "../src/components/coach/GeneratedProgrammeHero";
import type { ShortWeekPreview, ActiveShortWeek } from "../src/db/shortWeekRepo";
import type { GeneratedProgramme } from "../src/logic/programGenerator";
import type { LibraryExercise } from "../src/db/programmeRepo";
import { expand, nodes, texts } from "./achievementRender";

vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: {
    create: (styles: any) => styles,
    hairlineWidth: 1,
  },
}));
vi.mock("../src/theme", () => ({
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  usePalette: () => ({
    card: "#FFFFFF",
    border: "#E0E0E0",
    text: "#111111",
    muted: "#666666",
  }),
}));
vi.mock("../src/ui", () => ({
  AppText: "AppText",
  Card: "Card",
  BigButton: (props: any) =>
    React.createElement("Pressable", { accessibilityRole: "button", onPress: props.onPress }, React.createElement("AppText", null, props.label)),
  InlineStatus: (props: any) => React.createElement("AppText", null, props.text),
  Chip: (props: any) =>
    React.createElement("Pressable", { accessibilityRole: "button", onPress: props.onPress }, React.createElement("AppText", null, props.label)),
}));
vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    lang: "en",
    unit: "kg",
    unitText: "kg",
    direction: "ltr",
    t: (k: string, p?: Record<string, string | number>) => {
      if (k === "short.active.title") return "ACTIVE SHORT-WEEK SCHEDULE";
      if (k === "short.active") return `Active: ${p?.days} days`;
      if (k === "short.restore.btn") return "Restore Standard Schedule";
      if (k === "short.kept.title") return "PREVIEW: KEPT ROTATION";
      if (k === "short.cuts") return "What is cut";
      if (k === "short.cuts.none") return "Nothing is cut.";
      if (k === "short.cut.day_dropped") return `Day dropped: ${p?.day}`;
      if (k === "short.cut.sets_reduced") return `${p?.day}: ${p?.name} from ${p?.from} to ${p?.to} sets`;
      if (k === "short.reason.time") return "Time limit";
      if (k === "short.exposure") return "Muscle exposure";
      if (k === "short.exposureLine") return `${p?.before} -> ${p?.after} sets/wk`;
      if (k === "short.protected") return `Floor protected: ${p?.sets} sets`;
      if (k === "short.apply") return "Apply short week";
      if (k === "coach.priority.summary") return `${p?.p} Priority · ${p?.m} Maintenance · ${p?.b} Balanced`;
      if (k === "coach.rank.priority") return "Priority";
      if (k === "coach.rank.normal") return "Balanced";
      if (k === "coach.rank.maintenance") return "Maintenance";
      if (k === "coach.rank.reduced") return "Reduced";
      if (k === "coach.blueprint.title") return "GENERATED PROGRAMME BLUEPRINT";
      if (k === "coach.blueprint.launch") return "Activate & Save Programme";
      if (k === "coach.days") return "Days";
      if (k === "ob.programme.dropped") return "Omitted movements";
      if (k === "coach.dropped.avoid") return `${p?.day}: omitted ${p?.lift} (avoided)`;
      if (k.startsWith("muscle.")) return k.replace("muscle.", "").toUpperCase();
      return k;
    },
  }),
}));

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

describe("Page 10: Adaptive Engine Tools & Programme Generator", () => {
  it("renders ShortWeekImpactCard with kept days, cuts, exposure, and apply action", () => {
    const onApply = vi.fn();
    const onUndo = vi.fn();

    const preview: ShortWeekPreview = {
      programmeId: "p1",
      originalVersionId: "v1",
      original: {
        name: "Standard 3-Day",
        days: [],
      },
      rebuild: {
        draft: {
          name: "Condensed 2-Day",
          days: [
            {
              name: "Day 1: Upper Power",
              exercises: [
                { exerciseId: "bench", sets: 4, repMin: 6, repMax: 8, repCeiling: null, isGoalLift: false, trackEffort: false },
                { exerciseId: "row", sets: 3, repMin: 8, repMax: 10, repCeiling: null, isGoalLift: false, trackEffort: false },
              ],
            },
            {
              name: "Day 2: Lower Power",
              exercises: [
                { exerciseId: "squat", sets: 4, repMin: 5, repMax: 5, repCeiling: null, isGoalLift: false, trackEffort: false },
              ],
            },
          ],
        },
        cuts: [
          { kind: "day_dropped", day: "Day 3", reason: "days" },
          { kind: "sets_reduced", day: "Day 1", exerciseId: "row", fromSets: 4, toSets: 3, reason: "time" },
        ],
        minutes: [45, 40],
        overBudget: false,
        floorMissed: [],
      },
      exposure: [
        {
          group: "chest",
          before: { group: "chest", setsPerRotation: 12, daysPerRotation: 2, setsPerWeek: 12, sessionsPerWeek: 2 },
          after: { group: "chest", setsPerRotation: 8, daysPerRotation: 1, setsPerWeek: 8, sessionsPerWeek: 1 },
          deltaSets: -4,
          deltaSessions: -1,
          kind: "down",
        },
      ],
    };

    const tree = expand(
      React.createElement(ShortWeekImpactCard, {
        preview,
        minutes: 45,
        active: null,
        nameOf: (id) => (id === "row" ? "Barbell Row" : "Bench Press"),
        onApply,
        onUndo,
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("PREVIEW: KEPT ROTATION");
    expect(allTexts).toContain("Day 1: Upper Power");
    expect(allTexts).toContain("7 sets");
    expect(allTexts).toContain("~45 min");
    expect(allTexts).toContain("What is cut");
    expect(allTexts).toContain("Day dropped: Day 3");
    expect(allTexts).toContain("CHEST");
    expect(allTexts).toContain("Floor protected: 6 sets");
    expect(allTexts).toContain("Apply short week");

    const buttons = nodes(tree).filter((n) => n.props?.accessibilityRole === "button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0]!.props.onPress();
    expect(onApply).toHaveBeenCalled();
  });

  it("renders ShortWeekImpactCard active banner and undo trigger", () => {
    const onUndo = vi.fn();
    const active: ActiveShortWeek = {
      id: "asw1",
      programmeId: "p1",
      originalVersionId: "v1",
      shortVersionId: "v2",
      weekStart: "2026-10-19",
      days: 2,
      minutes: 45,
      cuts: [],
    };

    const tree = expand(
      React.createElement(ShortWeekImpactCard, {
        preview: null,
        minutes: null,
        active,
        nameOf: () => "",
        onApply: vi.fn(),
        onUndo,
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("ACTIVE SHORT-WEEK SCHEDULE");
    expect(allTexts).toContain("Active: 2 days");
    expect(allTexts).toContain("Restore Standard Schedule");

    const buttons = nodes(tree).filter((n) => n.props?.accessibilityRole === "button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0]!.props.onPress();
    expect(onUndo).toHaveBeenCalled();
  });

  it("renders MusclePriorityGrid with live summary and updates rank", () => {
    const onSetRank = vi.fn();
    const priorities = {
      chest: "priority" as const,
      glutes: "maintenance" as const,
    };

    const tree = expand(
      React.createElement(MusclePriorityGrid, {
        priorities,
        onSetRank,
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("1 Priority · 1 Maintenance · 8 Balanced");
    expect(allTexts).toContain("CHEST");
    expect(allTexts).toContain("BACK");
    expect(allTexts).toContain("🔥 Priority");

    // Check pressing a rank chip
    const buttons = nodes(tree).filter((n) => n.props?.accessibilityRole === "button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0]!.props.onPress();
    expect(onSetRank).toHaveBeenCalled();
  });

  it("renders GeneratedProgrammeHero and triggers onSave", () => {
    const onSave = vi.fn();
    const preview: GeneratedProgramme = {
      draft: {
        name: "Hypertrophy Upper / Lower",
        days: [
          {
            name: "Upper A",
            exercises: [
              { exerciseId: "bench", sets: 3, repMin: 8, repMax: 12, repCeiling: null, isGoalLift: false, trackEffort: false },
              { exerciseId: "row", sets: 3, repMin: 8, repMax: 12, repCeiling: null, isGoalLift: false, trackEffort: false },
            ],
          },
          {
            name: "Lower A",
            exercises: [
              { exerciseId: "squat", sets: 3, repMin: 6, repMax: 10, repCeiling: null, isGoalLift: false, trackEffort: false },
            ],
          },
        ],
      },
      template: {
        id: "ul4",
        days: 4,
        en: "Upper / Lower",
        ar: "علوي / سفلي",
        arDraft: true,
        reviewed: false,
        gear: "gym",
        level: "intermediate",
        goal: "hypertrophy",
        schedule: [],
      },
      dropped: [
        { day: "Upper A", key: "overhead_press", reason: "avoid" },
      ],
    };

    const library: LibraryExercise[] = [
      { id: "e1", seedKey: "overhead_press", nameEn: "Overhead Press", nameAr: "ضغط كتف", pattern: "shoulders", aliasesAr: [], equipment: "barbell", setup: "free", measure: "reps", isCustom: false },
    ];

    const tree = expand(
      React.createElement(GeneratedProgrammeHero, {
        preview,
        library,
        minutes: 75,
        busy: false,
        onSave,
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("GENERATED PROGRAMME BLUEPRINT");
    expect(allTexts).toContain("Hypertrophy Upper / Lower");
    expect(allTexts).toContain("2 Days");
    expect(allTexts).toContain("3 movements");
    expect(allTexts).toContain("9 weekly sets");
    expect(allTexts).toContain("Upper A");
    expect(allTexts).toContain("2 exercises · 6 sets");
    expect(allTexts).toContain("Omitted movements");
    expect(allTexts).toContain("Upper A: omitted Overhead Press (avoided)");
    expect(allTexts).toContain("Activate & Save Programme");

    const buttons = nodes(tree).filter((n) => n.props?.accessibilityRole === "button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0]!.props.onPress();
    expect(onSave).toHaveBeenCalled();
  });
});
