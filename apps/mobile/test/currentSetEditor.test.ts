import React from "react";
import { describe, expect, it, vi } from "vitest";
import { CurrentExerciseSets } from "../src/components/CurrentExerciseSets";
import type { ExerciseSectionProps } from "../src/components/WorkoutExerciseSection";
import { initialRows } from "../src/logic/workoutRows";
import { nodes, texts, expand } from "./achievementRender";
import { translate } from "../src/i18n/format";
vi.mock("react", async orig => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", useWindowDimensions: () => ({ fontScale: 1, width: 375 }) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: "en", unit: "kg", t: (k: any, p?: any) => translate("en", k, p) }) }));
vi.mock("../src/theme", () => ({ radius: { card: 16, button: 12 }, space: { xs: 4, sm: 8, md: 12, lg: 16 }, useLogPalette: () => ({}) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", IconButton: "IconButton", QuietAction: "QuietAction" }));
vi.mock("../src/components/LogParts", () => ({ CellInput: "CellInput" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
const fixture = (setup = "free", equipment = "barbell", load = 67.5, measure = "reps") => {
 let n = 0;
 return { ex: { exerciseId: "ex", nameEn: "Bench", nameAr: "بنش", setup, equipment, measure }, list: initialRows([], 3, { load, reps: 8 }, () => `r${n++}`), info: { previous: { any: { sets: [{ load: 70, reps: 9 }] }, routine: null } }, onPatch: vi.fn(), onSelect: vi.fn(), onKind: vi.fn(), onAskDelete: vi.fn() } as unknown as ExerciseSectionProps;
};
const render = (section: ExerciseSectionProps, currentKey: string | null = "r0") => expand(React.createElement(CurrentExerciseSets, { section, currentKey }));
describe("current exercise set editor", () => {
 it("edits only the active set and leaves other sets as tappable compact rows", () => {
  const p = fixture(); const tree = render(p); const inputs = nodes(tree).filter(n => n.type === "CellInput");
  expect(inputs).toHaveLength(2); expect(inputs[0]!.props.placeholder).toBe("67.5");
  inputs[0]!.props.onValue(72.5, false); expect(p.onPatch).toHaveBeenCalledWith("r0", { load: 72.5, invalidLoad: false });
  const other = nodes(tree).find(n => n.props.testID === "compact-set-r1")!; other.props.onPress();
  expect(p.onSelect).toHaveBeenCalledWith("r1");
  expect(texts(tree).join(" ").replace(/[\u2066-\u2069]/g, "")).toContain("Previous:");
 });
 it("keeps persisted validation visible when an invalid draft is revisited", () => {
  const p = fixture(); p.list[0]!.invalidLoad = true;
  expect(nodes(render(p)).find(n => n.type === "CellInput")!.props.invalid).toBe(true);
 });
 it("does not invent previous performance", () => {
  const p = fixture(); p.info.previous = { any: null, routine: null };
  expect(texts(render(p)).join(" ")).not.toContain("Previous:");
 });
 it("uses a reps-only field for zero-added-load bodyweight and retains added weight", () => {
  expect(nodes(render(fixture("bodyweight_plus_added", "plate", 0))).filter(n => n.type === "CellInput")).toHaveLength(1);
  expect(nodes(render(fixture("bodyweight_plus_added", "plate", 10))).filter(n => n.type === "CellInput")).toHaveLength(2);
 });
 it("labels assistance, seconds and metres correctly", () => {
  expect(texts(render(fixture("assisted", "assisted", 30))).join(" ")).toContain("Assistance");
  const timed = nodes(render(fixture("free", "dumbbell", 10, "time"))).filter(n => n.type === "CellInput");
  expect(timed[1]!.props.a11y).toContain("Seconds");
  const distance = nodes(render(fixture("free", "dumbbell", 10, "distance"))).filter(n => n.type === "CellInput");
  expect(distance[1]!.props.decimal).toBe(true);
 });
});
