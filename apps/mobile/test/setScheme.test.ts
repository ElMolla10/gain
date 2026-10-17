import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schemeCounts, schemePips } from "../src/logic/setScheme";
import { clampStep, parseTyped, repeatsAfter, REPEAT_DELAY_MS, REPEAT_EVERY_MS } from "../src/logic/stepper";
import { en, ar } from "../src/i18n/strings";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("2.2 Editor: scheme pips and faster steppers (P-3, P-9)", () => {
  it("one pip per set; top pips equal topSets; straight is all work", () => {
    expect(schemePips(3, 1)).toEqual(["top", "backoff", "backoff"]);
    expect(schemeCounts(schemePips(5, 2))).toEqual({ top: 2, backoff: 3 });
    expect(schemePips(4, null)).toEqual(["work", "work", "work", "work"]);
    expect(schemePips(2, 9)).toEqual(["top", "top"]);
    expect(schemePips(0, 1)).toEqual([]);
  });
  it("caption strings exist in both languages", () => {
    expect(en["prog.ex.schemeCaption"]).toBe("{top} top + {back} back-off");
    expect(ar["prog.ex.schemeCaption"]).toContain("{top}");
  });
  it("repeat schedule: 400 ms then every 120 ms", () => {
    expect([REPEAT_DELAY_MS, REPEAT_EVERY_MS]).toEqual([400, 120]);
    expect(repeatsAfter(399)).toBe(0);
    expect(repeatsAfter(400)).toBe(1);
    expect(repeatsAfter(400 + 120 * 5)).toBe(6);
  });
  it("typed values clamp, accept Arabic digits, and keep the old value on junk", () => {
    expect(clampStep(150, 1, 100)).toBe(100);
    expect(parseTyped("150", 8, 1, 100)).toBe(100);
    expect(parseTyped("٢٥", 8, 1, 100)).toBe(25);
    expect(parseTyped("", 8, 1, 100)).toBe(8);
    expect(parseTyped("abc", 8, 1, 100)).toBe(8);
    expect(parseTyped("2.6", 2.5, 0, 10, 0.5)).toBe(2.5);
  });
  it("the Stepper repeats on hold, stops on release/unmount, and the value is tappable to type", () => {
    const ui = src("ui.tsx");
    const stepper = ui.slice(ui.indexOf("export function Stepper"), ui.indexOf("export function Stepper") + 4000);
    expect(stepper).toMatch(/onPressIn=/);
    expect(stepper).toMatch(/onPressOut=\{stop\}/);
    expect(stepper).toMatch(/useEffect\(\(\) => stop, \[\]\)/);
    expect(stepper).toMatch(/setTyping\(String\(props\.value\)\)/);
    expect(src("components/ProgrammeEditorView.tsx")).toContain("<SchemePips sets={e.sets} topSets={e.topSets} />");
  });
});
