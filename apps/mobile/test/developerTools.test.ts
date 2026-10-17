import React, { type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DeveloperTools } from "../src/components/DeveloperTools";
import { translate } from "../src/i18n/format";
vi.mock("../src/i18n", () => ({ useI18n: () => ({t:(key:Parameters<typeof translate>[1]) => translate("en",key)}) }));
vi.mock("../src/components/SettingsRows", () => ({Group:"Group",LinkRow:"LinkRow",SwitchRow:"SwitchRow"}));
vi.mock("../src/components/MlAccuracyCard", () => ({MlAccuracyCard:"MlAccuracyCard"}));
type Node = ReactElement<Record<string, any>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
describe("Developer Mode tools", () => {
  it("does not mount diagnostics, evaluation, or internal logs for ordinary users", () => {
    expect(DeveloperTools({enabled:false,saving:false,onChange:vi.fn(),onNavigate:vi.fn()})).toBeNull();
  });
  it("retains evaluation/export, diagnostic routes and a way to turn the mode off", () => {
    const props = {enabled:true,saving:true,onChange:vi.fn(),onNavigate:vi.fn()};
    const tree = nodes(DeveloperTools(props));
    expect(tree.some(n => n.type as unknown === "MlAccuracyCard")).toBe(true);
    const toggle = tree.find(n => n.type as unknown === "SwitchRow")!;
    expect(toggle.props.disabled).toBe(true);
    toggle.props.onChange(false);
    expect(props.onChange).toHaveBeenCalledWith(false);
    tree.filter(n => n.type as unknown === "LinkRow").forEach(n => n.props.onPress());
    expect(props.onNavigate.mock.calls).toEqual([["DecisionLog"],["Diagnostics"],["StoppedSuggestions"]]);
  });
});
