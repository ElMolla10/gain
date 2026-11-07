import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkoutExerciseSection, type ExerciseSectionProps } from "../src/components/WorkoutExerciseSection";
import { translate } from "../src/i18n/format";
import { nodes, flat } from "./achievementRender";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("react-native", () => ({ Animated: {}, Easing: {}, Pressable: "Pressable", View: "View", useWindowDimensions: () => ({ fontScale: 1 }) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: "kg", t: (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(settings.lang, key, params) }) }));
vi.mock("../src/theme", () => ({ space: { xs: 4, sm: 8, md: 12, lg: 16 }, radius: { card: 12 }, type: { label: 13, section: 20 }, useLogPalette: () => ({}) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", BigButton: "BigButton", IconButton: "IconButton", InlineStatus: "InlineStatus", Notice: "Notice", QuietAction: "QuietAction", useReducedMotion: () => false }));
vi.mock("../src/components/LogParts", () => ({ RestToggle: "RestToggle", TargetLine: "TargetLine", UnitToggle: "UnitToggle" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/components/PersonalMilestoneLine", () => ({ PersonalMilestoneLine: "PersonalMilestoneLine" }));
vi.mock("../src/components/LiveSuggestion", () => ({ LiveSuggestion: "LiveSuggestion", LoadSettings: "LoadSettings" }));
vi.mock("../src/components/WorkoutSetRow", () => ({ MemoWorkoutSetRow: "WorkoutSetRow" }));

function fixture(): ExerciseSectionProps {
  const saved = { id: "saved", exerciseId: "bench", load: 40, reps: 8, rir: null, warmup: false, tags: [], outlierStatus: "none", durationS: null, distanceM: null };
  const blank = { load: null, reps: null, rir: null, warmup: false, tags: [], saved: false, dirty: false, ghostLoad: 40, ghostReps: 7 };
  return {
    ex: { id: "bench", exerciseId: "bench", slot: "bench", nameEn: "Bench press", nameAr: "بنش", equipment: "barbell", setup: "free", pattern: "horizontal_push", measure: "reps", repMin: 6, repMax: 10 },
    info: { proposal: { status: "insufficient_data", load: null, reps: null, reason: { key: "no_history", params: {} } }, stored: null, last: null, prefill: { load: null, reps: null } },
    list: [{ ...blank, key: "saved", saved: true, load: 40, reps: 8 }, { ...blank, key: "next" }],
    exSets: [saved], gym: { loads: [] }, st: { restOff: false }, outliers: {}, position: 0,
    card: { key: "next", decision: { action: "maintain", suggestedWeightKg: 40, suggestedReps: 7, predictedReps: 7.3, reason: "within_range" }, performance: "saved", snapshot: "saved" },
    expanded: false, suggestionOpen: false, restDurationMs: 90000, busy: false, warmOpen: false, warmDone: false,
    onToggleSuggestion: vi.fn(), onWhy: vi.fn(), onWhyLong: vi.fn(), onOpenProgress: vi.fn(), onToggleRest: vi.fn(), onMenu: vi.fn(),
  } as unknown as ExerciseSectionProps;
}
const tree = (props: ExerciseSectionProps) => nodes(WorkoutExerciseSection(props));
const hint = (props: ExerciseSectionProps) => tree(props).find(n => n.props.testID === "next-set-hint");
const text = (value: unknown) => nodes(value).filter(n => n.type === "AppText").map(n => flat(n.props.children)).join(" ");
beforeEach(() => { settings.lang = "en"; });

describe("immediate next-set hint from a saved working set", () => {
  it("shows numbers, saved basis and a short reason immediately before the next row with details closed", () => {
    const props = fixture();
    const rendered = tree(props);
    const immediate = rendered.find(n => n.props.testID === "next-set-hint");
    expect(immediate).toBeDefined();
    expect(text(immediate)).toContain("40");
    expect(text(immediate)).toContain("7");
    expect(text(immediate)).toContain("Last saved set:");
    expect(text(immediate)).toContain("8");
    expect(text(immediate)).toContain("Keep this load");
    const next = rendered.findIndex(n => n.type === "WorkoutSetRow" && n.props.row.key === "next");
    const saved = rendered.findIndex(n => n.type === "WorkoutSetRow" && n.props.row.key === "saved");
    expect(rendered.indexOf(immediate!)).toBeGreaterThan(saved);
    expect(rendered.indexOf(immediate!)).toBeLessThan(next);
    expect(rendered.some(n => n.type === "LiveSuggestion")).toBe(false);
    expect(rendered.some(n => n.type === "TargetLine")).toBe(false);
    const details = rendered.find(n => n.type === "QuietAction" && n.props.label === "Next set details");
    expect(details).toBeDefined();
    details!.props.onPress();
    expect(props.onToggleSuggestion).toHaveBeenCalledOnce();
  });

  it("opens the current next-set explanation when Why is pressed, without the historical target handler", () => {
    const props = fixture();
    const why = tree(props).find(n => n.type === "QuietAction" && n.props.label === translate("en", "workout.whyShort"));
    expect(why).toBeDefined();
    why!.props.onPress();
    expect(props.onToggleSuggestion).toHaveBeenCalledOnce();
    expect(props.onWhy).not.toHaveBeenCalled();
    props.suggestionOpen = true;
    expect(tree(props).find(n => n.type === "LiveSuggestion")!.props.whySentence).toContain("40");
  });

  it.each(["en", "ar"] as const)("describes an observed above-range hold without claiming it was in range (%s)", (lang) => {
    settings.lang = lang;
    const props = fixture();
    props.exSets[0]!.reps = 12;
    props.card!.decision.predictionAvailable = false;
    const reason = text(hint(props));
    expect(reason).toContain(lang === "en" ? "Keep this load for now." : "خليك على الوزن ده دلوقتي.");
    expect(reason).not.toContain(lang === "en" ? "in range" : "جوه النطاق");
  });

  it("does not appear before a trusted save, for starting estimates, or on the wrong row", () => {
    for (const change of ["none", "warmup", "drop", "unconfirmed", "rejected", "starting", "wrong-row"] as const) {
      const props = fixture();
      if (change === "none") props.exSets = [];
      else if (change === "warmup") props.exSets[0]!.warmup = true;
      else if (change === "drop") props.exSets[0]!.tags = ["drop"];
      else if (change === "starting") props.card!.starting = true;
      else if (change === "wrong-row") props.card!.key = "missing";
      else props.exSets[0]!.outlierStatus = change;
      expect(hint(props), change).toBeUndefined();
    }
  });

  it("keeps typed inputs intact and leaves a historical target visible", () => {
    const props = fixture();
    props.list[1] = { ...props.list[1]!, load: 45, reps: 6 };
    const typed = props.list[1];
    props.info.proposal = { ...props.info.proposal, status: "proposed", load: 42.5, reps: 8 };
    const rendered = tree(props);
    expect(hint(props)).toBeDefined();
    expect(rendered.find(n => n.type === "WorkoutSetRow" && n.props.row.key === "next")!.props.row).toBe(typed);
    expect(typed).toMatchObject({ load: 45, reps: 6, saved: false });
    expect(rendered.find(n => n.type === "TargetLine")!.props.value).toContain("42.5");
  });

  it("retains automatic stop warnings rather than showing a numeric hint", () => {
    const props = fixture();
    props.card!.decision = { ...props.card!.decision, action: "stop", reason: "reported_symptoms", suggestedReps: 0, predictionAvailable: false };
    const rendered = tree(props);
    expect(hint(props)).toBeUndefined();
    expect(rendered.find(n => n.type === "LiveSuggestion")!.props.decision.action).toBe("stop");
  });

  it.each(["en", "ar"] as const)("explains assisted easing and unavailable easier loads in %s", (lang) => {
    settings.lang = lang;
    const props = fixture();
    props.ex.setup = "assisted";
    props.card!.decision = { ...props.card!.decision, action: "decrease", reason: "below_range", suggestedWeightKg: 50 };
    expect(text(hint(props))).toContain(translate(lang, "live.compact.moreAssistance"));
    props.card!.decision = { ...props.card!.decision, action: "maintain", reason: "no_lighter_load" };
    expect(text(hint(props))).toContain(translate(lang, "live.compact.noEasier"));
  });
});
