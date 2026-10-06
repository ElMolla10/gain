import { describe, expect, it } from "vitest";
import { validateDraft } from "../src/logic/programmeDraft";
import { draftExerciseFromPreview, prescriptionFromSession, type WorkoutSetSource, type WorkoutSlotSource } from "../src/logic/workoutDay";

const set = (over: Partial<WorkoutSetSource> & Pick<WorkoutSetSource, "exerciseId" | "reps">): WorkoutSetSource => ({
  deleted: false,
  warmup: false,
  tags: [],
  outlier: "none",
  durationS: null,
  distanceM: null,
  ...over,
});

const slot = (over: Partial<WorkoutSlotSource> & Pick<WorkoutSlotSource, "slot">): WorkoutSlotSource => ({
  removed: false,
  added: false,
  position: null,
  superset: null,
  replacedBy: null,
  ...over,
});

const reps = () => "reps" as const;

describe("prescriptionFromSession", () => {
  it("counts working sets only and keeps their rep range", () => {
    const rows = prescriptionFromSession({
      programmeSlots: ["bench"],
      slots: [],
      measureOf: reps,
      sets: [
        set({ exerciseId: "bench", reps: 10, warmup: true }),
        set({ exerciseId: "bench", reps: 4, tags: ["drop"] }),
        set({ exerciseId: "bench", reps: 12, outlier: "rejected" }),
        set({ exerciseId: "bench", reps: 1, outlier: "unconfirmed" }),
        set({ exerciseId: "bench", reps: 15, deleted: true }),
        set({ exerciseId: "bench", reps: 0 }),
        set({ exerciseId: "bench", reps: 8.5 }),
        set({ exerciseId: "bench", reps: 8 }),
        set({ exerciseId: "bench", reps: 6, outlier: "confirmed" }),
      ],
    });
    expect(rows).toEqual([{ exerciseId: "bench", sets: 2, repMin: 6, repMax: 8, combined: false, superset: null }]);
    expect(rows[0]).not.toHaveProperty("load");
    const draft = draftExerciseFromPreview(rows[0]!);
    expect(draft).toEqual({ exerciseId: "bench", sets: 2, repMin: 6, repMax: 8, repCeiling: null, isGoalLift: false, trackEffort: false, topSets: null });
  });

  it("leaves the day empty when every set is a warm-up, a drop, or not counted", () => {
    expect(prescriptionFromSession({
      programmeSlots: ["bench"],
      slots: [slot({ slot: "bench" })],
      measureOf: reps,
      sets: [set({ exerciseId: "bench", reps: 10, warmup: true }), set({ exerciseId: "bench", reps: 5, tags: ["drop"] })],
    })).toEqual([]);
  });

  it("omits a removed exercise even when a stray set is still stored for it", () => {
    const rows = prescriptionFromSession({
      programmeSlots: ["bench", "row"],
      slots: [slot({ slot: "bench", removed: true })],
      measureOf: reps,
      sets: [set({ exerciseId: "bench", reps: 8 }), set({ exerciseId: "row", reps: 10 })],
    });
    expect(rows.map((r) => r.exerciseId)).toEqual(["row"]);
  });

  it("merges two slots that performed the same lift and does not count the sets twice", () => {
    const rows = prescriptionFromSession({
      programmeSlots: ["bench", "incline"],
      slots: [slot({ slot: "incline", replacedBy: "bench" })],
      measureOf: reps,
      sets: [set({ exerciseId: "bench", reps: 8 }), set({ exerciseId: "bench", reps: 6 }), set({ exerciseId: "bench", reps: 5, warmup: true })],
    });
    expect(rows).toEqual([{ exerciseId: "bench", sets: 2, repMin: 6, repMax: 8, combined: true, superset: null }]);
  });

  it("keeps a superset's order and letter, and drops the letter when a merge leaves one exercise", () => {
    const paired = prescriptionFromSession({
      programmeSlots: ["bench", "row", "curl"],
      slots: [slot({ slot: "bench", superset: "g1" }), slot({ slot: "curl", superset: "g1" })],
      measureOf: reps,
      sets: [set({ exerciseId: "bench", reps: 8 }), set({ exerciseId: "curl", reps: 10 }), set({ exerciseId: "row", reps: 8 })],
    });
    expect(paired.map((r) => [r.exerciseId, r.superset])).toEqual([["bench", "A"], ["curl", "A"], ["row", null]]);

    const collapsed = prescriptionFromSession({
      programmeSlots: ["bench", "row"],
      slots: [slot({ slot: "bench", superset: "g1", replacedBy: "row" }), slot({ slot: "row", superset: "g1" })],
      measureOf: reps,
      sets: [set({ exerciseId: "row", reps: 8 }), set({ exerciseId: "row", reps: 8 })],
    });
    expect(collapsed).toEqual([{ exerciseId: "row", sets: 2, repMin: 8, repMax: 8, combined: true, superset: null }]);
  });

  it("shows a combined count above 12 so save can refuse it", () => {
    const sets = Array.from({ length: 13 }, () => set({ exerciseId: "bench", reps: 5 }));
    const [row] = prescriptionFromSession({ programmeSlots: ["bench"], slots: [], sets, measureOf: reps });
    expect(row).toMatchObject({ sets: 13, repMin: 5, repMax: 5 });
    const draft = { name: "P", days: [{ name: "Day", exercises: [draftExerciseFromPreview(row!)] }] };
    expect(validateDraft(draft).map((p) => p.code)).toContain("sets_bad");
  });

  it("uses whole seconds and rounds metres, and does not let a warm-up widen the range", () => {
    const timed = prescriptionFromSession({
      programmeSlots: ["plank", "carry"],
      slots: [slot({ slot: "carry", added: true, position: 1 })],
      measureOf: (id) => (id === "plank" ? "time" : "distance"),
      sets: [
        set({ exerciseId: "plank", reps: 1, durationS: 90, warmup: true }),
        set({ exerciseId: "plank", reps: 1, durationS: 45 }),
        set({ exerciseId: "plank", reps: 1, durationS: 30 }),
        set({ exerciseId: "plank", reps: 1, durationS: 0 }),
        set({ exerciseId: "carry", reps: 1, distanceM: 20.4 }),
        set({ exerciseId: "carry", reps: 1, distanceM: 20.6 }),
        set({ exerciseId: "carry", reps: 1, distanceM: 0.4 }),
        set({ exerciseId: "carry", reps: 1, distanceM: 0 }),
      ],
    });
    expect(timed).toEqual([
      { exerciseId: "plank", sets: 2, repMin: 30, repMax: 45, combined: false, superset: null },
      { exerciseId: "carry", sets: 3, repMin: 1, repMax: 21, combined: false, superset: null },
    ]);
  });
});
