import { describe, expect, it } from "vitest";
import { warmupsUsuallySkipped } from "../src/logic/warmups";

describe("warm-ups for later isolation exercises (P25)", () => {
  it("are usually skipped from the third exercise on, for single-joint patterns only", () => {
    expect(warmupsUsuallySkipped(2, "elbow_flexion")).toBe(true);
    expect(warmupsUsuallySkipped(4, "shoulder_isolation")).toBe(true);
    expect(warmupsUsuallySkipped(3, "calf")).toBe(true);
  });
  it("are still offered for the first two exercises and for big lifts", () => {
    expect(warmupsUsuallySkipped(0, "elbow_flexion")).toBe(false);
    expect(warmupsUsuallySkipped(1, "knee_extension")).toBe(false);
    expect(warmupsUsuallySkipped(3, "horizontal_push")).toBe(false);
    expect(warmupsUsuallySkipped(3, "squat")).toBe(false);
    expect(warmupsUsuallySkipped(3, undefined)).toBe(false);
  });
});
