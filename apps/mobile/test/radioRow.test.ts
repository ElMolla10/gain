import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";

const ui = readFileSync(join(__dirname, "../src/ui.tsx"), "utf8");
const onboarding = readFileSync(join(__dirname, "../src/screens/OnboardingScreen.tsx"), "utf8");
const block = (src: string, start: string) => {
  const i = src.indexOf(start);
  const j = src.indexOf("\nexport function", i + start.length);
  return src.slice(i, j < 0 ? undefined : j);
};

describe("one radio-row pattern (plan 1.4)", () => {
  it("no primary BigButton is used as a radio button in onboarding", () => {
    expect(onboarding).not.toMatch(/<BigButton[^>]*\bselected=/);
  });
  it("RadioRow: radio role, checked state, accent border + check when selected, edge outline when not", () => {
    const row = block(ui, "export function RadioRow");
    expect(row).toContain('accessibilityRole="radio"');
    expect(row).toContain("checked: props.selected");
    expect(row).toContain("minHeight: 56");
    expect(row).toContain("borderWidth: props.selected ? 2 : 1.5");
    expect(row).toContain("borderColor: props.selected ? p.accent : p.edge");
    expect(row).toContain('<Icon name="check" color={p.accent} size={22} />');
    expect(block(ui, "export function RadioGroup")).toContain('accessibilityRole="radiogroup"');
  });
  it("ChoiceSheet renders its options through RadioRow", () => {
    const sheet = block(ui, "export function ChoiceSheet");
    expect(sheet).toContain("<RadioRow");
    expect(sheet).toContain("<RadioGroup>");
  });
  it("Chip is at least 48 wide and can be a radio", () => {
    const chip = block(ui, "export function Chip");
    expect(chip).toContain("minWidth: MIN_TOUCH");
    expect(chip).toContain('accessibilityRole={props.radio ? "radio" : "button"}');
    expect(chip).toContain("checked: !!props.selected");
  });
  it("onboarding uses radio rows for language, units and programme mode, and radio chips for single-select groups", () => {
    expect(onboarding.match(/<RadioRow /g)?.length).toBe(7);
    expect(onboarding.match(/<Chip radio /g)?.length).toBe(4);
    expect(onboarding).not.toMatch(/<Chip (?!radio)/);
  });
  it("programme mode descriptions exist in English and Arabic", () => {
    for (const k of ["ob.programme.templateDetail", "ob.programme.buildDetail", "ob.programme.ownDetail"] as const) {
      expect(en[k]).toBeTruthy();
      expect(ar[k]).toMatch(/[\u0600-\u06ff]/);
    }
  });
});
