import React, { type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkoutSettingsModal } from "../src/components/WorkoutSettingsModal";
import { newExercise, type DraftDay } from "../src/logic/programmeDraft";
import { translate } from "../src/i18n/format";

// Presentation callbacks with one local state slot; native modal/gesture delivery needs an iPhone.
const state = vi.hoisted(() => ({ day: undefined as DraftDay | undefined, lang: "en" as "en" | "ar" }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: () => DraftDay) => {
    state.day ??= initial();
    return [state.day, (update: (day: DraftDay) => DraftDay) => { state.day = update(state.day!); }];
  } };
});
vi.mock("react-native", () => ({ Modal: "Modal", View: "View", ScrollView: "ScrollView" }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ t: (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(state.lang, key, params) }) }));
vi.mock("../src/theme", () => ({ space: { sm: 8, md: 12, lg: 16 }, type: { section: 20 }, usePalette: () => ({ bg: "bg", muted: "muted", border: "border" }) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", BigButton: "BigButton", Stepper: "Stepper" }));
type Node = ReactElement<Record<string, any>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function fixture() {
  const day: DraftDay = { name: "Push", exercises: [newExercise("bench", { sets: 4, topSets: 2 }), newExercise("fly", { sets: 3, repMin: 10, repMax: 15 })] };
  const props = { day, nameOf: (id: string) => id, onCancel: vi.fn(), onDone: vi.fn() };
  const render = () => nodes(WorkoutSettingsModal(props));
  return { props, render };
}
beforeEach(() => { state.day = undefined; state.lang = "en"; });
describe("whole-workout set settings", () => {
  it("edits each exercise independently and applies only on Done, normalizing top sets", () => {
    const { props, render } = fixture();
    const steppers = render().filter(n => n.type as unknown === "Stepper");
    expect(steppers.map(n => n.props.label)).toEqual(["bench · Sets", "fly · Sets"]);
    expect(steppers.every(n => n.props.min === 1 && n.props.max === 12)).toBe(true);
    steppers[0]!.props.onChange(1);
    expect(props.onDone).not.toHaveBeenCalled();
    expect(props.day.exercises[0]).toMatchObject({ sets: 4, topSets: 2 });
    render().find(n => n.props.label === "Done")!.props.onPress();
    const saved = props.onDone.mock.calls[0]![0] as DraftDay;
    expect(saved.exercises[0]).toMatchObject({ sets: 1, topSets: null });
    expect(saved.exercises[1]).toEqual(props.day.exercises[1]);
  });
  it("Cancel and native dismissal leave the program draft untouched", () => {
    const { props, render } = fixture();
    render().find(n => n.type as unknown === "Stepper")!.props.onChange(6);
    render().find(n => n.props.label === "Cancel")!.props.onPress();
    render()[0]!.props.onRequestClose();
    expect(props.onCancel).toHaveBeenCalledTimes(2);
    expect(props.onDone).not.toHaveBeenCalled();
    expect(props.day.exercises[0]!.sets).toBe(4);
  });
  it("shows Arabic settings and actions", () => {
    state.lang = "ar";
    const { render } = fixture();
    const tree = render();
    expect(tree.find(n => n.props.accessibilityRole === "header")!.props.children).toContain("إعدادات");
    expect(tree.some(n => n.props.label === "تمام")).toBe(true);
    expect(tree.some(n => n.props.label === "إلغاء")).toBe(true);
  });
});
