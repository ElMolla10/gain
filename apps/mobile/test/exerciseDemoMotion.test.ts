import { describe, expect, it } from "vitest";
import * as motion from "../src/logic/exerciseDemoMotion";

describe("exercise-specific demo motion", () => {
  it("keeps a hanging pull-up's body arrow opposite to a lat pulldown's bar arrow", () => {
    const pullup = motion.exerciseDemoMotion("pullup")!;
    const pulldown = motion.exerciseDemoMotion("lat_pulldown")!;
    expect(pullup).not.toBeNull();
    expect(pulldown).not.toBeNull();
    expect(pullup.arrows[0]!.to[1]).toBeLessThan(pullup.arrows[0]!.from[1]);
    expect(pulldown.arrows[0]!.to[1]).toBeGreaterThan(pulldown.arrows[0]!.from[1]);
  });

  it("uses the pictured rail direction for leg press rather than a vertical squat arrow", () => {
    const legPress = motion.exerciseDemoMotion("leg_press");
    expect(legPress).not.toBeNull();
    const arrow = legPress!.arrows[0]!;
    expect(arrow.to[0]).toBeLessThan(arrow.from[0]);
    expect(arrow.to[1]).toBeGreaterThan(arrow.from[1]);
    const squat = motion.exerciseDemoMotion("back_squat")!.arrows[0]!;
    expect(squat.to[0]).toBe(squat.from[0]);
  });

  it("uses an elbow arc for curls and an outward shoulder arc for lateral raises", () => {
    const curlDemo = motion.exerciseDemoMotion("barbell_curl");
    const raiseDemo = motion.exerciseDemoMotion("lateral_raise_db");
    expect(curlDemo).not.toBeNull();
    expect(raiseDemo).not.toBeNull();
    const curl = curlDemo!.arrows[0]!;
    const raise = raiseDemo!.arrows[0]!;
    expect(curl.controls).toHaveLength(2);
    expect(raise.controls).toHaveLength(2);
    expect(Math.abs(raise.to[0] - raise.from[0])).toBeGreaterThan(0.15);
    expect(curl.to[1]).toBeLessThan(curl.from[1]);
  });

  it("leaves unclear and unmapped illustrations without an invented motion", () => {
    for (const key of ["db_bench", "reverse_pec_deck", "cable_fly", "my_custom_exercise", null, undefined]) {
      expect(motion.exerciseDemoMotion(key)).toBeNull();
    }
  });

  it("projects an arc into the actual image dimensions, not a square stretched over a contained image", () => {
    const d = motion.demoArrowPath({ from: [0.1, 0.9], to: [0.8, 0.2], controls: [[0.2, 0.8], [0.5, 0.3]] }, 200, 100);
    expect(d).toMatch(/^M 20 90 C 40 80 100 30 160 20 /);
    expect(d).toContain("L 160 20 L");
    expect(d).not.toMatch(/NaN|Infinity/);
  });
});
