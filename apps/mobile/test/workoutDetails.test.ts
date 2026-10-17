import React, { type ReactElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import { ar, en } from "../src/i18n/strings";
import { WorkoutDetailsPanel } from "../src/components/WorkoutDetailsPanel";

// Inspect the presentation tree and invoke its callbacks, as in workoutSetRow.test.ts.
const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ ...settings, t: (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(settings.lang, key, params) }) }));
vi.mock("../src/theme", () => ({ radius: { button: 8 }, space: { xs: 4, sm: 8, md: 12, lg: 16 }, useLogPalette: () => ({ accent: "accent", muted: "muted", line: "line" }) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", Chip: "Chip", QuietAction: "QuietAction" }));

type Node = ReactElement<Record<string, any>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const node = value as Node;
  if (typeof node.type === "function") return nodes((node.type as (p: unknown) => unknown)(node.props));
  return [node, ...nodes(node.props.children)];
}
const panel = (extra: Partial<Parameters<typeof WorkoutDetailsPanel>[0]> = {}) => ({
  open: true, readiness: null, onReadiness: vi.fn(), previousSource: "any" as const, onPreviousSource: vi.fn(), onReorder: vi.fn(), ...extra,
});
const chips = (tree: Node[]) => tree.filter(n => n.type as unknown === "Chip");
const radios = (tree: Node[]) => tree.filter(n => n.props.accessibilityRole === "radio");
const screen = readFileSync(join(__dirname, "..", "src", "screens", "WorkoutScreen.tsx"), "utf8");

beforeEach(() => { settings.lang = "en"; });
describe("Workout details panel", () => {
  it("is closed by default for the session: no readiness chips or Previous toggle", () => {
    expect(screen).toContain("const [detailsOpen, setDetailsOpen] = useState(false);");
    expect(screen).toMatch(/QuietAction label=\{t\("workout\.details"\)\} expanded=\{detailsOpen\}/);
    expect(screen).toContain("open={detailsOpen}");
    // Nothing session-level is rendered outside the panel any more.
    expect(screen).not.toContain("PreviousSourceToggle");
    expect(screen).not.toContain("workout.readiness.");
    expect(screen).not.toContain('"workout.reorder.button"');
    expect(WorkoutDetailsPanel(panel({ open: false }))).toBeNull();
  });
  it("opening it shows the readiness chips, the Previous toggle and Reorder", () => {
    const tree = nodes(WorkoutDetailsPanel(panel()));
    expect(chips(tree).map(c => c.props.label)).toEqual(["Normal", "Unusually fatigued", "Returning after a break"]);
    expect(chips(tree)[0]!.props.selected).toBe(true);
    expect(radios(tree)).toHaveLength(2);
    expect(radios(tree)[0]!.props.accessibilityState).toEqual({ checked: true });
    expect(tree.some(n => n.type as unknown === "QuietAction" && n.props.label === "Reorder exercises")).toBe(true);
    expect(nodes(WorkoutDetailsPanel(panel({ onReorder: undefined }))).some(n => n.props.label === "Reorder exercises")).toBe(false);
  });
  it("changing readiness or the Previous source inside the panel still takes effect", () => {
    const p = panel({ readiness: "fatigued", previousSource: "routine" });
    const tree = nodes(WorkoutDetailsPanel(p));
    expect(chips(tree)[1]!.props.selected).toBe(true);
    chips(tree)[2]!.props.onPress();
    expect(p.onReadiness).toHaveBeenLastCalledWith("returning");
    chips(tree)[0]!.props.onPress();
    expect(p.onReadiness).toHaveBeenLastCalledWith(null);
    radios(tree)[0]!.props.onPress();
    expect(p.onPreviousSource).toHaveBeenLastCalledWith("any");
    // The screen still saves readiness to the session and the source through the persisted chooser.
    expect(screen).toContain("void workout.setSessionReadiness(loaded.sessionId, next);");
    expect(screen).toContain("onPreviousSource={source => void choosePreviousSource(source)}");
  });
  it("speaks Arabic and has the toggle string in both languages", () => {
    expect(en["workout.details"]).toBe("Workout details");
    expect(ar["workout.details"]).toBeTruthy();
    expect(ar["workout.details"]).not.toBe(en["workout.details"]);
    settings.lang = "ar";
    expect(chips(nodes(WorkoutDetailsPanel(panel())))[0]!.props.label).toBe("عادي");
  });
});
