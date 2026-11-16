import { describe, expect, it } from "vitest";
import { inputScrollOffset } from "../src/logic/workoutKeyboard";

describe("logger input visibility above the keyboard and dock", () => {
  it("reveals a later row above the reduced viewport, including Arabic and large-text row heights", () => {
    expect(inputScrollOffset(290, 48, 0, 180)).toBe(166);
    expect(inputScrollOffset(390, 64, 120, 140)).toBe(322);
  });
  it("does not move a fully visible input", () => {
    expect(inputScrollOffset(180, 48, 160, 180)).toBe(160);
  });
  it("reveals a row above the viewport without scrolling past the beginning", () => {
    expect(inputScrollOffset(80, 48, 200, 180)).toBe(72);
    expect(inputScrollOffset(0, 48, 200, 180)).toBe(0);
  });
});
