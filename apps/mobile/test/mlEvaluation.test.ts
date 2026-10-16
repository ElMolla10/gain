import { describe, expect, it, vi } from "vitest";
import { SYNC_TABLES } from "@gain/sync";
import { createMlEvaluationRepo, type PendingPrediction } from "../src/db/mlEvaluationRepo";
import { evaluationPrediction, formatMlNumber, LIVE_MODEL_VERSION, resumeEvaluationTarget } from "../src/logic/mlEvaluation";
import { liveContext, localPrediction } from "../src/logic/liveAdaptation";
import { initialRows } from "../src/logic/workoutRows";
import { freshDb } from "./helpers";
import { LATEST_VERSION, migrate } from "../src/db/migrations";
import { copyAtVersion, dumpAll } from "./realData";

// Isolated test databases only. These fixtures are never shipped or used as app accuracy.
async function setup() {
  const c = await freshDb();
  await c.repos.seedIfNeeded();
  const gymId = (await c.repos.getActiveGymId())!;
  const gym = await c.repos.loadGymFingerprint(gymId);
  const day = (await c.repos.getNextDay())!;
  const ex = (await c.repos.listDayExercises(day.day.id))[0]!;
  const { id: sessionId } = await c.workout.startOrResumeSession(day.day.id, gymId);
  const ctx = { gym, equipment: ex.equipment, setup: ex.setup };
  await c.workout.logSet({ id: "source", sessionId, exerciseId: ex.exerciseId, load: 60, reps: 10 }, ctx);
  const evaluation = createMlEvaluationRepo(c.db, c.deps);
  const prediction = async (targetSetId = "next", predictedReps = 8, proposedWeight = 60): Promise<PendingPrediction> => ({
    modelVersion: LIVE_MODEL_VERSION, sessionId, exerciseId: ex.exerciseId, targetSetId, predictedReps, proposedWeight,
    features: { previous_reps: 10, relative_load_change: 0, target_reps: 8 }, sources: await c.workout.listSessionSets(sessionId),
  });
  // Deterministic fixture result, with the same SQL columns used by the workout logger.
  const result = async (id = "next", reps = 8, load = 60, status = "none", extra: { warmup?: number; tags?: string; duration?: number | null; exerciseId?: string } = {}) => {
    const source = (await c.db.get<{ line_id: string }>("SELECT line_id FROM workout_set WHERE id = 'source'"))!;
    await c.db.run(`INSERT INTO workout_set
      (id, session_id, exercise_id, line_id, position, load, reps, is_warmup, tags_json, outlier_status, created_at, updated_at, duration_s)
      VALUES (?, ?, ?, ?, 2, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sessionId, extra.exerciseId ?? ex.exerciseId, source.line_id, load, reps, extra.warmup ?? 0, extra.tags ?? "[]", status, c.deps.now(), c.deps.now(), extra.duration ?? null]);
  };
  const row = () => c.db.get<Record<string, string | number | null>>("SELECT * FROM ml_prediction WHERE target_set_id = 'next'");
  const accuracy = () => evaluation.accuracy(LIVE_MODEL_VERSION);
  return { ...c, gymId, day, ex, ctx, sessionId, evaluation, prediction, result, row, accuracy };
}

describe("local ML evaluation persistence and matching", () => {
  it("starts empty, migrates schema 11 without rewriting history, and does not sync", async () => {
    const c = await setup();
    expect(await c.accuracy()).toEqual({ count: 0, meanAbsoluteError: null, withinOnePercent: null, withinTwoPercent: null });
    expect(SYNC_TABLES as readonly string[]).not.toContain("ml_prediction");
    const old = await copyAtVersion(c.db, 11);
    const before = await dumpAll(old);
    expect(await migrate(old)).toEqual({ from: 11, to: LATEST_VERSION });
    const after = await dumpAll(old);
    expect(after.ml_prediction).toEqual([]);
    delete after.ml_prediction;
    delete after.user_achievements;
    delete after.achievement_audit_log;
    delete after.user_quest;
    delete after.lift_pin;
    after.exercise_line = (after.exercise_line as Record<string, unknown>[]).map(({ load_spec_json: _l, ...rest }) => rest);
    after.session = (after.session as Record<string, unknown>[]).map(({ paused_ms: _p, paused_at: _a, local_calendar_date: _d, readiness: _r, ...rest }) => rest);
    after.import_batch = (after.import_batch as Record<string, unknown>[]).map(({ source_kind: _s, ...rest }) => rest);
    expect(after).toEqual(before);
    expect(await migrate(old)).toEqual({ from: LATEST_VERSION, to: LATEST_VERSION });
  });

  it("freezes the first forecast, deduplicates concurrent renders and repeated saves", async () => {
    const c = await setup();
    const p = await c.prediction();
    await Promise.all([c.evaluation.record(p), c.evaluation.record(p), c.evaluation.record(p)]);
    const first = await c.row();
    c.deps.tick();
    await c.evaluation.record({ ...p, predictedReps: 10, features: { target_reps: 10 } });
    expect(await c.row()).toEqual(first);
    expect(await c.db.all("SELECT * FROM ml_prediction")).toHaveLength(1);
    await c.workout.logSet({ id: "next", sessionId: c.sessionId, exerciseId: c.ex.exerciseId, load: 60, reps: 8 }, c.ctx);
    await c.workout.logSet({ id: "next", sessionId: c.sessionId, exerciseId: c.ex.exerciseId, load: 60, reps: 8 }, c.ctx);
    await c.workout.updateLiveSet("next", { load: 60, reps: 8, rir: null, warmup: false, tags: [] }, c.ctx);
    expect((await c.accuracy()).count).toBe(1);
    expect(await c.evaluation.record(p)).toBe(false); // never capture after outcome
    expect(await c.row()).toMatchObject({ state: "evaluated", actual_reps: 8, signed_error: 0, absolute_error: 0, within_one: 1, within_two: 1 });
  });

  it("calculates raw fractional errors with inclusive thresholds and model-specific denominators", async () => {
    const c = await setup();
    for (const [i, predicted, actual] of [[0, 7, 8], [1, 7.99, 10], [2, 8, 10], [3, 8, 5]]) {
      await c.evaluation.record(await c.prediction(`t${i}`, predicted));
      await c.result(`t${i}`, actual);
    }
    expect(await c.accuracy()).toEqual({ count: 4, meanAbsoluteError: 2.0025, withinOnePercent: 25, withinTwoPercent: 50 });
    const negative = await c.db.get<{ signed_error: number }>("SELECT signed_error FROM ml_prediction WHERE target_set_id = 't3'");
    expect(negative?.signed_error).toBe(-3); // actual minus prediction
    expect((await c.evaluation.accuracy("another-model")).count).toBe(0);
  });

  it.each([
    ["different load", 62.5, "none", {}, "weight_changed"],
    ["warm-up", 60, "none", { warmup: 1 }, "ineligible"],
    ["drop", 60, "none", { tags: '["drop"]' }, "ineligible"],
    ["failure", 60, "none", { tags: '["failure"]' }, "ineligible"],
    ["time", 60, "none", { duration: 30 }, "ineligible"],
    ["rejected", 60, "rejected", {}, "ineligible"],
  ] as const)("excludes %s and never revives it", async (_label, load, status, extra, reason) => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    await c.result("next", 8, load, status, extra);
    expect(await c.row()).toMatchObject({ state: "invalid", invalid_reason: reason });
    expect((await c.accuracy()).count).toBe(0);
    await c.db.run("UPDATE workout_set SET load = 60, is_warmup = 0, tags_json = '[]', duration_s = NULL, outlier_status = 'confirmed' WHERE id = 'next'");
    expect((await c.accuracy()).count).toBe(0);
  });

  it("waits for outlier confirmation, including after finishing, without counting a pending result", async () => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    await c.result("next", 8, 60, "unconfirmed");
    expect(await c.row()).toMatchObject({ state: "pending", actual_reps: null });
    expect((await c.accuracy()).count).toBe(0);
    await c.workout.finishSession(c.sessionId);
    await c.workout.setOutlierStatus("next", "confirmed");
    expect((await c.accuracy()).count).toBe(1);
    await c.workout.setOutlierStatus("next", "confirmed");
    expect((await c.accuracy()).count).toBe(1);
    await c.workout.setOutlierStatus("next", "unconfirmed");
    expect((await c.accuracy()).count).toBe(0);
  });

  it("never evaluates the wrong session/exercise identity, distance sets or assisted setups", async () => {
    for (const kind of ["session", "exercise", "distance", "assisted"] as const) {
      const c = await setup();
      await c.evaluation.record(await c.prediction());
      if (kind === "exercise") {
        const other = (await c.repos.listDayExercises(c.day.day.id))[1]!;
        await c.result("next", 8, 60, "none", { exerciseId: other.exerciseId });
      } else if (kind === "session") {
        const otherDay = (await c.db.get<{ id: string }>("SELECT id FROM programme_day WHERE id != ? AND deleted_at IS NULL LIMIT 1", [c.day.day.id]))!;
        const other = await c.workout.startOrResumeSession(otherDay.id, c.gymId);
        await c.workout.logSet({ id: "next", sessionId: other.id, exerciseId: c.ex.exerciseId, load: 60, reps: 8 }, c.ctx);
      } else if (kind === "distance") {
        await c.result("next", 8, 60, "unconfirmed");
        await c.db.run("UPDATE workout_set SET distance_m = 20, outlier_status = 'confirmed' WHERE id = 'next'");
      } else {
        await c.db.run("UPDATE exercise_line SET setup = 'assisted' WHERE exercise_id = ?", [c.ex.exerciseId]);
        await c.result();
      }
      expect((await c.accuracy()).count, kind).toBe(0);
      expect((await c.row())?.state, kind).toBe("invalid");
    }
  });

  it("excludes an unconfirmed result when its whole session is skipped", async () => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    await c.result("next", 8, 60, "unconfirmed");
    await c.db.run("UPDATE session SET status = 'skipped' WHERE id = ?", [c.sessionId]);
    await c.workout.setOutlierStatus("next", "confirmed");
    expect((await c.row())?.state).toBe("invalid");
    expect((await c.accuracy()).count).toBe(0);
  });

  it("invalidates forecasts when their exercise is removed and serializes skip behind capture", async () => {
    const c = await setup();
    const p = await c.prediction();
    await Promise.all([c.evaluation.record(p), c.evaluation.skip("next")]);
    expect((await c.row())?.state).toBe("invalid");
    await c.evaluation.record(await c.prediction("removed"));
    // The first removal creates the exercise state; both INSERT and UPDATE must invalidate.
    await c.workout.patchExerciseState(c.sessionId, c.ex.exerciseId, { removed: true });
    expect(await c.evaluation.pendingTarget(c.sessionId, c.ex.exerciseId, LIVE_MODEL_VERSION)).toBeNull();
    await c.workout.patchExerciseState(c.sessionId, c.ex.exerciseId, { removed: false });
    await c.evaluation.record(await c.prediction("removed-again"));
    await c.workout.patchExerciseState(c.sessionId, c.ex.exerciseId, { removed: true });
    expect(await c.evaluation.pendingTarget(c.sessionId, c.ex.exerciseId, LIVE_MODEL_VERSION)).toBeNull();
  });

  it("clears local records with parents during cloud-style history replacement, even with foreign keys disabled", async () => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    await c.db.exec("PRAGMA foreign_keys = OFF");
    await c.db.run("DELETE FROM session WHERE id = ?", [c.sessionId]);
    await c.db.exec("PRAGMA foreign_keys = ON");
    expect(await c.db.all("SELECT * FROM ml_prediction")).toEqual([]);
    expect((await c.accuracy()).count).toBe(0);
  });

  it("invalidates dependent forecasts when prior workout history is corrected", async () => {
    const c = await setup();
    await c.workout.finishSession(c.sessionId);
    const next = await c.workout.startOrResumeSession(c.day.day.id, c.gymId);
    await c.workout.logSet({ id: "new-source", sessionId: next.id, exerciseId: c.ex.exerciseId, load: 60, reps: 10 }, c.ctx);
    const p = { ...await c.prediction(), sessionId: next.id, sources: await c.workout.listSessionSets(next.id) };
    await c.evaluation.record(p);
    await c.db.run("UPDATE workout_set SET reps = 11 WHERE id = 'source'");
    expect(await c.row()).toMatchObject({ state: "invalid", invalid_reason: "context_changed" });
  });

  it.each(["edit", "delete", "physical delete", "source edit", "source delete", "session delete"])("removes evaluated results after %s", async action => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    await c.result();
    expect((await c.accuracy()).count).toBe(1);
    if (action === "edit") await c.workout.updateLiveSet("next", { load: 60, reps: 9, rir: null, warmup: false, tags: [] }, c.ctx);
    if (action === "delete") await c.workout.deleteSet("next");
    if (action === "physical delete") await c.db.run("DELETE FROM workout_set WHERE id = 'next'");
    if (action === "source edit") await c.db.run("UPDATE workout_set SET reps = 11 WHERE id = 'source'");
    if (action === "source delete") await c.workout.deleteSet("source");
    if (action === "session delete") await c.db.run("UPDATE session SET deleted_at = ? WHERE id = ?", [c.deps.now(), c.sessionId]);
    expect((await c.accuracy()).count).toBe(0);
    expect((await c.row())?.state).toBe("invalid");
  });

  it("excludes skipped and out-of-order targets instead of matching by set position", async () => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    await c.result("other");
    expect(await c.row()).toMatchObject({ state: "invalid", invalid_reason: "context_changed" });
    await c.result("next");
    expect((await c.accuracy()).count).toBe(0);
    await c.evaluation.record(await c.prediction("skipped"));
    await c.evaluation.skip("skipped");
    await c.evaluation.record(await c.prediction("unfinished"));
    await c.workout.finishSession(c.sessionId);
    expect(await c.db.all("SELECT state FROM ml_prediction WHERE state = 'pending'")).toEqual([]);
    expect((await c.accuracy()).count).toBe(0);
  });

  it("preserves a pending target identity across a new repository and resumed rows", async () => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    const resumed = createMlEvaluationRepo(c.db, c.deps);
    const target = await resumed.pendingTarget(c.sessionId, c.ex.exerciseId, LIVE_MODEL_VERSION);
    const rows = initialRows([], 2, { load: 60, reps: 8 }, () => c.deps.newId());
    const rebound = resumeEvaluationTarget(rows, target);
    expect(rebound[0]).toEqual({ ...rows[0], key: "next" });
    expect(rebound[1]).toBe(rows[1]);
    expect(await c.workout.startOrResumeSession(c.day.day.id, c.gymId)).toEqual({ id: c.sessionId, resumed: true });
    await c.result(rebound[0]!.key);
    expect((await resumed.accuracy(LIVE_MODEL_VERSION)).count).toBe(1);
    expect(await resumed.pendingTarget(c.sessionId, c.ex.exerciseId, LIVE_MODEL_VERSION)).toBeNull();
  });

  it("backs up evaluated and pending records exactly, restores old backups without fabricating scores, and wipes them", async () => {
    const c = await setup();
    await c.evaluation.record(await c.prediction("evaluated"));
    await c.result("evaluated");
    await c.evaluation.record(await c.prediction());
    const records = await c.db.all("SELECT * FROM ml_prediction ORDER BY id");
    const backup = await c.data.exportJson();
    expect(JSON.parse(backup).tables.ml_prediction).toHaveLength(2);
    await c.data.restoreJson(backup);
    expect(await c.db.all("SELECT * FROM ml_prediction ORDER BY id")).toEqual(records);
    expect((await c.accuracy()).count).toBe(1);
    expect(await c.evaluation.pendingTarget(c.sessionId, c.ex.exerciseId, LIVE_MODEL_VERSION)).toBe("next");
    const old = JSON.parse(backup);
    old.schemaVersion = 11;
    delete old.tables.ml_prediction;
    await c.data.restoreJson(JSON.stringify(old));
    expect((await c.accuracy()).count).toBe(0);
    await c.evaluation.record(await c.prediction());
    await c.data.deleteAll();
    expect(await c.db.all("SELECT * FROM ml_prediction")).toEqual([]);
  });

  it("waits for unconfirmed results after backup/restore and rejects edited pending outcomes", async () => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    await c.result("next", 8, 60, "unconfirmed");
    await c.data.restoreJson(await c.data.exportJson());
    expect((await c.accuracy()).count).toBe(0);
    await c.db.run("UPDATE workout_set SET reps = 9, outlier_status = 'confirmed' WHERE id = 'next'");
    expect((await c.row())?.state).toBe("invalid");
    expect((await c.accuracy()).count).toBe(0);
  });

  it("does not save a stale feature context or invalid numbers, and capture failure leaves workouts unchanged", async () => {
    const c = await setup();
    const p = await c.prediction();
    for (const bad of [NaN, Infinity, -1, 51]) expect(await c.evaluation.record({ ...p, predictedReps: bad })).toBe(false);
    expect(await c.evaluation.record({ ...p, proposedWeight: 0 })).toBe(false);
    expect(await c.evaluation.record({ ...p, features: { invalid: NaN } })).toBe(false);
    expect(await c.evaluation.record({ ...p, sources: [] })).toBe(false);
    await c.db.run("UPDATE workout_set SET reps = 9 WHERE id = 'source'");
    expect(await c.evaluation.record(p)).toBe(false);
    const fresh = await c.prediction();
    const run = vi.spyOn(c.db, "run").mockRejectedValueOnce(new Error("disk full"));
    await expect(c.evaluation.record(fresh)).rejects.toThrow("disk full");
    run.mockRestore();
    expect(await c.row()).toBeNull();
    expect(await c.workout.listSessionSets(c.sessionId)).toHaveLength(1);
  });

  it("rolls back result and evaluation together if a save transaction fails", async () => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    await expect(c.db.transaction(async () => { await c.result(); throw new Error("crash"); })).rejects.toThrow("crash");
    expect((await c.row())?.state).toBe("pending");
    expect((await c.accuracy()).count).toBe(0);
    await c.result();
    expect((await c.accuracy()).count).toBe(1);
  });
});

describe("real-set evaluation report", () => {
  it("matches headline accuracy, derives paired baselines from frozen inputs and exposes excluded coverage", async () => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    await c.result("next", 8);
    await c.evaluation.record(await c.prediction("skipped"));
    await c.evaluation.skip("skipped");
    await c.evaluation.record(await c.prediction("pending"));
    const report = await c.evaluation.report(LIVE_MODEL_VERSION);
    expect(report.coverage).toEqual({ captured: 3, pending: 1, invalidated: 1, excludedCurrentState: 0, evaluated: 1 });
    expect(report.model).toMatchObject(await c.accuracy());
    expect(report.comparisons.repeatPrevious.model.meanAbsoluteError).toBe(0);
    expect(report.comparisons.repeatPrevious.baseline.meanAbsoluteError).toBe(2);
    expect(report.samples).toHaveLength(1);
    expect(report.samples[0]?.sessionGroup).toBe("session-1");
    expect(JSON.stringify(report.samples)).not.toContain(c.sessionId);
    expect(report.samples[0]?.features.previous_reps).toBe(10);
    expect((await c.evaluation.report("other-model")).coverage.captured).toBe(0);
  });
  it("removes edited outcomes from both model and baseline denominators", async () => {
    const c = await setup();
    await c.evaluation.record(await c.prediction());
    await c.result();
    await c.db.run("UPDATE workout_set SET reps = 9 WHERE id = 'next'");
    const r = await c.evaluation.report(LIVE_MODEL_VERSION);
    expect(r.model.count).toBe(0);
    expect(r.comparisons.repeatPrevious.baseline.count).toBe(0);
    expect(r.coverage.invalidated).toBe(1);
    expect(r.samples).toEqual([]);
  });
  it("does not score changed loads as repeat-last baselines or imply comparable history", async () => {
    const c = await setup();
    const p = await c.prediction("next", 8, 62.5);
    p.features.relative_load_change = 2.5 / 60;
    await c.evaluation.record(p);
    await c.result("next", 8, 62.5);
    const r = await c.evaluation.report(LIVE_MODEL_VERSION);
    expect(r.model.count).toBe(1);
    expect(r.comparisons.repeatPrevious.model.count).toBe(0);
    expect(r.comparisons.loadAdjusted.model.count).toBe(1);
    expect(r.byHistory.priorFirstSetUnavailable.count).toBe(1);
  });
});

describe("production forecast capture", () => {
  it("formats counts, rep errors and percentages without kg/lb conversion", () => {
    expect(formatMlNumber(25, "en")).toBe("25");
    expect(formatMlNumber(2.0025, "en", 2)).toBe("2");
    expect(formatMlNumber(66.666, "en", 1)).toBe("66.7");
    expect(formatMlNumber(25, "ar")).toBe("٢٥");
  });
  it("snapshots the chosen load's features and raw prediction, excluding stops and typed outcome reps", async () => {
    const c = await setup();
    const sources = await c.workout.listSessionSets(c.sessionId);
    const rows = initialRows([], 2, { load: 60, reps: 8 }, () => "target");
    const context = liveContext({ exerciseId: c.ex.exerciseId, equipment: c.ex.equipment, setup: "free", measure: "reps", rows, sets: sources, targetReps: 8 })!;
    const decision = { action: "decrease", reason: "below_range", predictedReps: 8.25, suggestedWeightKg: 57.5, suggestedReps: 8 } as const;
    const p = evaluationPrediction(c.sessionId, c.ex.exerciseId, rows, sources, context, decision)!;
    expect(p).toMatchObject({ modelVersion: LIVE_MODEL_VERSION, targetSetId: "target", predictedReps: 8.25, proposedWeight: 57.5 });
    expect(p.features.relative_load_change).toBe((57.5 - 60) / 60);
    expect(evaluationPrediction(c.sessionId, c.ex.exerciseId, rows, sources, context, { ...decision, action: "stop" })).toBeNull();
    expect(evaluationPrediction(c.sessionId, c.ex.exerciseId, rows, sources, context, { ...decision, reason: "reported_symptoms" })).toBeNull();
    expect(evaluationPrediction(c.sessionId, c.ex.exerciseId, rows.map(r => ({ ...r, reps: 8 })), sources, context, decision)).toBeNull();
    // Merely running the real model or importing historical fixtures creates no real-world metric.
    expect(Number.isFinite(localPrediction(p.features))).toBe(true);
    expect((await c.accuracy()).count).toBe(0);
  });
});
