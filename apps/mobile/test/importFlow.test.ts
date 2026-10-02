import { describe, expect, it } from "vitest";
import type { TitlePreview } from "../src/db/importRepo";
import { applyEquipmentToUnresolved, dateRange, resolveAll, resolveTitle } from "../src/logic/importFlow";

const mk = (title: string, suggestion: TitlePreview["suggestion"]): TitlePreview => ({ title, workouts: 3, sets: 9, suggestion });
const lib = mk("Bench Press (Barbell)", { kind: "library", exerciseId: "bp", exerciseName: "Barbell Bench Press" });
const saved = mk("Row", { kind: "saved", exerciseId: "r", exerciseName: "Row" });
const known = mk("Hack Squat (Machine)", { kind: "new", nameEn: "Hack Squat (Machine)", pattern: "squat", equipment: "machine", setup: "free" });
const pullUp = mk("Pull Up", { kind: "new", nameEn: "Pull Up", pattern: "vertical_pull", equipment: null, setup: null });
const face = mk("Face Pull", { kind: "new", nameEn: "Face Pull", pattern: "rear_delt", equipment: null, setup: null });

describe("resolving a title", () => {
  it("takes a saved or exact library match as is", () => {
    expect(resolveTitle(lib, undefined)).toMatchObject({ choice: { kind: "existing", exerciseId: "bp" }, origin: "library", missing: [] });
    expect(resolveTitle(saved, undefined)).toMatchObject({ choice: { kind: "existing", exerciseId: "r" }, origin: "saved" });
  });
  it("lets the lifter pick another exercise or create a new one instead", () => {
    expect(resolveTitle(lib, { exerciseId: "other" })).toMatchObject({ choice: { exerciseId: "other" }, origin: "picked" });
    const n = resolveTitle(lib, { createNew: true, equipment: "barbell" });
    expect(n.choice).toEqual({ kind: "new", nameEn: "Bench Press (Barbell)", pattern: "other", equipment: "barbell", setup: "free" });
  });
  it("a title that states its equipment needs nothing more", () => {
    expect(resolveTitle(known, undefined).choice).toEqual({ kind: "new", nameEn: "Hack Squat (Machine)", pattern: "squat", equipment: "machine", setup: "free" });
  });
  it("a title that does not state equipment stays unresolved until the lifter says", () => {
    expect(resolveTitle(pullUp, undefined)).toMatchObject({ choice: null, missing: ["equipment"] });
    expect(resolveTitle(pullUp, { equipment: "cable" }).choice).toMatchObject({ equipment: "cable", setup: "free" });
    expect(resolveTitle(pullUp, { equipment: "assisted" }).choice).toMatchObject({ equipment: "assisted", setup: "assisted" });
  });
  it("plate-loaded added weight needs the setup stated: it is not guessed", () => {
    expect(resolveTitle(pullUp, { equipment: "plate" })).toMatchObject({ choice: null, missing: ["setup"] });
    expect(resolveTitle(pullUp, { equipment: "plate", setup: "bodyweight_plus_added" }).choice).toMatchObject({ setup: "bodyweight_plus_added" });
  });
  it("an empty name blocks, the lifter's pattern and name are kept", () => {
    expect(resolveTitle(known, { nameEn: "  " }).choice).toBeNull();
    expect(resolveTitle(known, { nameEn: "Hack Squat", pattern: "hinge" }).choice).toMatchObject({ nameEn: "Hack Squat", pattern: "hinge" });
  });
});

describe("resolving everything", () => {
  const titles = [lib, known, pullUp, face];
  it("is ready only when every title has a decision", () => {
    const r = resolveAll(titles, {});
    expect(r).toMatchObject({ unresolved: 2, ready: false });
    expect(Object.keys(r.mappings).sort()).toEqual(["Bench Press (Barbell)", "Hack Squat (Machine)"]);
    expect(resolveAll([], {}).ready).toBe(false);
  });
  it("bulk equipment fills only the titles that lack one", () => {
    const o = applyEquipmentToUnresolved(titles, { "Pull Up": { equipment: "assisted" } }, "cable");
    const r = resolveAll(titles, o);
    expect(r.ready).toBe(true);
    expect(r.mappings["Pull Up"]).toMatchObject({ equipment: "assisted" }); // kept the lifter's own answer
    expect(r.mappings["Face Pull"]).toMatchObject({ equipment: "cable" });
    expect(r.mappings["Hack Squat (Machine)"]).toMatchObject({ equipment: "machine" }); // stated by the title: untouched
  });
  it("formats the date range", () => {
    expect(dateRange("2026-01-02", "2026-02-03")).toBe("2026-01-02 – 2026-02-03");
    expect(dateRange("2026-01-02", "2026-01-02")).toBe("2026-01-02");
    expect(dateRange(null, null)).toBe("");
  });
});
