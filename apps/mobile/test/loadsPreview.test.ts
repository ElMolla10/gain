import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { previewTokens, PREVIEW_CAP } from "../src/logic/loadsPreview";
import { emptyLoadsForm } from "../src/logic/exerciseLoads";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("2.3 Available weights preview (P-5)", () => {
  it("list: 20, 22.5, x, 25 -> three pills and one invalid", () => {
    expect(previewTokens({ ...emptyLoadsForm(), mode: "list", listText: "20, 22.5, x, 25" })).toEqual({ values: [20, 22.5, 25], invalid: ["x"], more: 0 });
  });
  it("step 2.5 from 20 to 60 -> 12 pills + 5 more", () => {
    const r = previewTokens({ ...emptyLoadsForm(), mode: "step", stepText: "2.5", minText: "20", maxText: "60" });
    expect(r.values).toHaveLength(PREVIEW_CAP);
    expect(r.values[0]).toBe(20);
    expect(r.more).toBe(5);
  });
  it("empty or default -> nothing", () => {
    expect(previewTokens(emptyLoadsForm())).toEqual({ values: [], invalid: [], more: 0 });
    expect(previewTokens({ ...emptyLoadsForm(), mode: "list" })).toEqual({ values: [], invalid: [], more: 0 });
  });
  it("mode is a SelectRow, Reset is quiet, save path unchanged", () => {
    const f = src("screens/ExerciseLoadsScreen.tsx");
    expect(f).toMatch(/<SelectRow label=\{t\("loads\.mode"\)\}/);
    expect(f).not.toMatch(/<Chip /);
    expect(f).toMatch(/<QuietAction label=\{t\("loads\.reset"\)\}/);
    expect(f).toContain("buildLoads(f, data.equipment, unit, specValues(data.spec))");
    expect(f).toMatch(/direction: "ltr"/);
  });
});
