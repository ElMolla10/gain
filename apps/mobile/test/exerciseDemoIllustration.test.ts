import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ExerciseDemoIllustration } from "../src/components/ExerciseDemoIllustration";
import { nodes } from "./achievementRender";

vi.mock("react-native", () => ({ View: "View", Image: "Image" }));
vi.mock("react-native-svg", () => ({ default: "Svg", G: "G", Path: "Path" }));
vi.mock("../src/theme", () => ({ radius: { card: 12 } }));

const render = (seedKey: string) => nodes(ExerciseDemoIllustration({ seedKey, source: 1, accessibilityLabel: "Exercise illustration", backgroundColor: "#10120E" }));

describe("static demo illustration overlay", () => {
  it("contains the image and arrow in the same landscape coordinates without intercepting sheet gestures", () => {
    const tree = render("bench_press");
    expect(tree.find(n => n.type === "Image")?.props).toMatchObject({ source: 1, resizeMode: "contain", accessibilityLabel: "Exercise illustration" });
    expect(tree.find(n => n.type === "Svg")?.props).toMatchObject({ viewBox: "0 0 1536 512", preserveAspectRatio: "xMidYMid meet", pointerEvents: "none", accessibilityElementsHidden: true });
    expect(tree[0]!.props.style.direction).toBe("ltr");
    const paths = tree.filter(n => n.type === "Path");
    expect(paths).toHaveLength(2);
    expect(paths[0]!.props.d).toBe(paths[1]!.props.d);
    expect(paths[0]!.props.strokeWidth).toBeGreaterThan(paths[1]!.props.strokeWidth);
  });

  it.each(["db_bench", "cable_lateral_raise", "reverse_pec_deck", "custom_exercise"])("keeps %s as the original image without a fallback arrow", (key) => {
    const tree = render(key);
    expect(tree.filter(n => n.type === "Image")).toHaveLength(1);
    expect(tree.filter(n => n.type === "Svg")).toHaveLength(0);
  });
});
