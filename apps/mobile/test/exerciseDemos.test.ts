import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exerciseDemoImageId } from "../src/logic/exerciseDemos";

describe("exercise demo illustrations", () => {
  it("maps exact common seed keys to bundled offline images", () => {
    const examples = [
      ["bench_press", "bench-press"],
      ["incline_db_press", "incline-dumbbell-press"],
      ["triceps_pushdown", "tricep-pushdowns"],
      ["calf_raise", "seated-calf-raise-machine"],
      ["assisted_pullup", "assisted-pull-up"],
      ["db_row", "dumbbell-row"],
      ["db_bench", "dumbbell-chest-press"],
    ] as const;

    for (const [seedKey, imageId] of examples) {
      expect(exerciseDemoImageId(seedKey)).toBe(imageId);
      expect(existsSync(join(__dirname, "../assets/exercise-demos", `${imageId}.webp`))).toBe(true);
    }
  });

  it("does not show a demo for custom, unknown, or missing exercise IDs", () => {
    expect(exerciseDemoImageId("my_custom_exercise")).toBeNull();
    expect(exerciseDemoImageId("cable_fly")).toBeNull();
    expect(exerciseDemoImageId("skullcrusher")).toBeNull();
    expect(exerciseDemoImageId(null)).toBeNull();
    expect(exerciseDemoImageId(undefined)).toBeNull();
  });
});
