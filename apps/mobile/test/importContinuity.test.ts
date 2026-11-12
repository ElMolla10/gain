import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseImport } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { enImport, arImport } from "../src/i18n/strings.import";
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
      const trend = await c.history.getLiftTrend(lineId);
      expect(trend?.lift.hasImported).toBe(true);
      expect(trend?.trend.points).toHaveLength(benchHistory.workouts.length);
      expect(trend?.trend.points.every(point => point.imported)).toBe(true);

      await c.imports.undoBatch(imported.batchId!);
      expect(await c.workout.getHistory({ exerciseId: bench.id, gymId, setup: bench.setup }, lineId)).toEqual([]);
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
});
