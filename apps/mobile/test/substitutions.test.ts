import { describe, expect, it } from "vitest";
import type { LibraryExercise } from "../src/db/programmeRepo";
import { substitutionCandidates } from "../src/logic/substitutions";
import { swapExercise, newExercise, type ProgrammeDraft } from "../src/logic/programmeDraft";

const ex = (over: Partial<LibraryExercise> & Pick<LibraryExercise, "id" | "nameEn" | "pattern" | "equipment">): LibraryExercise => ({
  seedKey: over.seedKey ?? over.id,
  nameAr: over.nameAr ?? over.nameEn,
  aliasesAr: [],
  setup: "free",
  measure: "reps",
  isCustom: false,
  ...over,
});

const bench = ex({ id: "bench", nameEn: "Barbell Bench Press", pattern: "horizontal_push", equipment: "barbell", seedKey: "bench_press" });
const dbBench = ex({ id: "db_bench", nameEn: "Dumbbell Bench Press", pattern: "horizontal_push", equipment: "dumbbell", seedKey: "db_bench" });
const fly = ex({ id: "fly", nameEn: "Cable Fly", pattern: "horizontal_push", equipment: "cable", seedKey: "cable_fly" });
const squat = ex({ id: "squat", nameEn: "Back Squat", pattern: "squat", equipment: "barbell", seedKey: "back_squat" });
const curl = ex({ id: "curl", nameEn: "Dumbbell Curl", pattern: "elbow_flexion", equipment: "dumbbell", seedKey: "db_curl" });
const machinePress = ex({ id: "machine_press", nameEn: "Chest Press Machine", pattern: "horizontal_push", equipment: "machine", seedKey: "chest_press_machine" });

const library = [bench, dbBench, fly, squat, curl, machinePress];

describe("substitutionCandidates", () => {
  it("keeps the same pattern or muscle and only equipment that exists in this gym", () => {
    const gym = substitutionCandidates({ current: bench, library, gymEquipment: ["dumbbell", "cable"] });
    expect(gym.map((e) => e.id).sort()).toEqual(["db_bench", "fly"]);
    expect(gym.some((e) => e.id === "squat" || e.id === "bench" || e.id === "machine_press")).toBe(false);
  });
  it("with a fatigue flag prefers isolation of the same muscle over the same compound pattern", () => {
    const isolation = ex({ id: "pec", nameEn: "Pec Deck", pattern: "horizontal_push", equipment: "machine", seedKey: "pec_deck" });
    const list = substitutionCandidates({
      current: bench,
      library: [...library, isolation],
      gymEquipment: ["barbell", "dumbbell", "cable", "machine"],
      fatigue: true,
    });
    expect(list[0]?.id).not.toBe("squat");
    expect(list.map((e) => e.id)).toContain("fly");
  });
  it("returns nothing when the gym cannot load any substitute", () => {
    expect(substitutionCandidates({ current: bench, library, gymEquipment: ["assisted"] })).toEqual([]);
  });
});

describe("swapExercise", () => {
  it("replaces the slot and keeps the original exercise id out of the day, so history stays on its own line", () => {
    const d: ProgrammeDraft = { name: "P", days: [{ name: "Push", exercises: [newExercise("bench", { sets: 4 }), newExercise("fly")] }] };
    const swapped = swapExercise(d, 0, 0, "db_bench");
    expect(swapped.days[0]!.exercises[0]).toMatchObject({ exerciseId: "db_bench", sets: 4 });
    expect(swapped.days[0]!.exercises.map((e) => e.exerciseId)).toEqual(["db_bench", "fly"]);
    expect(d.days[0]!.exercises[0]!.exerciseId).toBe("bench");
    expect(swapExercise(d, 0, 0, "fly")).toBe(d);
  });
});
