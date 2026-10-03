import { describe, expect, it } from "vitest";
import { chartBars } from "../src/logic/trendChart";
import { liveSummary } from "../src/logic/liveSummary";
import { newExerciseFor, resetRangeFor, validateDraft, newExercise, addExercise, addDay } from "../src/logic/programmeDraft";
import { hasNumber } from "../src/logic/decisionText";
import {
  isTimed, parseMetresInput, parseQuantityInput, parseSecondsInput, previousQuantityText, quantityFields, quantityText, setQuantity, targetPhrase, targetQuantity,
} from "../src/logic/quantity";

describe("seconds input", () => {
  it("takes whole seconds, mm:ss and Arabic digits; refuses 0, junk and out of range", () => {
    expect(parseSecondsInput("45")).toBe(45);
    expect(parseSecondsInput("1:30")).toBe(90);
    expect(parseSecondsInput("٤٥")).toBe(45);
    expect(parseSecondsInput("60:00")).toBe(3600);
    for (const bad of ["0", "", "abc", "1:75", "61:00", "3601", "4.5", "-3", "0:00"]) expect(parseSecondsInput(bad), bad).toBeNull();
  });
  it("metres: above 0, up to 5000, one decimal", () => {
    expect(parseMetresInput("30")).toBe(30);
    expect(parseMetresInput("12.25")).toBe(12.3);
    expect(parseMetresInput("12,5")).toBe(12.5);
    for (const bad of ["0", "5001", "x", ""]) expect(parseMetresInput(bad), bad).toBeNull();
  });
  it("dispatches by how the exercise is counted", () => {
    expect(parseQuantityInput("45", "time")).toBe(45);
    expect(parseQuantityInput("45", "distance")).toBe(45);
    expect(parseQuantityInput("45", "reps")).toBeNull();
  });
});

describe("quantity helpers", () => {
  it("what is passed to the database: reps = 1 plus the seconds or metres", () => {
    expect(quantityFields(45, "time")).toEqual({ reps: 1, durationS: 45 });
    expect(quantityFields(30, "distance")).toEqual({ reps: 1, distanceM: 30 });
    expect(quantityFields(8, "reps")).toEqual({ reps: 8 });
  });
  it("reads a set back by measure", () => {
    expect(setQuantity({ reps: 1, durationS: 45 }, "time")).toBe(45);
    expect(setQuantity({ reps: 1, distanceM: 30 }, "distance")).toBe(30);
    expect(setQuantity({ reps: 8 }, "reps")).toBe(8);
    expect(setQuantity({ reps: 1 }, "time")).toBe(1);
  });
  it("text: bare for a bodyweight hold, with the load when loaded; reps unchanged", () => {
    const kg = (x: number) => `${x}kg`;
    expect(targetPhrase(0, 45, "time", kg)).toBe("45 s");
    expect(targetPhrase(24, 30, "distance", kg)).toBe("24kg × 30 m");
    expect(targetPhrase(60, 8, "reps", kg)).toBe("60kg × 8");
    expect(targetPhrase(0, 45, "time", kg, { s: "ث", m: "م" })).toBe("45 ث");
    expect(quantityText(30, "distance")).toBe("30 m");
    expect(isTimed("time")).toBe(true);
    expect(isTimed("reps")).toBe(false);
  });
  it("PREVIOUS cell", () => {
    const last = [{ load: 0, reps: 1, durationS: 40 }, { load: 10, reps: 1, durationS: 35 }];
    const kg = (x: number) => `${x}kg`;
    expect(previousQuantityText(last, 0, "time", kg)).toBe("40 s");
    expect(previousQuantityText(last, 1, "time", kg)).toBe("10kg x 35 s");
    expect(previousQuantityText(last, 2, "time", kg)).toBe("—");
    expect(previousQuantityText(null, 0, "time", kg)).toBe("—");
    expect(previousQuantityText(last, null, "time", kg)).toBe("—");
  });
  it("target quantity by measure", () => {
    expect(targetQuantity({ reps: null, durationS: 50, distanceM: null }, "time")).toBe(50);
    expect(targetQuantity({ reps: null, durationS: null, distanceM: 40 }, "distance")).toBe(40);
    expect(targetQuantity({ reps: 8 }, "reps")).toBe(8);
    expect(targetQuantity({ reps: null, durationS: null }, "time")).toBeNull();
  });
});

describe("screens' logic with timed lines", () => {
  it("a timed set adds nothing to the workout volume (it has no reps)", () => {
    const v = liveSummary([{ load: 20, reps: 1, warmup: false, durationS: 45 }, { load: 60, reps: 8, warmup: false }], null, 0);
    expect(v.volumeKg).toBe(480);
    expect(v.sets).toBe(2);
  });
  it("the trend chart of a constant-load hold follows the seconds", () => {
    const pts = [30, 40, 50].map((q, i) => ({ at: i, load: 0, reps: 1, sets: 2, quantity: q }));
    const bars = chartBars(pts, false);
    expect(bars[0]!.frac).toBeLessThan(bars[1]!.frac);
    expect(bars[1]!.frac).toBeLessThan(bars[2]!.frac);
  });
  it("a decision with a seconds target counts as a number", () => {
    expect(hasNumber({ load: 0, reps: null, currency: "load", measure: "time", durationS: 50, distanceM: null })).toBe(true);
    expect(hasNumber({ load: 0, reps: null, currency: "load", measure: "time", durationS: null, distanceM: null })).toBe(false);
    expect(hasNumber({ load: 60, reps: 8, currency: "reps" })).toBe(true);
  });
  it("a new slot for a hold starts at the hold range; switching resets every slot of that exercise", () => {
    expect(newExerciseFor("x", "time")).toMatchObject({ sets: 3, repMin: 30, repMax: 60 });
    expect(newExerciseFor("x", "distance")).toMatchObject({ repMin: 20, repMax: 40 });
    expect(newExerciseFor("x", "reps")).toMatchObject({ repMin: 6, repMax: 10 });
    let d = addDay({ name: "P", days: [] }, "Day");
    d = addExercise(d, 0, newExercise("x", { repMin: 8, repMax: 12, repCeiling: 12, isGoalLift: true }));
    const t = resetRangeFor(d, "x", "time");
    expect(t.days[0]!.exercises[0]).toMatchObject({ repMin: 30, repMax: 60, repCeiling: null, isGoalLift: false });
    expect(validateDraft(t)).toEqual([]);
    expect(resetRangeFor(t, "x", "reps").days[0]!.exercises[0]).toMatchObject({ repMin: 6, repMax: 10 });
  });
});
