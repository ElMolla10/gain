import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { CellInput } from "../src/components/LogParts";
import { nodes } from "./achievementRender";
import { weightText } from "../src/logic/units";
import { parseLoadInput } from "../src/logic/setInput";
const host = vi.hoisted(() => ({ i: 0, values: [] as any[], pending: [] as (() => void)[] }));
vi.mock("react", async orig => {
 const real: any = await orig();
 return (await import("./achievementRender")).mockReactHooks(real, {
  useState: (initial: any) => { const i = host.i++; if (!(i in host.values)) host.values[i] = typeof initial === "function" ? initial() : initial; return [host.values[i], (v: any) => { host.values[i] = typeof v === "function" ? v(host.values[i]) : v; }]; },
  useRef: (initial: any) => { const i = host.i++; return host.values[i] ??= { current: initial }; },
  useEffect: (fn: () => void, deps: any[]) => { const i = host.i++, old = host.values[i]; if (!old || deps.some((v, j) => !Object.is(v, old[j]))) host.pending.push(fn); host.values[i] = deps; },
 });
});
vi.mock("react-native", () => ({ View: "View", TextInput: "TextInput", AccessibilityInfo: { announceForAccessibility: vi.fn() } }));
vi.mock("../src/theme", () => ({ INPUT_HEIGHT: 48, radius: { input: 8 }, type: { section: 20 }, useLogPalette: () => ({}) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", useInputFont: () => ({}) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ t: (s: string) => s }) }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/numberPad", () => ({ numberPadAccessory: () => ({}) }));
function render(p: Parameters<typeof CellInput<number>>[0]) {
 let tree: any;
 for (let n = 0; n < 2; n++) { host.i = 0; host.pending = []; tree = CellInput(p); for (const fn of host.pending) fn(); }
 return nodes(tree).find(n => n.type === "TextInput")!.props;
}
beforeEach(() => { host.i = 0; host.values = []; host.pending = []; });
it("reformats a typed load on unit switching without changing stored kilograms", () => {
 let unit: "kg" | "lb" = "kg";
 const onValue = vi.fn();
 const p = { a11y: "Weight", value: 67.5, format: (v: number) => weightText(v, unit), parse: (s: string, cur: number | null) => parseLoadInput(s, unit, cur), onValue };
 expect(render(p).value).toBe("67.5"); unit = "lb"; expect(render(p).value).toBe("148.8");
 unit = "kg"; expect(render(p).value).toBe("67.5"); expect(p.value).toBe(67.5); expect(onValue).not.toHaveBeenCalled();
});
it("keeps valid partial typing across rerenders and converts it only when units change", () => {
 let unit: "kg" | "lb" = "kg";
 const p = { a11y: "Weight", value: 67.5 as number | null, format: (v: number) => weightText(v, unit), parse: (s: string, cur: number | null) => parseLoadInput(s, unit, cur), onValue: vi.fn((v: number | null) => { p.value = v; }) };
 render(p).onFocus(); render(p).onChangeText("67.");
 expect(render(p).value).toBe("67."); expect(render(p).value).toBe("67.");
 unit = "lb"; expect(render(p).value).toBe("147.7"); expect(p.value).toBe(67); expect(p.onValue).toHaveBeenCalledOnce();
});
