import { describe, expect, it } from "vitest";
import { canLog } from "../src/logic/draft";
import { MAX_LOAD_KG, parseLoadInput, parseRepsInput, parseTyped } from "../src/logic/setInput";
import { weightText } from "../src/logic/units";

describe("typed set numbers (logger)", () => {
  it("reads plain, decimal, comma-decimal and Arabic-Indic numbers; junk and empty are null", () => {
    expect(parseTyped("62.5")).toBe(62.5);
    expect(parseTyped("62,5")).toBe(62.5);
    expect(parseTyped("٦٢٫٥")).toBe(62.5);
    expect(parseTyped("٨")).toBe(8);
    expect(parseTyped("62.")).toBe(62);
    expect(parseTyped("")).toBeNull();
    expect(parseTyped("abc")).toBeNull();
    expect(parseTyped("12abc")).toBeNull();
    expect(parseTyped("1,2,3")).toBeNull();
    expect(parseTyped("-5")).toBeNull();
  });
  it("weights are typed in the chosen unit and stored in kilograms", () => {
    expect(parseLoadInput("62.5", "kg")).toBe(62.5);
    expect(parseLoadInput("135", "lb")).toBe(61.235);
    expect(parseLoadInput("0", "kg")).toBe(0); // bodyweight / assisted can be zero
    expect(parseLoadInput("1001", "kg")).toBeNull();
    expect(parseLoadInput(String(MAX_LOAD_KG), "kg")).toBe(MAX_LOAD_KG);
  });
  it("typing what a stored kilogram value already shows keeps that exact value (lb)", () => {
    const kg = 20;
    expect(weightText(kg, "lb")).toBe("44.1");
    expect(parseLoadInput("44.1", "lb", kg)).toBe(20);
    expect(parseLoadInput("45", "lb", kg)).toBe(20.412);
  });
  it("reps are whole numbers 1..100", () => {
    expect(parseRepsInput("8")).toBe(8);
    expect(parseRepsInput("٨")).toBe(8);
    expect(parseRepsInput("8.5")).toBeNull();
    expect(parseRepsInput("0")).toBeNull();
    expect(parseRepsInput("101")).toBeNull();
    expect(parseRepsInput("")).toBeNull();
  });
  it("a typed set is loggable only when both numbers are valid", () => {
    const d = (l: string, r: string) => ({ load: parseLoadInput(l, "kg"), reps: parseRepsInput(r), rir: null, warmup: false });
    expect(canLog(d("60", "8"))).toBe(true);
    expect(canLog(d("60", ""))).toBe(false);
    expect(canLog(d("x", "8"))).toBe(false);
  });
});

import { parseRirInput } from "../src/logic/setInput";
describe("reps left (RIR) input", () => {
  it("is a whole number 0..10; anything else is not tracked", () => {
    expect(parseRirInput("0")).toBe(0);
    expect(parseRirInput("2")).toBe(2);
    expect(parseRirInput("10")).toBe(10);
    expect(parseRirInput("11")).toBeNull();
    expect(parseRirInput("1.5")).toBeNull();
    expect(parseRirInput("")).toBeNull();
  });
});
