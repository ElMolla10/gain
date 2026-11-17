import React from "react";
import { expect, it, vi } from "vitest";
import { WorkoutSessionOverview } from "../src/components/WorkoutSessionOverview";
import { nodes, texts, expand } from "./achievementRender";
import { translate } from "../src/i18n/format";
vi.mock("react", async orig => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Modal: "Modal", ScrollView: "ScrollView" }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ t: (k: any, p?: any) => translate("en", k, p) }) }));
vi.mock("../src/theme", () => ({ radius: { card: 16 }, space: { xs: 4, sm: 8, md: 12, lg: 16 }, useLogPalette: () => ({}) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", IconButton: "IconButton", QuietAction: "QuietAction", BigButton: "BigButton" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
it("shows the complete ordered session with progress and routes jump/add/reorder/remove/back independently", () => {
 const p = { visible: true, exercises: [{ id: "a", name: "Bench", done: 1, total: 3 }, { id: "b", name: "Pull-up", done: 0, total: 2 }], activeId: "a", onJump: vi.fn(), onAdd: vi.fn(), onReorder: vi.fn(), onRemove: vi.fn(), onClose: vi.fn(), onDismiss: vi.fn() };
 const tree = expand(React.createElement(WorkoutSessionOverview, p)), ns = nodes(tree);
 expect(texts(tree).join(" ")).toContain("Bench"); expect(texts(tree).join(" ")).toContain("Pull-up");
 const jumps = ns.filter(n => n.type === "Pressable"); expect(jumps[0]!.props.accessibilityState.selected).toBe(true);
 jumps[1]!.props.onPress(); expect(p.onJump).toHaveBeenCalledWith("b");
 for (const [label, callback] of [["Add exercise", p.onAdd], ["Reorder exercises", p.onReorder]] as const) {
  ns.find(n => n.props.label === label)!.props.onPress(); expect(callback).toHaveBeenCalledOnce();
 }
 ns.find(n => n.props.label === "Remove exercise: Bench")!.props.onPress(); expect(p.onRemove).toHaveBeenCalledWith("a");
 ns.find(n => n.type === "BigButton")!.props.onPress(); expect(p.onClose).toHaveBeenCalledOnce();
});
