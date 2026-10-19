import React from "react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingStepIndicator } from "../src/components/onboarding/OnboardingStepIndicator";
import { SettingsGroupHero } from "../src/components/settings/SettingsGroupHero";
import { PrivacyPledgeCard } from "../src/components/privacy/PrivacyPledgeCard";
import { expand, nodes, texts } from "./achievementRender";

vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Switch: "Switch",
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
    accent: "#3C5700",
  }),
}));
vi.mock("../src/ui", () => ({
  AppText: "AppText",
  Card: "Card",
  BigButton: (props: any) =>
    React.createElement("Pressable", { accessibilityRole: "button", onPress: props.onPress }, React.createElement("AppText", null, props.label)),
  InlineStatus: (props: any) => React.createElement("AppText", null, props.text),
}));
vi.mock("../src/components/SettingsRows", () => ({
  SwitchRow: (props: any) =>
    React.createElement(
      "View",
      null,
      React.createElement("AppText", null, props.label),
      React.createElement("Pressable", {
        accessibilityRole: "button",
        onPress: () => (props.onChange ?? props.onValueChange)(!props.value),
      }, React.createElement("AppText", null, props.value ? "ON" : "OFF"))
    ),
}));
vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    lang: "en",
    unit: "kg",
    unitText: "kg",
    direction: "ltr",
    fmt: (n: number) => String(n),
    t: (k: string, p?: Record<string, string | number>) => {
      if (k === "ob.step.progress") return `STEP ${p?.current} OF ${p?.total}`;
      if (k === "settings.shell.hero") return "SYSTEM & TRAINING ENGINE";
      if (k === "settings.engine.title") return "GAIN Engine";
      if (k === "privacy.pledge.hero") return "ZERO-SURVEILLANCE PLEDGE";
      if (k === "privacy.pledge.body") return "GAIN has no tracking scripts, no ads, 100% local.";
      if (k === "privacy.crashLog") return "Crash reporting";
      if (k === "privacy.notes") return "Anonymous telemetry";
      if (k === "privacy.manageData") return "Manage data vault";
      if (k === "privacy.openDiag") return "Open diagnostics";
      return k;
    },
  }),
}));

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

describe("Page 12: Lifter's Initiation & System Shell", () => {
  it("renders OnboardingStepIndicator with current step and step name", () => {
    const tree = expand(
      React.createElement(OnboardingStepIndicator, {
        currentStep: 3,
        totalSteps: 7,
        stepName: "Schedule",
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("STEP 3 OF 7");
    expect(allTexts).toContain("Schedule");
  });

  it("renders SettingsGroupHero with version and active gym badge", () => {
    const tree = expand(
      React.createElement(SettingsGroupHero, {
        version: "0.22.0",
        activeGymName: "Downtown Iron Club",
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("SYSTEM & TRAINING ENGINE");
    expect(allTexts).toContain("GAIN Engine");
    expect(allTexts).toContain("v0.22.0");
    expect(allTexts).toContain("Downtown Iron Club");
  });

  it("renders PrivacyPledgeCard and handles toggles and actions", () => {
    const onToggleCrashLog = vi.fn();
    const onToggleNotesOn = vi.fn();
    const onOpenData = vi.fn();
    const onOpenDiagnostics = vi.fn();

    const tree = expand(
      React.createElement(PrivacyPledgeCard, {
        crashLog: true,
        notesOn: false,
        onToggleCrashLog,
        onToggleNotesOn,
        onOpenData,
        onOpenDiagnostics,
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("ZERO-SURVEILLANCE PLEDGE");
    expect(allTexts).toContain("GAIN has no tracking scripts, no ads, 100% local.");
    expect(allTexts).toContain("Crash reporting");
    expect(allTexts).toContain("Anonymous telemetry");
    expect(allTexts).toContain("Manage data vault");
    expect(allTexts).toContain("Open diagnostics");

    const buttons = nodes(tree).filter((n) => n.props?.accessibilityRole === "button");
    expect(buttons.length).toBeGreaterThanOrEqual(4);

    // Toggle crash log
    buttons[0]!.props.onPress();
    expect(onToggleCrashLog).toHaveBeenCalledWith(false);

    // Toggle notes
    buttons[1]!.props.onPress();
    expect(onToggleNotesOn).toHaveBeenCalledWith(true);

    // Manage data
    buttons[2]!.props.onPress();
    expect(onOpenData).toHaveBeenCalled();

    // Diagnostics
    buttons[3]!.props.onPress();
    expect(onOpenDiagnostics).toHaveBeenCalled();
  });
});
