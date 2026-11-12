import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseImport } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { enImport, arImport } from "../src/i18n/strings.import";
import { initialRows } from "../src/logic/workoutRows";
import { freshDb } from "./helpers";

const exportFile = parseImport(readFileSync(join(__dirname, "../../../fixtures/hevy-export.csv"), "utf8"));
const benchTitle = "Bench Press (Barbell)";
const benchHistory = {
  ...exportFile,
  workouts: exportFile.workouts.filter(w => w.exercises.some(e => e.title === benchTitle)).slice(-3)
    .map(w => ({ ...w, exercises: w.exercises.filter(e => e.title === benchTitle) })),
};

describe("continuing from imported workouts", () => {
  it("uses mapped past weights for an already planned workout, and restores no-history after undo", async () => {
    const c = await freshDb();
    try {
      c.deps.tick(Date.UTC(2026, 10, 12) - c.deps.now());
      await c.repos.seedIfNeeded();
      const gymId = (await c.repos.getActiveGymId())!;
      const active = (await c.repos.getLatestProgrammeVersion())!;
      const bench = (await c.programmes.listExercises()).find(e => e.seedKey === "bench_press")!;
      const days = await c.repos.listDays(active.versionId);
      let dayId: string | null = null;
      for (const day of days) {
        if ((await c.repos.listDayExercises(day.id)).some(e => e.exerciseId === bench.id)) { dayId = day.id; break; }
      }
      expect(dayId).toBeTruthy();
      const planned = (await c.finish.planDay(dayId!, gymId))!;
      expect((await c.finish.getTargetForExercise(planned.sessionId, bench.id))?.load).toBeNull();

      const preview = await c.imports.preview(benchHistory);
      expect(preview.titles).toHaveLength(1);
      expect(preview.titles[0]!.suggestion).toMatchObject({ kind: "library", exerciseId: bench.id });
      const imported = await c.imports.importHistory({ parse: benchHistory, gymId, mappings: { [benchTitle]: { kind: "existing", exerciseId: bench.id } } });
      expect(imported.refreshWarning).toBeUndefined();

      const lineId = await c.workout.ensureLine(bench.id, gymId, bench.setup);
      const history = await c.workout.getHistory({ exerciseId: bench.id, gymId, setup: bench.setup }, lineId, true);
      expect(history).toHaveLength(benchHistory.workouts.length);
      const gym = await c.repos.loadGymFingerprint(gymId);
      const ex = (await c.repos.listDayExercises(dayId!)).find(e => e.exerciseId === bench.id)!;
      const { proposal } = await c.workout.liveProposal({ exerciseId: bench.id, name: bench.nameEn, equipment: bench.equipment, setup: bench.setup, repMin: ex.repMin, repMax: ex.repMax, isGoalLift: ex.isGoalLift, trackEffort: ex.trackEffort, sets: ex.sets }, gym);
      expect(proposal.load).toBeGreaterThan(0);
      expect(JSON.stringify(proposal.inputs)).toContain(String(history.at(-1)!.sets.find(s => !s.warmup)!.load));
      const target = await c.finish.getTargetForExercise(planned.sessionId, bench.id);
      expect(target?.load).toBe(proposal.load);
      expect(target?.lineId).toBe(lineId);
      const previous = await c.workout.previousPerformances(bench.id, dayId!);
      const lastImported = history.at(-1)!.sets.filter(s => !s.warmup && !s.tags?.includes("drop"));
      expect(previous.any?.sets).toEqual(lastImported);
      expect(previous.routine?.sets).toEqual(lastImported);
      // The workout's Previous column and its empty input rows use the imported
      // performance and the newly calculated target without silently logging a set.
      const rows = initialRows([], ex.sets, { load: target!.load, reps: target!.reps }, () => "new-row");
      expect(rows[0]).toMatchObject({ saved: false, load: null, ghostLoad: proposal.load });
      const trend = await c.history.getLiftTrend(lineId);
      expect(trend?.lift.hasImported).toBe(true);
      expect(trend?.trend.points).toHaveLength(benchHistory.workouts.length);
      expect(trend?.trend.points.every(point => point.imported)).toBe(true);

      await c.imports.undoBatch(imported.batchId!);
      expect(await c.workout.getHistory({ exerciseId: bench.id, gymId, setup: bench.setup }, lineId)).toEqual([]);
      expect(await c.workout.previousPerformances(bench.id, dayId!)).toEqual({ any: null, routine: null });
      expect((await c.finish.getTargetForExercise(planned.sessionId, bench.id))?.load).toBeNull();
      expect(await c.history.getLiftTrend(lineId)).toBeNull();
    } finally {
      c.db.close();
    }
  });

  it("tells people why matching the exercise matters in both languages", () => {
    expect(enImport["import.ex.note"]).toMatch(/weights continue from your history/);
    expect(arImport["import.ex.note"]).toMatch(/الأوزان تكمل من تاريخك/);
  });

  it("recreates observed days, exercise order and working sets, then activates while an older workout stays open", async () => {
    const c = await freshDb();
    try {
      await c.repos.seedIfNeeded();
      const gymId = (await c.repos.getActiveGymId())!;
      const original = (await c.repos.getNextDay())!;
      const open = await c.workout.startOrResumeSession(original.day.id, gymId);
      const bench = (await c.programmes.listExercises()).find(e => e.seedKey === "bench_press")!;
      const row = (await c.programmes.listExercises()).find(e => e.seedKey === "db_row")!;
      const parsed = parseImport(`title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
Push,"Nov 1, 2026, 3:00 PM","Nov 1, 2026, 4:00 PM",,"Bench Press (Barbell)",,,0,normal,60,8,,,
Push,"Nov 1, 2026, 3:00 PM","Nov 1, 2026, 4:00 PM",,"Bench Press (Barbell)",,,1,normal,60,7,,,
Pull,"Nov 2, 2026, 3:00 PM","Nov 2, 2026, 4:00 PM",,"Bench Press (Barbell)",,,0,normal,62.5,6,,,
Push,"Nov 3, 2026, 3:00 PM","Nov 3, 2026, 4:00 PM",,"Bench Press (Barbell)",,,0,warmup,30,10,,,
Push,"Nov 3, 2026, 3:00 PM","Nov 3, 2026, 4:00 PM",,"Bench Press (Barbell)",,,1,normal,65,8,,,
Push,"Nov 3, 2026, 3:00 PM","Nov 3, 2026, 4:00 PM",,"Bench Press (Barbell)",,,2,normal,65,9,,,
Push,"Nov 3, 2026, 3:00 PM","Nov 3, 2026, 4:00 PM",,"One-Arm Dumbbell Row",,,0,normal,24,10,,,
Push,"Nov 3, 2026, 3:00 PM","Nov 3, 2026, 4:00 PM",,"Bench Press (Barbell)",,,3,dropset,40,12,,,
`);
      const imported = await c.imports.importHistory({ parse: parsed, gymId, mappings: {
        [benchTitle]: { kind: "existing", exerciseId: bench.id },
        "One-Arm Dumbbell Row": { kind: "existing", exerciseId: row.id },
      } });
      const before = await c.repos.getLatestProgrammeVersion();
      const draft = await c.imports.previousProgrammeDraft(imported.batchId!);
      expect(draft?.days.map(day => [day.name, day.exercises[0]?.sets, day.exercises[0]?.repMin, day.exercises[0]?.repMax]))
        .toEqual([["Pull", 1, 6, 6], ["Push", 2, 8, 9]]);
      expect(draft?.days.map(day => day.exercises.map(ex => ex.exerciseId))).toEqual([[bench.id], [bench.id, row.id]]);
      expect(await c.repos.getLatestProgrammeVersion()).toEqual(before); // preview is read only
      await c.programmes.createProgramme(draft!, { activate: true });
      expect((await c.repos.getNextDay())?.day.name).toBe("Pull");
      expect((await c.workout.getSession(open.id))?.status).toBe("in_progress");
      await c.imports.undoBatch(imported.batchId!);
      expect(await c.imports.previousProgrammeDraft(imported.batchId!)).toBeNull();
      expect((await c.repos.getLatestProgrammeVersion())?.programmeName).toBe("Previous program");
    } finally {
      c.db.close();
    }
  });
});
