import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseImport } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { MeasureLocked } from "../src/db/programmeRepo";
import { MIGRATIONS, migrate } from "../src/db/migrations";
import { TIMED_LIBRARY, measureOfKey } from "../src/db/library/measures";
import { addExercise, newExercise } from "../src/logic/programmeDraft";
import { freshDb } from "./helpers";
import { openNodeDb } from "./nodeDriver";
import { describeDecision, type DecisionPayload } from "../src/logic/why";
import { translate } from "../src/i18n/format";
import type { StringKey } from "../src/i18n/strings";
import type { MappingChoice, TitlePreview } from "../src/db/importRepo";

const fx = (n: string) => readFileSync(join(__dirname, "../../../fixtures", n), "utf8");

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  await ctx.repos.topUpLibrary();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const idOf = async (key: string) => (await ctx.db.get<{ id: string }>("SELECT id FROM exercise WHERE seed_key = ? AND deleted_at IS NULL", [key]))!.id;
  /** Put an exercise on every day of a new program version so the next session carries a target for it. */
  const planOnDayOne = async (exerciseId: string, over = {}) => {
    const active = (await ctx.programmes.getActive())!;
    const draft = await ctx.programmes.loadDraft(active.versionId);
    const ex = (await ctx.repos.adHocDayExercise(exerciseId))!;
    let next = draft;
    for (let d = 0; d < draft.days.length; d++) next = addExercise(next, d, newExercise(exerciseId, { sets: ex.sets, repMin: ex.repMin, repMax: ex.repMax, ...over }));
    await ctx.programmes.saveNewVersion(active.programmeId, next);
  };
  return { ...ctx, gymId, gym, idOf, planOnDayOne };
}

/** Train the next day: `timed` sets for one exercise, finish, write the next targets. */
async function trainWith(s: Awaited<ReturnType<typeof setup>>, exerciseId: string, sets: { durationS?: number; distanceM?: number; load?: number }[]) {
  const next = (await s.repos.getNextDay())!;
  const { id } = await s.workout.startOrResumeSession(next.day.id, s.gymId);
  const ex = (await s.repos.listDayExercises(next.day.id)).find((e) => e.exerciseId === exerciseId)!;
  for (const x of sets) await s.workout.logSet({ sessionId: id, exerciseId, load: x.load ?? 0, reps: 99, durationS: x.durationS, distanceM: x.distanceM }, { gym: s.gym, equipment: ex.equipment, setup: ex.setup });
  s.deps.tick(1000);
  await s.workout.finishSession(id);
  const written = await s.finish.writeNextSessionTargets(id);
  s.deps.tick(86_400_000);
  return { id, written };
}

describe("migration 9: time and distance", () => {
  const at = async (v: number) => {
    const db = openNodeDb();
    await migrate(db, MIGRATIONS.filter((m) => m.version <= v));
    const t = 1_700_000_000_000;
    const ex = (id: string, key: string) =>
      db.run("INSERT INTO exercise (id, seed_key, name_en, name_ar, pattern, equipment, setup, is_sample, created_at, updated_at) VALUES (?,?,?, 'x','core','machine','free',0,?,?)", [id, key, key, t, t]);
    await ex("e-untouched", "plank");
    await ex("e-planned", "dead_hang");
    await ex("e-logged", "side_plank");
    await ex("e-bench", "bench_press");
    await db.run("INSERT INTO gym (id, name, is_sample, created_at, updated_at) VALUES ('g1','Home',0,?,?)", [t, t]);
    await db.run("INSERT INTO programme (id, name, is_sample, created_at, updated_at) VALUES ('p1','Mine',0,?,?)", [t, t]);
    await db.run("INSERT INTO programme_version (id, programme_id, version, created_at, updated_at) VALUES ('v1','p1',1,?,?)", [t, t]);
    await db.run("INSERT INTO programme_day (id, programme_version_id, name, position, created_at, updated_at) VALUES ('d1','v1','Day 1',0,?,?)", [t, t]);
    await db.run("INSERT INTO programme_day_exercise (id, programme_day_id, exercise_id, position, sets, rep_min, rep_max, is_goal_lift, track_effort, created_at, updated_at) VALUES ('x1','d1','e-planned',0,3,6,10,0,0,?,?)", [t, t]);
    await db.run("INSERT INTO exercise_line (id, exercise_id, gym_id, setup, created_at, updated_at) VALUES ('l1','e-logged','g1','free',?,?)", [t, t]);
    await db.run("INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, started_at, finished_at, created_at, updated_at) VALUES ('s1','v1','d1','g1','finished',?,?,?,?)", [t, t + 1, t, t]);
    await db.run("INSERT INTO workout_set (id, session_id, exercise_id, line_id, position, load, reps, is_warmup, created_at, updated_at) VALUES ('w1','s1','e-logged','l1',1,0,30,0,?,?)", [t, t]);
    return db;
  };
  it("turns only untouched library rows into timed ones; planned or logged rows keep counting reps", async () => {
    const db = await at(8);
    await migrate(db);
    const m = async (id: string) => (await db.get<{ measure: string }>("SELECT measure FROM exercise WHERE id = ?", [id]))!.measure;
    expect(await m("e-untouched")).toBe("time");
    expect(await m("e-planned")).toBe("reps");
    expect(await m("e-logged")).toBe("reps");
    expect(await m("e-bench")).toBe("reps");
    // what was logged is untouched, and the new columns are empty for it
    expect(await db.get("SELECT reps, duration_s, distance_m FROM workout_set WHERE id = 'w1'")).toEqual({ reps: 30, duration_s: null, distance_m: null });
  });
  it("does not touch updated_at of rows it backfills, and a second run changes nothing", async () => {
    const db = await at(8);
    await migrate(db);
    expect((await db.get<{ updated_at: number }>("SELECT updated_at FROM exercise WHERE id = 'e-untouched'"))!.updated_at).toBe(1_700_000_000_000);
    expect(await migrate(db)).toMatchObject({ from: 9, to: 9 });
  });
  it("the database checks refuse a duration or distance out of range", async () => {
    const s = await setup();
    const next = (await s.repos.getNextDay())!;
    const { id } = await s.workout.startOrResumeSession(next.day.id, s.gymId);
    const ex = await s.idOf("plank");
    const line = await s.workout.ensureLine(ex, s.gymId, "bodyweight_plus_added");
    const ins = (d: number | null, m: number | null) =>
      s.db.run("INSERT INTO workout_set (id, session_id, exercise_id, line_id, position, load, reps, duration_s, distance_m, is_warmup, created_at, updated_at) VALUES (?,?,?,?,1,0,1,?,?,0,1,1)", [`k${d}${m}`, id, ex, line, d, m]);
    await expect(ins(0, null)).rejects.toThrow();
    await expect(ins(3601, null)).rejects.toThrow();
    await expect(ins(null, 0)).rejects.toThrow();
    await expect(ins(null, 5001)).rejects.toThrow();
    await expect(ins(45, null)).resolves.toBeTruthy();
  });
});

describe("the library", () => {
  it("every timed seed key exists in the library, and a fresh phone gets them as timed", async () => {
    const s = await setup();
    for (const [key, measure] of Object.entries(TIMED_LIBRARY)) {
      const row = await s.db.get<{ measure: string }>("SELECT measure FROM exercise WHERE seed_key = ? AND deleted_at IS NULL", [key]);
      expect(row, key).not.toBeNull();
      expect(row!.measure, key).toBe(measure);
      expect(measureOfKey(key)).toBe(measure);
    }
    expect(measureOfKey("bench_press")).toBe("reps");
    expect(measureOfKey(null)).toBe("reps");
  });
});

describe("logging a timed set", () => {
  it("stores seconds with reps = 1, no effort, and refuses a missing or impossible value", async () => {
    const s = await setup();
    const ex = await s.idOf("plank");
    const spec = (await s.repos.adHocDayExercise(ex))!;
    expect(spec).toMatchObject({ measure: "time", repMin: 30, repMax: 60, sets: 3 });
    const next = (await s.repos.getNextDay())!;
    const { id } = await s.workout.startOrResumeSession(next.day.id, s.gymId);
    const ctx = { gym: s.gym, equipment: spec.equipment, setup: spec.setup };
    const r = await s.workout.logSet({ sessionId: id, exerciseId: ex, load: 0, reps: 12, durationS: 45, rir: 2 }, ctx);
    expect(await s.db.get("SELECT reps, duration_s, distance_m, rir FROM workout_set WHERE id = ?", [r.id])).toEqual({ reps: 1, duration_s: 45, distance_m: null, rir: null });
    await expect(s.workout.logSet({ sessionId: id, exerciseId: ex, load: 0, reps: 1 }, ctx)).rejects.toThrow();
    await expect(s.workout.logSet({ sessionId: id, exerciseId: ex, load: 0, reps: 1, durationS: 0 }, ctx)).rejects.toThrow();
    await expect(s.workout.logSet({ sessionId: id, exerciseId: ex, load: 0, reps: 1, durationS: 7200 }, ctx)).rejects.toThrow();
    await expect(s.workout.logSet({ sessionId: id, exerciseId: ex, load: 0, reps: 1, durationS: 30, distanceM: 20 }, ctx)).resolves.toBeTruthy();
  });
  it("a carry stores metres; seconds alone are refused for it", async () => {
    const s = await setup();
    const ex = await s.idOf("farmers_walk");
    const spec = (await s.repos.adHocDayExercise(ex))!;
    expect(spec.measure).toBe("distance");
    const next = (await s.repos.getNextDay())!;
    const { id } = await s.workout.startOrResumeSession(next.day.id, s.gymId);
    const ctx = { gym: s.gym, equipment: spec.equipment, setup: spec.setup };
    const r = await s.workout.logSet({ sessionId: id, exerciseId: ex, load: 32, reps: 1, distanceM: 30 }, ctx);
    expect(await s.db.get("SELECT load, reps, duration_s, distance_m FROM workout_set WHERE id = ?", [r.id])).toEqual({ load: 32, reps: 1, duration_s: null, distance_m: 30 });
    await expect(s.workout.logSet({ sessionId: id, exerciseId: ex, load: 32, reps: 1, durationS: 30 }, ctx)).rejects.toThrow();
    await expect(s.workout.logSet({ sessionId: id, exerciseId: ex, load: 32, reps: 1, distanceM: 9000 }, ctx)).rejects.toThrow();
  });
  it("a reps exercise is not affected: reps still required", async () => {
    const s = await setup();
    const next = (await s.repos.getNextDay())!;
    const bench = (await s.repos.listDayExercises(next.day.id))[0]!;
    const { id } = await s.workout.startOrResumeSession(next.day.id, s.gymId);
    await expect(s.workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 60, reps: 0 }, { gym: s.gym, equipment: bench.equipment, setup: bench.setup })).rejects.toThrow();
    const r = await s.workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 60, reps: 8, durationS: 99 }, { gym: s.gym, equipment: bench.equipment, setup: bench.setup });
    expect(await s.db.get("SELECT reps, duration_s FROM workout_set WHERE id = ?", [r.id])).toEqual({ reps: 8, duration_s: null });
  });
  it("flags a hold far from the lifter's own line, and not an ordinary one", async () => {
    const s = await setup();
    const ex = await s.idOf("plank");
    const spec = (await s.repos.adHocDayExercise(ex))!;
    const next = (await s.repos.getNextDay())!;
    const { id } = await s.workout.startOrResumeSession(next.day.id, s.gymId);
    const ctx = { gym: s.gym, equipment: spec.equipment, setup: spec.setup };
    for (const d of [40, 42, 41]) expect((await s.workout.logSet({ sessionId: id, exerciseId: ex, load: 0, reps: 1, durationS: d }, ctx)).outlier?.outlierStatus ?? "none").toBe("none");
    const odd = await s.workout.logSet({ sessionId: id, exerciseId: ex, load: 0, reps: 1, durationS: 600 }, ctx);
    expect(odd.outlier).not.toBeNull();
    expect(odd.outlier!.reasons).toContain("quantity_far_from_line");
    expect(odd.outlier!.verdict).toBe("unconfirmed");
    const fine = await s.workout.logSet({ sessionId: id, exerciseId: ex, load: 0, reps: 1, durationS: 44 }, ctx);
    expect(fine.outlier?.outlierStatus ?? "none").toBe("none");
  });
});

describe("targets, history and trend for a timed line", () => {
  it("the next session's target is in seconds (no reps), written with the timed rule", async () => {
    const s = await setup();
    const ex = await s.idOf("plank");
    await s.planOnDayOne(ex);
    const { written } = await trainWith(s, ex, [{ durationS: 40 }, { durationS: 40 }, { durationS: 38 }]);
    const t = (await s.finish.getTargets(written!.sessionId)).find((x) => x.exerciseId === ex)!;
    expect(t).toMatchObject({ measure: "time", reps: null, plannedSets: 3 });
    expect(t.durationS).toBeGreaterThanOrEqual(30);
    expect(t.distanceM).toBeNull();
    expect(t.ruleVersion).toMatch(/timed/);
    const d = await s.finish.getDecision(t.id);
    expect(d!.payload.proposal.durationS).toBe(t.durationS);
  });
  it("holding the top of the range twice moves the target up, never above the cap", async () => {
    const s = await setup();
    const ex = await s.idOf("plank");
    await s.planOnDayOne(ex);
    let last: number | null = null;
    for (let i = 0; i < 8; i++) {
      const r = await trainWith(s, ex, [{ durationS: 60 }, { durationS: 60 }, { durationS: 60 }]);
      last = (await s.finish.getTargets(r.written!.sessionId)).find((x) => x.exerciseId === ex)!.durationS;
      expect(last).toBeLessThanOrEqual(3600);
    }
    expect(last).toBeGreaterThanOrEqual(30);
  });
  it("a carry target is in metres and keeps the load a real gym step", async () => {
    const s = await setup();
    const ex = await s.idOf("farmers_carry_dumbbell");
    await s.planOnDayOne(ex);
    const { written } = await trainWith(s, ex, [{ distanceM: 30, load: 24 }, { distanceM: 30, load: 24 }, { distanceM: 30, load: 24 }]);
    const t = (await s.finish.getTargets(written!.sessionId)).find((x) => x.exerciseId === ex)!;
    expect(t).toMatchObject({ measure: "distance", reps: null, durationS: null });
    expect(t.distanceM).toBeGreaterThan(0);
  });
  it("history lists the seconds and the lift trend follows them", async () => {
    const s = await setup();
    const ex = await s.idOf("plank");
    await s.planOnDayOne(ex);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await trainWith(s, ex, [{ durationS: 30 + i * 5 }, { durationS: 30 + i * 5 }])).id);
    const detail = await s.history.getSession(ids[4]!);
    const e = detail!.exercises.find((x) => x.exerciseId === ex)!;
    expect(e.measure).toBe("time");
    expect(e.sets.map((x) => x.durationS)).toEqual([50, 50]);
    const lift = (await s.history.listLifts()).find((l) => l.exerciseId === ex)!;
    expect(lift.measure).toBe("time");
    const tr = await s.history.getLiftTrend(lift.lineId);
    expect(tr!.trend.timed).toBe("time");
    expect(tr!.trend.points.at(-1)!.quantity).toBe(50);
  });
  it("a finished set can be corrected in seconds, with the same limits", async () => {
    const s = await setup();
    const ex = await s.idOf("plank");
    await s.planOnDayOne(ex);
    const r = await trainWith(s, ex, [{ durationS: 40 }]);
    const set = (await s.history.getSession(r.id))!.exercises.find((x) => x.exerciseId === ex)!.sets[0]!;
    await s.history.updateSet(set.id, { load: 0, reps: 1, rir: null, durationS: 55 });
    expect((await s.db.get<{ duration_s: number }>("SELECT duration_s FROM workout_set WHERE id = ?", [set.id]))!.duration_s).toBe(55);
    await expect(s.history.updateSet(set.id, { load: 0, reps: 1, rir: null, durationS: 0 })).rejects.toThrow();
    await expect(s.history.updateSet(set.id, { load: 0, reps: 1, rir: null, distanceM: 20 })).rejects.toThrow();
  });
});

describe("changing how an exercise is counted", () => {
  it("is allowed while nothing is logged, resets the ranges of its slots, and is locked once sets exist", async () => {
    const s = await setup();
    const custom = await s.programmes.createExercise({ nameEn: "Bear Crawl Hold", pattern: "core", equipment: "machine", setup: "free" });
    expect((await s.db.get<{ measure: string }>("SELECT measure FROM exercise WHERE id = ?", [custom]))!.measure).toBe("reps");
    await s.planOnDayOne(custom, { repMin: 8, repMax: 12 });
    expect(await s.programmes.setExerciseMeasure(custom, "time")).toMatchObject({ changed: true });
    const row = await s.db.get<{ rep_min: number; rep_max: number }>("SELECT rep_min, rep_max FROM programme_day_exercise WHERE exercise_id = ? AND deleted_at IS NULL", [custom]);
    expect(row).toEqual({ rep_min: 30, rep_max: 60 });
    expect(await s.programmes.setExerciseMeasure(custom, "time")).toEqual({ changed: false, slots: 0 });
    await trainWith(s, custom, [{ durationS: 40 }]);
    await expect(s.programmes.setExerciseMeasure(custom, "reps")).rejects.toBeInstanceOf(MeasureLocked);
  });
  it("a custom exercise can be created as timed and is not duplicated", async () => {
    const s = await setup();
    const a = await s.programmes.createExercise({ nameEn: "Bar Hold", pattern: "other", equipment: "barbell", setup: "free", measure: "time" });
    const b = await s.programmes.createExercise({ nameEn: "bar hold", pattern: "other", equipment: "barbell", setup: "free", measure: "time" });
    expect(b).toBe(a);
    expect((await s.programmes.listExercises()).find((e) => e.id === a)!.measure).toBe("time");
  });
});

describe("import and export of timed sets", () => {
  const acceptAll = (titles: TitlePreview[]): Record<string, MappingChoice> => {
    const out: Record<string, MappingChoice> = {};
    for (const t of titles) {
      const x = t.suggestion;
      out[t.title] = x.kind === "new" ? { kind: "new", nameEn: x.nameEn, pattern: x.pattern, equipment: x.equipment ?? "cable", setup: x.setup ?? "free" } : { kind: "existing", exerciseId: x.exerciseId };
    }
    return out;
  };
  const hevy = parseImport(fx("hevy-export.csv"));
  it("the real Hevy export's Dead Hang rows arrive as seconds, not as lost rows", async () => {
    const s = await setup();
    const p = await s.imports.preview(hevy);
    const r = await s.imports.importHistory({ parse: hevy, gymId: s.gymId, mappings: acceptAll(p.titles), fileName: "hevy-export.csv" });
    expect(r.skippedSets).toBe(3); // the lifter's Farmers walk (3 sets, in seconds) matches the library's Farmers Walk, which counts metres: said so, not guessed
    expect(p.titles.find((t) => t.title === "Farmers walk")).toMatchObject({ sets: 0, unfit: 3 });
    const rows = await s.db.all<{ reps: number; duration_s: number; distance_m: number | null }>(
      "SELECT ws.reps, ws.duration_s, ws.distance_m FROM workout_set ws JOIN exercise e ON e.id = ws.exercise_id WHERE e.seed_key = 'dead_hang' AND ws.deleted_at IS NULL",
    );
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((x) => x.reps === 1 && x.duration_s >= 1 && x.distance_m === null)).toBe(true);
    expect(rows.map((x) => x.duration_s)).toContain(75);
  });
  it("a timed export reads back into the same seconds and metres", async () => {
    const s = await setup();
    const plank = await s.idOf("plank");
    const walk = await s.idOf("farmers_carry_dumbbell");
    await s.planOnDayOne(plank);
    await s.planOnDayOne(walk);
    await trainWith(s, plank, [{ durationS: 45 }, { durationS: 50 }]);
    await trainWith(s, walk, [{ distanceM: 30, load: 24 }]);
    const csv = await s.data.exportCsv();
    expect(csv).toContain("duration_seconds");
    const back = parseImport(csv);
    const timed = back.workouts.flatMap((w) => w.exercises).filter((e) => e.timed && e.timed.length > 0);
    const plankSets = timed.find((e) => e.title === "Plank")!.timed!;
    expect(plankSets.map((x) => x.durationS)).toEqual([45, 50]);
    const walkSets = timed.find((e) => /Farmers Carry/.test(e.title))!.timed!;
    expect(walkSets[0]).toMatchObject({ distanceM: 30, load: 24 });
    // a reps row is untouched and still has reps
    expect(back.workouts.flatMap((w) => w.exercises).some((e) => e.sets.length > 0)).toBe(false);
  });
  it("a Strong file with a Seconds column imports the hold", async () => {
    const strong = [
      "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE",
      '2026-05-01 10:00:00,Core,30m,Plank,1,0,0,0,60,,,',
      '2026-05-01 10:00:00,Core,30m,Plank,2,0,0,0,50,,,',
    ].join("\n");
    const parsed = parseImport(strong);
    const s = await setup();
    const p = await s.imports.preview(parsed);
    const r = await s.imports.importHistory({ parse: parsed, gymId: s.gymId, mappings: acceptAll(p.titles), fileName: "strong.csv" });
    expect(r).toMatchObject({ workouts: 1, sets: 2, skippedSets: 0 });
    expect((await s.db.all<{ d: number }>("SELECT duration_s AS d FROM workout_set WHERE deleted_at IS NULL ORDER BY position")).map((x) => x.d)).toEqual([60, 50]);
  });
  it("a timed row under an exercise the lifter counts in reps is reported as skipped, not turned into reps", async () => {
    const s = await setup();
    const strong = [
      "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE",
      '2026-05-02 10:00:00,Core,30m,Bench Press (Barbell),1,60,8,0,0,,,',
      '2026-05-02 10:00:00,Core,30m,Bench Press (Barbell),2,0,0,0,40,,,',
    ].join("\n");
    const parsed = parseImport(strong);
    const p = await s.imports.preview(parsed);
    const r = await s.imports.importHistory({ parse: parsed, gymId: s.gymId, mappings: acceptAll(p.titles) });
    expect(r.sets).toBe(1);
    expect(r.skippedSets).toBe(1);
  });
});

describe("the Why screen for a hold", () => {
  it("names seconds, not reps, in English and Arabic, with no placeholder left", async () => {
    const s = await setup();
    const ex = await s.idOf("plank");
    await s.planOnDayOne(ex);
    const { written } = await trainWith(s, ex, [{ durationS: 40 }, { durationS: 40 }, { durationS: 38 }]);
    const t = (await s.finish.getTargets(written!.sessionId)).find((x) => x.exerciseId === ex)!;
    const d = (await s.finish.getDecision(t.id))!;
    for (const lang of ["en", "ar"] as const) {
      const L = (k: string, p?: Record<string, string | number>) => translate(lang, k as StringKey, p);
      const sections = describeDecision(d.payload as DecisionPayload, { ruleVersion: d.ruleVersion, path: d.path }, L, lang);
      const text = sections.flatMap((x) => x.lines).join("\n");
      expect(text).not.toMatch(/\{[a-z]+\}/);
      expect(sections[1]!.lines[0]).toContain(lang === "en" ? "38 s" : "38 ث");
      expect(sections[1]!.lines[0]).not.toContain("×");
    }
  });
});
