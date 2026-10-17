import React, { type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import type { Disp } from "../src/logic/workoutTypes";
import { initialRows, editRow, markSaved } from "../src/logic/workoutRows";
import { LiveSuggestion, LoadSettings } from "../src/components/LiveSuggestion";
import { WorkoutExerciseSection } from "../src/components/WorkoutExerciseSection";
import { MemoWorkoutSetRow, WorkoutSetRow, type WorkoutSetRowProps } from "../src/components/WorkoutSetRow";
import { PreviousSourceToggle, parsePreviousSource, PREVIOUS_SOURCE_KEY } from "../src/components/PreviousSourceToggle";

// Inspect the presentation tree and invoke its callbacks. Native keyboard/gesture delivery needs a phone.
const settings = vi.hoisted(() => ({ unit: "kg" as "kg" | "lb", lang: "en" as "en" | "ar", fontScale: 1 }));
vi.mock("../src/haptics", () => ({ haptics: { tick: () => {}, untick: () => {}, restOver: () => {}, celebrate: () => {} } }));
vi.mock("react-native", () => ({ View: "View", Alert: { alert: vi.fn() }, Pressable: "Pressable", useWindowDimensions: () => ({ fontScale: settings.fontScale }) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ ...settings, unitText: settings.unit, fmt: (kg: number) => `${kg} kg`, t: (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(settings.lang, key, params) }) }));
vi.mock("../src/theme", () => ({ radius: { button: 8, card: 12, pill: 24 }, space: { xs: 4, sm: 8, md: 12, lg: 16 }, type: { section: 20, label: 13, load: 36, caption: 13 }, useLogPalette: () => ({ doneBg: "done", activeBg: "active", bg: "page", card: "card", line: "line", fill: "fill", accent: "accent", muted: "muted", danger: "danger", text: "text" }), usePalette: () => ({ muted: "muted", border: "border", text: "text", fill: "fill", onFill: "onFill", edge: "edge", danger: "danger" }) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", QuietAction: "QuietAction", BigButton: "BigButton", IconButton: "IconButton", InlineStatus: "InlineStatus", Notice: "Notice", Chip: "Chip", Field: "Field" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/components/LogParts", () => ({ CellInput: "CellInput", SwipeRow: "SwipeRow", RestToggle: "RestToggle", TargetLine: "TargetLine" }));

type Node = ReactElement<Record<string, any>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function props(extra: Partial<WorkoutSetRowProps> = {}): WorkoutSetRowProps {
  const row = initialRows([], 3, { load: 60, reps: 8 }, () => "draft")[0]!;
  return {
    ex: { exerciseId: "bench", nameEn: "Bench Press", nameAr: "بنش", measure: "reps", trackEffort: true } as Disp,
    row, label: 2, workingIndex: 1, lastSets: [{ load: 55, reps: 9 }, { load: 60, reps: 7 }], current: true, stacked: false, busy: false,
    onPatch: vi.fn(), onKind: vi.fn(), onAskDelete: vi.fn(), onDelete: vi.fn(), onLog: vi.fn(), onUntick: vi.fn(), ...extra,
  };
}
const tick = (p: WorkoutSetRowProps) => nodes(WorkoutSetRow(p)).find(n => n.props.accessibilityRole === "checkbox")!;
const inputs = (p: WorkoutSetRowProps) => nodes(WorkoutSetRow(p)).filter(n => n.type as unknown === "CellInput");

beforeEach(() => { settings.unit = "kg"; settings.lang = "en"; settings.fontScale = 1; });
describe("extracted workout row wiring", () => {
  it("shows a static, polite PR indicator only on a clean checked row", () => {
    const p = props({ strengthPr: true });
    const indicators = () => nodes(WorkoutSetRow(p)).filter(n => n.props.accessibilityLiveRegion === "polite");
    expect(indicators()).toHaveLength(0);
    p.row = markSaved([p.row], p.row.key)[0]!;
    expect(indicators()[0]!.props.children).toBe("Verified strength PR");
    p.strengthPr = false;
    expect(indicators()).toHaveLength(0);
    p.strengthPr = true;
    settings.lang = "ar";
    expect(indicators()[0]!.props.children).toBe("رقم قوة موثّق");
    p.row = editRow([p.row], p.row.key, { reps: 9 })[0]!;
    expect(indicators()).toHaveLength(0);
  });
  it("logs a ghost-filled row and unticks a saved row using its original identity", () => {
    const p = props();
    expect(tick(p).props.disabled).toBe(false);
    tick(p).props.onPress();
    expect(p.onLog).toHaveBeenCalledWith(p.row);
    expect(p.onUntick).not.toHaveBeenCalled();
    p.row = markSaved([p.row], p.row.key)[0]!;
    expect(tick(p).props.accessibilityState.checked).toBe(true);
    tick(p).props.onPress();
    expect(p.onUntick).toHaveBeenCalledWith(p.row);
  });
  it("updates an edited saved row instead of unticking it", () => {
    const p = props();
    p.row = editRow(markSaved([p.row], p.row.key), p.row.key, { reps: 9 })[0]!;
    expect(tick(p).props.accessibilityState.checked).toBe(false);
    expect(tick(p).props.accessibilityLabel).toContain("Update");
    tick(p).props.onPress();
    expect(p.onLog).toHaveBeenCalledWith(p.row);
    expect(p.onUntick).not.toHaveBeenCalled();
  });
  it("announces disabled state during saves and on incomplete unsaved rows", () => {
    for (const p of [props({ busy: true }), props({ row: initialRows([], 1, { load: null, reps: null }, () => "blank")[0]! })]) {
      expect(tick(p).props.disabled).toBe(true);
      expect(tick(p).props.accessibilityState.disabled).toBe(true);
    }
  });
  it("routes kind, long-press delete and swipe delete to the same row", () => {
    const p = props();
    const tree = nodes(WorkoutSetRow(p));
    const kind = tree.find(n => n.props.accessibilityRole === "button")!;
    kind.props.onPress(); kind.props.onLongPress();
    tree[0]!.props.onDelete();
    expect(p.onKind).toHaveBeenCalledWith(p.row);
    expect(p.onAskDelete).toHaveBeenCalledWith(p.row);
    expect(p.onDelete).toHaveBeenCalledWith(p.row);
  });
  it("converts typed pounds to kilograms and keeps the exercise/set context on each input", () => {
    settings.unit = "lb";
    const p = props(); const cells = inputs(p);
    const kg = cells[0]!.props.parse("132.3", null);
    expect(kg).toBeCloseTo(60, 1);
    cells[0]!.props.onValue(kg); cells[1]!.props.onValue(9); cells[2]!.props.onValue(2);
    expect(vi.mocked(p.onPatch).mock.calls).toEqual([[p.row.key, { load: kg, invalidLoad: false }], [p.row.key, { reps: 9, invalidReps: false }], [p.row.key, { rir: 2, invalidRir: false }]]);
    for (const cell of cells) { expect(cell.props.a11y).toContain("Bench Press"); expect(cell.props.a11y).toContain("2"); }
  });
  it("keeps a two-line large-text layout with one copy of every control", () => {
    const p = props({ stacked: true });
    const tree = nodes(WorkoutSetRow(p));
    expect(tree.filter(n => n.props.accessibilityRole === "checkbox")).toHaveLength(1);
    const cells = inputs(p);
    expect(cells).toHaveLength(3);
    expect(cells.every(n => n.props.unitLabel)).toBe(true);
    expect(tree.filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ")).toContain("60kg × 7");
  });
  it("uses quantity parsing for timed/distance rows and omits effort when disabled", () => {
    const p = props(); p.ex = { ...p.ex, measure: "distance", trackEffort: false };
    const cells = inputs(p);
    expect(cells).toHaveLength(2);
    expect(cells[1]!.props.decimal).toBe(true);
    expect(cells[1]!.props.parse("12.5")).toBe(12.5);
    cells[1]!.props.onValue(12.5);
    expect(p.onPatch).toHaveBeenCalledWith(p.row.key, { reps: 12.5, invalidReps: false });
  });
  it("keeps Arabic exercise and set context on the action label", () => {
    settings.lang = "ar";
    const p = props();
    expect(tick(p).props.accessibilityLabel).toContain("بنش");
    expect(tick(p).props.accessibilityLabel).toMatch(/[٢2]/);
  });
});

async function sectionProps(): Promise<Parameters<typeof WorkoutExerciseSection>[0]> {
  const { freshDb } = await import("./helpers");
  const { repos, workout } = await freshDb();
  await repos.seedIfNeeded();
  const gymId = (await repos.getActiveGymId())!;
  const gym = await repos.loadGymFingerprint(gymId);
  const day = (await repos.getNextDay())!.day;
  const ex = (await repos.listDayExercises(day.id))[0]!;
  const { proposal, line, lineId } = await workout.liveProposal(ex, gym);
  let n = 0;
  const list = initialRows([], 3, { load: 60, reps: 8 }, () => `row${n++}`);
  return {
    ex: { ...ex, slot: ex.exerciseId }, position: 0, gym, list,
    info: { proposal, line, lineId, last: null, stored: null, prefill: { load: 60, reps: 8 } },
    st: { slot: ex.exerciseId, removed: false, replacedBy: null, note: "", restOff: false, added: false, position: null, superset: null },
    exSets: [], outliers: {}, expanded: false, supersetLabel: "A", restDurationMs: 90000,
    busy: false, warmOpen: false, warmDone: false,
    onOpenProgress: vi.fn(), onPatch: vi.fn(), onKind: vi.fn(), onAskDelete: vi.fn(), onDelete: vi.fn(), onLog: vi.fn(), onUntick: vi.fn(),
    onToggleRest: vi.fn(), onMenu: vi.fn(), onWhy: vi.fn(), onWhyLong: vi.fn(),
    onLiveApply: vi.fn(), onLiveOwn: vi.fn(), onLiveReport: vi.fn(), onLiveKeep: vi.fn(), onOutlierConfirm: vi.fn(), onOutlierReject: vi.fn(),
    onWarmConfirm: vi.fn(), onWarmOpen: vi.fn(), onWarmClose: vi.fn(), onAddSet: vi.fn(),
  };
}
describe("extracted exercise section wiring", () => {
  it("defaults to any workout and restores the saved source from local settings", async () => {
    const { freshDb } = await import("./helpers");
    const c = await freshDb();
    expect(parsePreviousSource(await c.repos.getSetting(PREVIOUS_SOURCE_KEY))).toBe("any");
    await c.repos.setSetting(PREVIOUS_SOURCE_KEY, "routine");
    expect(parsePreviousSource(await c.repos.getSetting(PREVIOUS_SOURCE_KEY))).toBe("routine");
    expect(parsePreviousSource("invalid")).toBe("any");
    const p = await sectionProps();
    p.info.previous = { any: { performedAt: "2026-10-16", sets: [{ load: 65, reps: 7 }] }, routine: null };
    p.previousSource = "routine";
    expect(nodes(WorkoutExerciseSection(p)).find(n => n.type === MemoWorkoutSetRow)!.props.lastSets).toBeNull();
  });
  it("changes only Previous when its source switches, preserving suggestions and editable fields", async () => {
    const p = await sectionProps();
    p.info.previous = { any: { performedAt: "2026-10-16", sets: [{ load: 65, reps: 7 }] }, routine: { performedAt: "2026-10-14", sets: [{ load: 60, reps: 8 }] } };
    p.info.last = { performedAt: "2026-10-15", sets: [{ load: 62.5, reps: 9 }] };
    p.card = { decision: { action: "maintain", suggestedWeightKg: 60, suggestedReps: 8, predictedReps: 8, reason: "within_range" }, key: p.list[0]!.key, performance: "saved", snapshot: "snapshot" };
    p.suggestionOpen = true;
    for (const lang of ["en", "ar"] as const) {
      settings.lang = lang;
      const before = nodes(WorkoutExerciseSection(p));
      const row = before.find(n => n.type === MemoWorkoutSetRow)!;
      const fields = nodes(WorkoutSetRow(row.props as WorkoutSetRowProps)).filter(n => n.type as unknown === "CellInput").map(n => [n.props.value, n.props.placeholder]);
      expect(row.props.lastSets).toEqual([{ load: 65, reps: 7 }]);
      const onChange = (source: "any" | "routine") => { p.previousSource = source; };
      const selector = nodes(PreviousSourceToggle({ source: "any", onChange }));
      const options = selector.filter(n => n.props.accessibilityRole === "radio");
      expect(options.map(n => n.props.accessibilityState.checked)).toEqual([true, false]);
      options[1]!.props.onPress();
      const after = nodes(WorkoutExerciseSection(p));
      const nextRow = after.find(n => n.type === MemoWorkoutSetRow)!;
      expect(nextRow.props.lastSets).toEqual([{ load: 60, reps: 8 }]);
      const previousText = nodes(WorkoutSetRow(nextRow.props as WorkoutSetRowProps)).filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ");
      expect(previousText).toContain("\u206660kg × 8\u2069");
      expect(nodes(WorkoutSetRow(nextRow.props as WorkoutSetRowProps)).filter(n => n.type as unknown === "CellInput").map(n => [n.props.value, n.props.placeholder])).toEqual(fields);
      expect(nextRow.props.row).toBe(row.props.row);
      expect(after.find(n => n.type === LiveSuggestion)!.props).toEqual(before.find(n => n.type === LiveSuggestion)!.props);
      p.previousSource = "any";
    }
  });
  it("preserves warm-up numbering, prior working-set indexes and the current-row identity", async () => {
    const p = await sectionProps();
    p.list = markSaved(editRow(p.list, p.list[0]!.key, { warmup: true }), p.list[0]!.key);
    const rows = nodes(WorkoutExerciseSection(p)).filter(n => n.type === MemoWorkoutSetRow);
    expect(rows.map(n => n.props.label)).toEqual(["W", "1", "2"]);
    expect(rows.map(n => n.props.workingIndex)).toEqual([null, 0, 1]);
    expect(rows.map(n => n.props.current)).toEqual([false, true, false]);
    rows[1]!.props.onPatch(rows[1]!.props.row.key, { load: 62.5 });
    expect(p.onPatch).toHaveBeenCalledWith(p.list[1]!.key, { load: 62.5 });
  });
  it("keeps header rest/menu, target reasons, and Add set connected to screen handlers", async () => {
    const p = await sectionProps();
    const tree = nodes(WorkoutExerciseSection(p));
    tree.find(n => (n.type as unknown) === "RestToggle")!.props.onPress();
    tree.find(n => (n.type as unknown) === "IconButton")!.props.onPress();
    const target = tree.find(n => (n.type as unknown) === "TargetLine")!;
    target.props.onWhy(); target.props.onWhyLong();
    tree.find(n => (n.type as unknown) === "BigButton" && n.props.accessibilityHint)!.props.onPress();
    for (const handler of [p.onToggleRest, p.onMenu, p.onWhy, p.onWhyLong, p.onAddSet]) expect(handler).toHaveBeenCalledOnce();
    expect(tree.filter(n => (n.type as unknown) === "AppText").map(n => String(n.props.children)).join(" ")).toContain("A");
  });
  it("opens exercise history and the personal record when the exercise name is pressed", async () => {
    const p = await sectionProps();
    const heading = nodes(WorkoutExerciseSection(p)).find(n => n.type as unknown === "Pressable" && String(n.props.accessibilityLabel).includes("personal record"))!;
    expect(heading.props.accessibilityLabel).toContain("Bench Press");
    heading.props.onPress();
    expect(p.onOpenProgress).toHaveBeenCalledOnce();
  });
  it("adapts every set row to large text without changing the action callbacks", async () => {
    settings.fontScale = 1.6;
    const p = await sectionProps();
    const rows = nodes(WorkoutExerciseSection(p)).filter(n => n.type === MemoWorkoutSetRow);
    expect(rows).toHaveLength(p.list.length);
    expect(rows.every(n => n.props.stacked === true)).toBe(true);
    expect(rows.every(n => n.props.onLog === p.onLog && n.props.onDelete === p.onDelete)).toBe(true);
  });
  it("only highlights the focused exercise and puts a normal suggestion before its target row", async () => {
    const p = await sectionProps();
    const card = { key: p.list[1]!.key, performance:"observed", snapshot:"draft", decision: {action:"maintain" as const, reason:"within_range" as const, predictedReps:8, suggestedWeightKg:60, suggestedReps:8} };
    const tree = nodes(WorkoutExerciseSection({...p, active:false, card, suggestionOpen: true}));
    expect(tree.filter(n => n.type === MemoWorkoutSetRow).every(n => n.props.current === false)).toBe(true);
    const suggestion = tree.findIndex(n => n.type === LiveSuggestion);
    const target = tree.findIndex(n => n.type === MemoWorkoutSetRow && n.props.row.key === card.key);
    expect(suggestion).toBeGreaterThan(0);
    expect(suggestion).toBeLessThan(target);
    expect(tree.filter(n => n.type === LiveSuggestion)).toHaveLength(1);
  });
  it("the Next-set card is absent by default; the row keeps the ghost and a compact toggle opens the card", async () => {
    const p = await sectionProps();
    const card = { key: p.list[0]!.key, performance: "observed", snapshot: "draft", decision: { action: "increase" as const, reason: "above_range" as const, predictedReps: 8, suggestedWeightKg: 62.5, suggestedReps: 8 } };
    p.list = [{ ...p.list[0]!, ghostLoad: 62.5, ghostReps: 8 }, ...p.list.slice(1)];
    const onToggleSuggestion = vi.fn();
    for (const lang of ["en", "ar"] as const) {
      settings.lang = lang;
      const tree = nodes(WorkoutExerciseSection({ ...p, card, onToggleSuggestion }));
      expect(tree.some(n => n.type === LiveSuggestion)).toBe(false);
      const text = tree.filter(n => (n.type as unknown) === "AppText").map(n => String(n.props.children)).join(" ");
      expect(text).not.toContain(translate(lang, "live.title"));
      expect(tree.some(n => n.props.label === translate(lang, "live.apply"))).toBe(false);
      expect(tree.some(n => n.props.label === translate(lang, "live.loads"))).toBe(false);
      const row = tree.find(n => n.type === MemoWorkoutSetRow && n.props.row.key === card.key)!;
      expect([row.props.row.ghostLoad, row.props.row.ghostReps]).toEqual([62.5, 8]);
      expect(row.props.onLog).toBe(p.onLog); // one-tap confirm is unchanged
      const target = tree.find(n => (n.type as unknown) === "TargetLine")!;
      expect(target.props.moreLabel).toBe(translate(lang, "workout.nextSetDetails"));
      expect(target.props.moreExpanded).toBe(false);
      target.props.onMore();
    }
    expect(onToggleSuggestion).toHaveBeenCalledTimes(2);
    const open = nodes(WorkoutExerciseSection({ ...p, card, onToggleSuggestion, suggestionOpen: true }));
    expect(open.filter(n => n.type === LiveSuggestion)).toHaveLength(1);
    expect(open.find(n => (n.type as unknown) === "TargetLine")!.props.moreExpanded).toBe(true);
  });
  it("a stop warning still shows without opening anything", async () => {
    const p = await sectionProps();
    const card = { key: p.list[0]!.key, performance: "observed", snapshot: "draft", decision: { action: "stop" as const, reason: "performance_stop" as const, predictedReps: 0, suggestedWeightKg: 60, suggestedReps: 8 } };
    const tree = nodes(WorkoutExerciseSection({ ...p, card, onToggleSuggestion: vi.fn() }));
    expect(tree.filter(n => n.type === LiveSuggestion)).toHaveLength(1);
    expect(tree.find(n => (n.type as unknown) === "TargetLine")!.props.moreLabel).toBeUndefined();
  });
  it("load settings are closed by default and reachable through the header's Loads control", async () => {
    const p = await sectionProps();
    const onToggleLoads = vi.fn(); const onPickJump = vi.fn(); const onSaveList = vi.fn(); const onListChange = vi.fn();
    const base = { ...p, onToggleLoads, onPickJump, onSaveList, onListChange, listText: "20, 22.5" };
    for (const lang of ["en", "ar"] as const) {
      settings.lang = lang;
      const closed = nodes(WorkoutExerciseSection(base));
      expect(closed.some(n => n.type === LoadSettings)).toBe(false);
      const button = closed.find(n => (n.type as unknown) === "QuietAction" && n.props.label === translate(lang, "workout.loads"))!;
      expect(button.props.expanded).toBe(false);
      expect(button.props.accessibilityLabel).toContain(translate(lang, "workout.loads"));
      button.props.onPress();
    }
    expect(onToggleLoads).toHaveBeenCalledTimes(2);
    settings.lang = "en";
    const open = nodes(WorkoutExerciseSection({ ...base, loadsOpen: true }));
    const panel = open.find(n => n.type === LoadSettings)!;
    expect(panel.props.onPickJump).toBe(onPickJump);
    expect(panel.props.onSaveList).toBe(onSaveList);
    expect(open.find(n => (n.type as unknown) === "QuietAction" && n.props.label === "Loads")!.props.expanded).toBe(true);
    // Timed exercises have no load settings to change.
    const timed = nodes(WorkoutExerciseSection({ ...base, ex: { ...p.ex, measure: "time" } }));
    expect(timed.some(n => (n.type as unknown) === "QuietAction" && n.props.label === "Loads")).toBe(false);
  });

});

describe("live suggestion explanations", () => {
  const presentation = () => ({ decision: { action: "maintain" as const, suggestedWeightKg: 60, suggestedReps: 8, predictedReps: 8.25, reason: "within_range" as const }, state: "hold" as const, equipment: "barbell" as const, basis: { load: 60, reps: 10 }, repMin: 6, repMax: 10, manualLoad: false, busy: false, detailsOpen: true, onToggleDetails: vi.fn(), onApply: vi.fn(), onOwn: vi.fn(), onKeep: vi.fn(), onReport: vi.fn() });
  it("explains the observed set in the user's unit without changing the decision", () => {
    settings.unit = "lb";
    const p = presentation();
    const before = { ...p.decision };
    const tree = nodes(LiveSuggestion(p));
    const text = tree.filter(n => (n.type as unknown) === "AppText").map(n => String(n.props.children)).join(" ");
    expect(text).toContain("132.3");
    expect(text).toContain("10");
    expect(text).toContain("8");
    expect(text).toContain("Hold");
    expect(text).toContain("Sleep, readiness and rest time are unknown");
    expect(tree.some(n => n.props.label === "Use this")).toBe(true);
    expect(p.decision).toEqual(before);
  });
  it("shows Next load×reps, Hold, predicted range, and Use this / Enter my own", () => {
    const p = presentation();
    const tree = nodes(LiveSuggestion({ ...p, detailsOpen: false }));
    const text = tree.filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ");
    expect(text).toContain("Next set");
    expect(text).toContain("Next:");
    expect(text).toContain("60");
    expect(text).toContain("8");
    expect(text).toContain("Hold");
    expect(text).toContain("After");
    expect(text).toContain("Estimated next set:");
    tree.find(n => n.props.label === "Use this")!.props.onPress();
    expect(p.onApply).toHaveBeenCalledOnce();
    tree.find(n => n.props.label === "Enter my own")!.props.onPress();
    expect(p.onOwn).toHaveBeenCalledOnce();
  });
  it("labels increase, decrease, no-heavier and starting states", () => {
    const p = presentation();
    const increase = nodes(LiveSuggestion({ ...p, detailsOpen: false, state: "increase", decision: { ...p.decision, action: "increase", reason: "above_range", suggestedWeightKg: 62.5 } }));
    expect(increase.filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ")).toContain("Increase");
    const decrease = nodes(LiveSuggestion({ ...p, detailsOpen: false, state: "decrease", decision: { ...p.decision, action: "decrease", reason: "below_range", suggestedWeightKg: 57.5 } }));
    expect(decrease.filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ")).toContain("Decrease");
    const none = nodes(LiveSuggestion({ ...p, detailsOpen: false, state: "no_heavier", equipment: "dumbbell", decision: { ...p.decision, action: "maintain", reason: "no_suitable_increase", suggestedWeightKg: 16, suggestedReps: 8 } }));
    const noneText = none.filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ");
    expect(noneText).toContain("No heavier load");
    expect(noneText).toContain("Keep");
    expect(noneText).toContain("16");
    const start = nodes(LiveSuggestion({ ...p, detailsOpen: false, state: "starting", decision: { ...p.decision, predictionAvailable: false } }));
    expect(start.filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ")).toContain("Starting estimate");
  });
  it("keeps stop reasons visible even when Details is collapsed", () => {
    const p = presentation();
    const tree = nodes(LiveSuggestion({ ...p, detailsOpen: false, state: "stop", decision: {...p.decision, action:"stop", reason:"reported_symptoms"} }));
    const text = tree.filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ");
    expect(text).toContain("Stop and assess");
    expect(tree[0]!.props.accessibilityLiveRegion).toBe("assertive");
    expect(tree.some(n => n.props.label === "Use this")).toBe(false);
    expect(tree.some(n => n.props.label === "Enter my own")).toBe(false);
  });
  it("never labels an observed-only fatigue stop as a model forecast", () => {
    const p = presentation();
    const tree = nodes(LiveSuggestion({...p, state: "stop", decision:{...p.decision,action:"stop",reason:"performance_stop",predictionAvailable:false}}));
    const text = tree.filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ");
    expect(text).toContain("large performance drop");
    expect(text).not.toContain("Estimated next set:");
    expect(text).not.toContain("Estimate from logged sets");
  });
  it("explains that typed values win over the automatic target", () => {
    const p = presentation();
    const tree = nodes(LiveSuggestion({...p,manualLoad:true}));
    const text = tree.filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ");
    expect(text).toContain("Your entered weight or reps are kept");
    expect(tree.some(n => n.props.label === "Use this")).toBe(true);
  });
  it("does not present a model estimate as the basis for a reported-symptom stop", () => {
    const p = presentation();
    const tree = nodes(LiveSuggestion({ ...p, state: "stop", decision: { ...p.decision, action: "stop", reason: "reported_symptoms" } }));
    const text = tree.filter(n => (n.type as unknown) === "AppText").map(n => String(n.props.children)).join(" ");
    expect(text).not.toContain("Last saved set");
    expect(text).not.toContain("Estimate from logged sets");
    expect(tree.some(n => n.props.variant === "secondary")).toBe(false);
  });
  it("load chips (in the Loads settings) call onPickJump, and the card no longer carries them", () => {
    const p = presentation();
    const onPickJump = vi.fn();
    expect(nodes(LiveSuggestion({ ...p, detailsOpen: false })).some(n => n.type as unknown === "Chip")).toBe(false);
    const tree = nodes(LoadSettings({ busy: false, onPickJump, loadSpec: { equipment: "barbell", increment: 2.5, min: 20 } }));
    const strip = (s: unknown) => String(s).replace(/\u2066|\u2069/g, "");
    const chip = tree.find(n => n.type as unknown === "Chip" && strip(n.props.label) === "5 kg jumps")!;
    chip.props.onPress();
    expect(onPickJump).toHaveBeenCalledWith(5);
  });
});

describe("accessible row deletion and invalid-input protection", () => {
  it("routes the screen-reader delete action through confirmation, not immediate deletion", () => {
    const p = props();
    const button = nodes(WorkoutSetRow(p)).find(n => n.props.accessibilityRole === "button")!;
    expect(button.props.accessibilityActions).toEqual([{ name: "delete", label: "Delete" }]);
    button.props.onAccessibilityAction({ nativeEvent: { actionName: "delete" } });
    expect(p.onAskDelete).toHaveBeenCalledWith(p.row);
    expect(p.onDelete).not.toHaveBeenCalled();
  });
  it("keeps a contextual label on swipe deletion and blocks invalid edits to already saved sets", () => {
    const p = props();
    expect(nodes(WorkoutSetRow(p))[0]!.props.deleteA11y).toContain("Bench Press");
    p.row = editRow(markSaved([p.row], p.row.key), p.row.key, { load: null, invalidLoad: true })[0]!;
    expect(tick(p).props.disabled).toBe(true);
    expect(tick(p).props.accessibilityState.disabled).toBe(true);
  });
  it("forwards invalid text separately from an intentionally empty target input", () => {
    const p = props(); const cell = inputs(p)[0]!;
    cell.props.onValue(null, true);
    expect(p.onPatch).toHaveBeenCalledWith(p.row.key, { load: null, invalidLoad: true });
    cell.props.onValue(null, false);
    expect(p.onPatch).toHaveBeenLastCalledWith(p.row.key, { load: null, invalidLoad: false });
  });
});
