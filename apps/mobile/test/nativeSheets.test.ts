import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" }, Animated: { Value: class {} }, PanResponder: {}, StyleSheet: { create: (x: unknown) => x } }));
vi.mock("react-native-safe-area-context", () => ({}));
vi.mock("../src/components/Icon", () => ({}));
vi.mock("../src/fonts", () => ({}));
vi.mock("../src/i18n", () => ({}));
vi.mock("../src/theme", () => ({}));
import { sheetShouldDismiss } from "../src/ui";

const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

describe("iOS-native sheets (iOS audit 9)", () => {
  it("dismisses past 30% of the card height or on a fast flick, else springs back", () => {
    expect(sheetShouldDismiss(301, 0, 1000)).toBe(true);
    expect(sheetShouldDismiss(299, 0.5, 1000)).toBe(false);
    expect(sheetShouldDismiss(50, 1.2, 1000)).toBe(true);
    expect(sheetShouldDismiss(-200, 0, 1000)).toBe(false);
  });
  it("Sheet fades the backdrop, slides an Animated card and drags only on the grabber + header", () => {
    const ui = read("src/ui.tsx");
    const sheet = ui.slice(ui.indexOf("export function Sheet("), ui.indexOf("export function ChoiceSheet"));
    expect(sheet).toMatch(/animationType=\{reduced \? "none" : "fade"\}/);
    expect(sheet).toMatch(/<Animated\.View accessibilityViewIsModal/);
    expect(sheet).toMatch(/transform: \[\{ translateY \}\]/);
    expect(sheet).toMatch(/PanResponder\.create/);
    expect(sheet).toMatch(/<View \{\.\.\.pan\.panHandlers\}>\s*<View style=\{\{ alignSelf: "center"/);
    expect(sheet.indexOf("pan.panHandlers")).toBeLessThan(sheet.indexOf("<ScrollView"));
    expect(sheet).toMatch(/onRequestClose=\{close\}/);
    expect(sheet).toMatch(/icon="close"/);
  });
  it("picker and workout settings are iOS page sheets; reorder stays full-screen", () => {
    for (const f of ["src/components/ExercisePicker.tsx", "src/components/WorkoutSettingsModal.tsx"]) {
      expect(read(f), f).toMatch(/Platform\.OS === "ios" \? \{ presentationStyle: "pageSheet" as const, allowSwipeDismissal: true \} : \{\}/);
      expect(read(f), f).toMatch(/paddingTop: Platform\.OS === "ios" \? 0 : insets\.top/);
    }
    expect(read("src/components/ExerciseReorderModal.tsx")).not.toMatch(/pageSheet/);
  });
});
