import React from "react";
import { describe, expect, it, vi } from "vitest";
import { EngineReasoningCard } from "../src/components/why/EngineReasoningCard";
import { DecisionCard10x } from "../src/components/why/DecisionCard10x";
import { StoppedSuggestionCard10x } from "../src/components/why/StoppedSuggestionCard10x";
import type { WhySection } from "../src/logic/why";
import type { DecisionListItem } from "../src/db/decisionRepo";
import type { StoppedSuggestion } from "../src/db/rejectionRepo";
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
}));
vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    lang: "en",
    unit: "kg",
    unitText: "kg",
    direction: "ltr",
    fmt: (n: number) => String(n),
    t: (k: string, p?: Record<string, string | number>) => {
      if (k === "why.verdict") return "PROGRESSIVE OVERLOAD VERDICT";
      if (k === "why.action.advance") return "OVERLOAD ADVANCE";
      if (k === "why.action.consolidate") return "CONSOLIDATE & REPEAT";
      if (k === "why.action.deload") return "FATIGUE / RECOVERY";
      if (k === "why.action.planned") return "PLANNED TARGET";
      if (k === "why.sentence") return "Verdict";
      if (k === "why.observed") return "Observed Sessions";
      if (k === "why.gym") return "Equipment & Loading";
      if (k === "why.rule") return "Engine Rule";
      if (k === "dec.for") return `for ${p?.day}`;
      if (k === "dec.target") return `Target: ${p?.load} kg × ${p?.reps}`;
      if (k === "dec.noTarget") return "No target";
      if (k === "dec.action.accepted") return "Accepted";
      if (k === "dec.action.edited") return `Edited to ${p?.load} kg`;
      if (k === "dec.rule") return `Rule ${p?.version} (${p?.path})`;
      if (k === "dec.confidence") return `${p?.c} confidence`;
      if (k === "dec.why") return "Why this weight?";
      if (k === "stop.stopped") return "Stopped";
      if (k === "stop.counting") return `${p?.count}/${p?.max} Rejections`;
      if (k === "stop.last") return `Last declined ${p?.date}`;
      if (k === "stop.bringBack") return "Bring Back";
      return k;
    },
  }),
}));

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

describe("Page 9: The Decision Ledger & Engine Intelligence", () => {
  it("renders EngineReasoningCard with advance action and structured sections", () => {
    const sections: WhySection[] = [
      {
        title: "Verdict",
        lines: [
          "After 100 kg × 5. Increase load. Next rung is 102.5 kg.",
          "Target hit 2 sessions in a row cleanly.",
          "Experimental progression active.",
        ],
      },
      {
        title: "Observed Sessions",
        lines: [
          "Fri 16 Oct: 100 kg × 5 (3 sets, 2 RIR)",
          "Mon 12 Oct: 100 kg × 5 (3 sets, 1 RIR)",
        ],
      },
      {
        title: "Equipment & Loading",
        lines: ["Anchor at 100 kg", "Next available barbell rung: 102.5 kg (+2.5 kg jump)"],
      },
      {
        title: "Engine Rule",
        lines: ["Rule version: rule-v0.4", "Confidence: high"],
      },
    ];

    const tree = expand(React.createElement(EngineReasoningCard, { sections }));
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("PROGRESSIVE OVERLOAD VERDICT");
    expect(allTexts).toContain("OVERLOAD ADVANCE");
    expect(allTexts).toContain("After 100 kg × 5. Increase load. Next rung is 102.5 kg.");
    expect(allTexts).toContain("Target hit 2 sessions in a row cleanly.");
    expect(allTexts).toContain("Experimental progression active.");
    expect(allTexts).toContain("Observed Sessions");
    expect(allTexts).toContain("Fri 16 Oct: 100 kg × 5 (3 sets, 2 RIR)");
    expect(allTexts).toContain("Equipment & Loading");
  });

  it("renders EngineReasoningCard with deload and consolidate actions", () => {
    const deloadSections: WhySection[] = [
      {
        title: "Verdict",
        lines: ["Lifter fatigued. Decrease load by 10%."],
      },
    ];
    const deloadTree = expand(React.createElement(EngineReasoningCard, { sections: deloadSections }));
    expect(strip(texts(deloadTree).join(" "))).toContain("FATIGUE / RECOVERY");

    const consolidateSections: WhySection[] = [
      {
        title: "Verdict",
        lines: ["Consolidate and repeat 80 kg to build volume."],
      },
    ];
    const consolidateTree = expand(React.createElement(EngineReasoningCard, { sections: consolidateSections }));
    expect(strip(texts(consolidateTree).join(" "))).toContain("CONSOLIDATE & REPEAT");
  });

  it("renders DecisionCard10x with target, action, and calls onWhy", () => {
    const onWhy = vi.fn();
    const item: DecisionListItem = {
      targetId: "t1",
      decidedAt: 1729330000000,
      exerciseId: "bench",
      nameEn: "Barbell Bench Press",
      nameAr: "بنش بار حر",
      gymName: "Barbell Club",
      setup: "free",
      dayName: "Day A",
      sessionStatus: "completed",
      measure: "reps",
      durationS: null,
      distanceM: null,
      editedLoad: null,
      load: 85,
      reps: 6,
      ruleVersion: "rule-v0.4",
      path: "rule",
      confidence: "high",
      reason: { key: "confirm_top_of_range", params: {} },
      status: "accepted",
      currency: "load",
    };

    const tree = expand(
      React.createElement(DecisionCard10x, {
        decision: item,
        sentence: "Hit top of rep range across all working sets.",
        onWhy,
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("Barbell Bench Press");
    expect(allTexts).toContain("for Day A");
    expect(allTexts).toContain("Target: 85 kg × 6");
    expect(allTexts).toContain("Accepted");
    expect(allTexts).toContain("Hit top of rep range across all working sets.");

    const buttons = nodes(tree).filter((n) => n.props?.accessibilityRole === "button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0]!.props.onPress();
    expect(onWhy).toHaveBeenCalled();
  });

  it("renders StoppedSuggestionCard10x and triggers restore", () => {
    const onBringBack = vi.fn();
    const item: StoppedSuggestion = {
      id: "s1",
      lineId: "l1",
      jumpKind: "microload",
      exerciseId: "ohp",
      nameEn: "Overhead Press",
      nameAr: "ضغط كتف بالبار",
      gymName: "Barbell Club",
      setup: "free",
      blocked: true,
      count: 3,
      lastRejectedAt: 1729330000000,
    };

    const tree = expand(
      React.createElement(StoppedSuggestionCard10x, {
        item,
        onBringBack,
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("Overhead Press");
    expect(allTexts).toContain("Stopped");
    expect(allTexts).toContain("Bring Back");

    const buttons = nodes(tree).filter((n) => n.props?.accessibilityRole === "button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0]!.props.onPress();
    expect(onBringBack).toHaveBeenCalled();
  });
});
