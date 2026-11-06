import React from "react";
import { describe, expect, it, vi } from "vitest";
import { byType, expand } from "./achievementRender";

vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({
  View: "View", ScrollView: "ScrollView", Text: "Text", Pressable: "Pressable",
  StyleSheet: { create: (s: unknown) => s },
  Platform: { OS: "ios" },
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: "en", direction: "ltr" }) }));
vi.mock("../src/theme", () => ({
  space: { lg: 16, md: 12, sm: 8, xl: 24 },
  type: {}, radius: {},
  usePalette: () => ({ bg: "bg", border: "border" }),
}));

import { Screen } from "../src/ui";

describe("Screen footer safe area ownership", () => {
  it.each([[true, 12], [false, 46]])("tab=%s counts the bottom inset only when the tab bar does not own it", (tab, paddingBottom) => {
    const tree = expand(React.createElement(Screen, { tab, footer: "Start", children: "Last exercise" }));
    const footer = byType(tree, "View").find((n) => n.props.children === "Start")!;
    expect(footer.props.style.paddingBottom).toBe(paddingBottom);
    // The pinned footer is a sibling of the scroll viewport; it never overlays the last row.
    expect(footer.props.style.position).toBeUndefined();
    expect(byType(tree, "ScrollView")[0]!.props.children).toContain("Last exercise");
  });
  it("large-text inline footer remains inside the scrolling content", () => {
    const tree = expand(React.createElement(Screen, { tab: true, footer: "Start", footerInline: true, children: "Last exercise" }));
    const scroll = byType(tree, "ScrollView")[0]!;
    expect(byType(scroll, "View").some((n) => n.props.children === "Start")).toBe(true);
  });
});
