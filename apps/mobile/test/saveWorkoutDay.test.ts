import type { EquipmentType, Measure, SetupType } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { DraftInvalid, ProgrammeDayLimit, SessionInProgress } from "../src/db/programmeRepo";
import { draftExerciseFromPreview } from "../src/logic/workoutDay";
import { freshDb } from "./helpers";

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  await ctx.repos.topUpLibrary();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const lib = async (key: string) => {
    const row = await ctx.db.get<{ id: string; name_en: string; equipment: EquipmentType; setup: SetupType; measure: Measure }>(
      "SELECT id, name_en, equipment, setup, measure FROM exercise WHERE seed_key = ? AND deleted_at IS NULL",
      [key],
    );
    if (!row) throw new Error(`missing exercise ${key}`);
    return row;
  };
  const upper = (await ctx.db.get<{ id: string }>(
    "SELECT d.id FROM programme_day d JOIN programme_version v ON v.id = d.programme_version_id WHERE d.name = 'Upper A' AND d.deleted_at IS NULL ORDER BY v.version DESC LIMIT 1",
  ))!;
  const dayExercises = await ctx.repos.listDayExercises(upper.id);
  const onDay = async (key: string) => {
    const row = await lib(key);
    const spec = dayExercises.find((e) => e.exerciseId === row.id);
    if (!spec) throw new Error(`${key} is not on Upper A`);
    return { ...row, equipment: spec.equipment, setup: spec.setup };
  };
  return { ...ctx, gymId, gym, lib, upperId: upper.id, onDay };
}

async function versions(db: Awaited<ReturnType<typeof setup>>["db"]) {
  return (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM programme_version WHERE deleted_at IS NULL"))!.n;
}

async function sessionSnap(db: Awaited<ReturnType<typeof setup>>["db"], sessionId: string) {
  const session = await db.get("SELECT id, status, programme_version_id, programme_day_id, deleted_at, finished_at FROM session WHERE id = ?", [sessionId]);
  const sets = await db.all(
    "SELECT id, exercise_id, load, reps, duration_s, distance_m, is_warmup, tags_json, outlier_status, deleted_at FROM workout_set WHERE session_id = ? ORDER BY position, rowid",
    [sessionId],
  );
  return { session, sets };
}

describe("save a finished workout as a program day", () => {
  it("previews working sets in workout order, then saves a new version without touching the workout or older days", async () => {
    const { db, gym, gymId, workout, programmes, finish, deps, lib, upperId, onDay } = await setup();
    const bench = await onDay("bench_press");
    const pulldown = await onDay("lat_pulldown");
    const incline = await onDay("incline_db_press");
    const row = await onDay("seated_cable_row");
    const lateral = await onDay("lateral_raise_db");
    const plank = await lib("plank");
    const carry = await lib("farmers_walk");
    const active = (await programmes.getActive())!;
    const beforeDraft = await programmes.loadDraft(active.versionId);
    const beforeDays = await db.all("SELECT id, name, deleted_at FROM programme_day WHERE programme_version_id = ? ORDER BY position", [active.versionId]);

    const { id } = await workout.startOrResumeSession(upperId, gymId);
    await workout.setSuperset(id, { [pulldown.id]: "ss-row", [row.id]: "ss-row" });
    await workout.replaceExercise(id, incline.id, incline.id, bench.id);
    await workout.removeExercise(id, lateral.id, lateral.id);
    await workout.addExercise(id, plank.id);
    await workout.addExercise(id, carry.id);

    const log = (exerciseId: string, equipment: EquipmentType, setup: SetupType, input: { load?: number; reps?: number; warmup?: boolean; tags?: string[]; durationS?: number; distanceM?: number }) =>
      workout.logSet(
        { sessionId: id, exerciseId, load: input.load ?? 0, reps: input.reps ?? 1, warmup: input.warmup, tags: input.tags, durationS: input.durationS, distanceM: input.distanceM },
        { gym, equipment, setup },
      );

    await log(bench.id, bench.equipment, bench.setup, { load: 60, reps: 8 });
    await log(bench.id, bench.equipment, bench.setup, { load: 60, reps: 6 });
    await log(bench.id, bench.equipment, bench.setup, { load: 40, reps: 10, warmup: true });
    await log(bench.id, bench.equipment, bench.setup, { load: 50, reps: 4, tags: ["drop"] });
    const deleted = await log(bench.id, bench.equipment, bench.setup, { load: 60, reps: 10 });
    const rejected = await log(bench.id, bench.equipment, bench.setup, { load: 60, reps: 12 });
    const waiting = await log(bench.id, bench.equipment, bench.setup, { load: 60, reps: 4 });
    const zero = await log(bench.id, bench.equipment, bench.setup, { load: 60, reps: 7 });
    await log(pulldown.id, pulldown.equipment, pulldown.setup, { load: 50, reps: 10 });
    await log(pulldown.id, pulldown.equipment, pulldown.setup, { load: 50, reps: 8 });
    await log(pulldown.id, pulldown.equipment, pulldown.setup, { load: 50, reps: 12 });
    await log(row.id, row.equipment, row.setup, { load: 45, reps: 8 });
    await log(row.id, row.equipment, row.setup, { load: 45, reps: 8 });
    await log(plank.id, plank.equipment, plank.setup, { load: 0, durationS: 120, warmup: true });
    await log(plank.id, plank.equipment, plank.setup, { load: 0, durationS: 45 });
    await log(plank.id, plank.equipment, plank.setup, { load: 0, durationS: 30 });
    const carryA = await log(carry.id, carry.equipment, carry.setup, { load: 20, distanceM: 20 });
    const carryB = await log(carry.id, carry.equipment, carry.setup, { load: 20, distanceM: 40 });
    const lineId = await workout.ensureLine(lateral.id, gymId, lateral.setup);
    await db.run(
      "INSERT INTO workout_set (id, session_id, exercise_id, line_id, position, load, reps, is_warmup, tags_json, outlier_status, created_at, updated_at) VALUES ('stray', ?, ?, ?, 1, 10, 15, 0, '[]', 'none', 1, 1)",
      [id, lateral.id, lineId],
    );
    await db.run("UPDATE workout_set SET outlier_status = 'none' WHERE session_id = ?", [id]);
    await db.run("UPDATE workout_set SET outlier_status = 'rejected' WHERE id = ?", [rejected.id]);
    await db.run("UPDATE workout_set SET outlier_status = 'unconfirmed' WHERE id = ?", [waiting.id]);
    await db.run("UPDATE workout_set SET deleted_at = 1 WHERE id = ?", [deleted.id]);
    await db.run("UPDATE workout_set SET reps = 0 WHERE id = ?", [zero.id]);
    await db.run("UPDATE workout_set SET distance_m = 20.4 WHERE id = ?", [carryA.id]);
    await db.run("UPDATE workout_set SET distance_m = 20.6 WHERE id = ?", [carryB.id]);
    deps.tick(1000);
    await workout.finishSession(id);
    await finish.writeNextSessionTargets(id);
    const plannedId = (await db.get<{ id: string }>("SELECT id FROM session WHERE status = 'planned' AND deleted_at IS NULL"))!.id;
    const snap = await sessionSnap(db, id);
    expect(await versions(db)).toBe(1);

    const preview = await programmes.previewWorkoutDay(id);
    expect(await versions(db)).toBe(1);
    expect(await sessionSnap(db, id)).toEqual(snap);
    expect((await db.get<{ deleted_at: number | null }>("SELECT deleted_at FROM session WHERE id = ?", [plannedId]))!.deleted_at).toBeNull();
    expect(preview).toMatchObject({ sessionId: id, dayName: "Upper A" });
    expect(preview!.exercises.map((e) => ({ id: e.exerciseId, sets: e.sets, repMin: e.repMin, repMax: e.repMax, combined: e.combined, superset: e.superset, measure: e.measure }))).toEqual([
      { id: bench.id, sets: 2, repMin: 6, repMax: 8, combined: true, superset: null, measure: "reps" },
      { id: pulldown.id, sets: 3, repMin: 8, repMax: 12, combined: false, superset: "A", measure: "reps" },
      { id: row.id, sets: 2, repMin: 8, repMax: 8, combined: false, superset: "A", measure: "reps" },
      { id: plank.id, sets: 2, repMin: 30, repMax: 45, combined: false, superset: null, measure: "time" },
      { id: carry.id, sets: 2, repMin: 20, repMax: 21, combined: false, superset: null, measure: "distance" },
    ]);
    expect(preview!.exercises.map((e) => e.exerciseId)).not.toContain(incline.id);
    expect(preview!.exercises.map((e) => e.exerciseId)).not.toContain(lateral.id);
    expect(await programmes.previewWorkoutDay("missing")).toBeNull();

    const saved = await programmes.saveWorkoutAsDay({
      name: preview!.dayName,
      exercises: preview!.exercises.map((e) => ({
        ...draftExerciseFromPreview(e.exerciseId === pulldown.id ? { ...e, sets: 2 } : e),
        ...(e.exerciseId === bench.id ? { topSets: 1, isGoalLift: true, trackEffort: true, repCeiling: 5 } : {}),
      })),
    });
    expect(saved).toMatchObject({ version: 2, changed: true });
    expect(await versions(db)).toBe(2);
    expect(await sessionSnap(db, id)).toEqual(snap);
    expect(snap.session).toMatchObject({ status: "finished", programme_version_id: active.versionId, deleted_at: null });
    expect(await db.all("SELECT id, name, deleted_at FROM programme_day WHERE programme_version_id = ? ORDER BY position", [active.versionId])).toEqual(beforeDays);
    expect((await db.get<{ name: string }>("SELECT name FROM programme WHERE id = ?", [active.programmeId]))!.name).toBe(beforeDraft.name);
    expect((await db.get<{ deleted_at: number | null; status: string }>("SELECT deleted_at, status FROM session WHERE id = ?", [plannedId]))).toMatchObject({ status: "planned" });
    expect((await db.get<{ deleted_at: number | null }>("SELECT deleted_at FROM session WHERE id = ?", [plannedId]))!.deleted_at).not.toBeNull();

    const after = await programmes.loadDraft(saved.versionId);
    expect(after.name).toBe(beforeDraft.name);
    expect(after.days.slice(0, beforeDraft.days.length)).toEqual(beforeDraft.days);
    expect(after.days.map((d) => d.name)).toEqual([...beforeDraft.days.map((d) => d.name), "Upper A"]);
    const added = after.days[after.days.length - 1]!;
    expect(added.exercises.map((e) => e.exerciseId)).toEqual([bench.id, pulldown.id, row.id, plank.id, carry.id]);
    expect(added.exercises[0]).toMatchObject({ sets: 2, repMin: 6, repMax: 8, topSets: null, isGoalLift: false, trackEffort: false, repCeiling: null });
    expect(added.exercises.find((e) => e.exerciseId === pulldown.id)).toMatchObject({ sets: 2, repMin: 8, repMax: 12 });
    expect(beforeDraft.days[0]!.exercises.find((e) => e.exerciseId === bench.id)!.isGoalLift).toBe(true);
    expect(after.days[0]!.exercises.find((e) => e.exerciseId === bench.id)!.isGoalLift).toBe(true);
    const cols = await db.all<{ name: string }>("SELECT name FROM pragma_table_info('programme_day_exercise')");
    expect(cols.map((c) => c.name)).not.toContain("superset_group");
  });

  it("a failed save leaves the current version and the finished workout alone", async () => {
    const { db, gym, gymId, workout, programmes, deps, onDay, upperId } = await setup();
    const bench = await onDay("bench_press");
    const active = (await programmes.getActive())!;
    const { id } = await workout.startOrResumeSession(upperId, gymId);
    await workout.logSet({ sessionId: id, exerciseId: bench.id, load: 60, reps: 8 }, { gym, equipment: bench.equipment, setup: bench.setup });
    deps.tick(1000);
    await workout.finishSession(id);
    const snap = await sessionSnap(db, id);
    const exercise = { exerciseId: bench.id, sets: 3, repMin: 6, repMax: 8, repCeiling: null, isGoalLift: false, trackEffort: false, topSets: null };

    await expect(programmes.saveWorkoutAsDay({ name: "   ", exercises: [exercise] })).rejects.toMatchObject({ problems: [expect.objectContaining({ code: "day_name_empty" })] });
    await expect(programmes.saveWorkoutAsDay({ name: "Extra", exercises: [] })).rejects.toMatchObject({ problems: [expect.objectContaining({ code: "day_empty" })] });
    await expect(programmes.saveWorkoutAsDay({ name: "Extra", exercises: [{ ...exercise, sets: 13 }] })).rejects.toBeInstanceOf(DraftInvalid);
    expect(await versions(db)).toBe(1);
    expect(await sessionSnap(db, id)).toEqual(snap);

    const open = await workout.startOrResumeSession((await db.get<{ id: string }>("SELECT id FROM programme_day WHERE name = 'Lower A' AND deleted_at IS NULL"))!.id, gymId);
    await expect(programmes.saveWorkoutAsDay({ name: "Extra", exercises: [exercise] })).rejects.toBeInstanceOf(SessionInProgress);
    expect(await programmes.previewWorkoutDay(open.id)).toBeNull();
    expect(await versions(db)).toBe(1);
    expect(await sessionSnap(db, id)).toEqual(snap);
    expect((await db.get<{ status: string }>("SELECT status FROM session WHERE id = ?", [open.id]))!.status).toBe("in_progress");
  });

  it("refuses an 8th day before writing a version", async () => {
    const { db, programmes, workout, gym, gymId, deps, onDay, upperId } = await setup();
    const bench = await onDay("bench_press");
    const active = (await programmes.getActive())!;
    const { id } = await workout.startOrResumeSession(upperId, gymId);
    await workout.logSet({ sessionId: id, exerciseId: bench.id, load: 60, reps: 8 }, { gym, equipment: bench.equipment, setup: bench.setup });
    deps.tick(1000);
    await workout.finishSession(id);
    const snap = await sessionSnap(db, id);
    const draft = await programmes.loadDraft(active.versionId);
    while (draft.days.length < 7) draft.days.push({ name: `Extra ${draft.days.length}`, exercises: [draft.days[0]!.exercises[0]!] });
    const filled = await programmes.saveNewVersion(active.programmeId, draft);
    expect(filled.version).toBe(2);
    const exercise = { exerciseId: bench.id, sets: 3, repMin: 6, repMax: 8, repCeiling: null, isGoalLift: false, trackEffort: false, topSets: null };
    await expect(programmes.saveWorkoutAsDay({ name: "One more", exercises: [exercise] })).rejects.toBeInstanceOf(ProgrammeDayLimit);
    expect(await versions(db)).toBe(2);
    expect(await sessionSnap(db, id)).toEqual(snap);
    const latest = await programmes.loadDraft(filled.versionId);
    expect(latest.days).toHaveLength(7);
    expect(latest.days.map((d) => d.name)).not.toContain("One more");
  });
});
