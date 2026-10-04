import { describe, expect, it } from "vitest";
import { BackupInvalid } from "../src/logic/backup";
import { LATEST_VERSION, MIGRATIONS, migrate } from "../src/db/migrations";
import { addExercise, draftFingerprint, newExercise, normTopSets, updateExercise, validateDraft, type ProgrammeDraft } from "../src/logic/programmeDraft";
import { backoffPrefill, initialRows } from "../src/logic/workoutRows";
import { describeDecision } from "../src/logic/why";
import { ar, en } from "../src/i18n/strings";
import { freshDb } from "./helpers";
import { copyAtVersion, dumpAll, populatedWithRealHistory } from "./realData";

const DAY = 86_400_000;
const L = (k: string, p?: Record<string, string | number>) => (en[k as keyof typeof en] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(p?.[n] ?? ""));

describe("migration 10: top set + back-offs (upgrade from schema 9 with real data)", () => {
  it("is the latest schema and every row of a real history survives the upgrade, top_sets = NULL (straight sets) everywhere", async () => {
    const cur = await populatedWithRealHistory();
    expect(LATEST_VERSION).toBeGreaterThanOrEqual(10);
    const before = await dumpAll(cur.db);
    // columns added by later migrations do not exist at schema 10
    before.exercise = (before.exercise as Record<string, unknown>[]).map(({ load_spec_json: _l, ...rest }) => rest);
    expect((before.workout_set ?? []).length).toBeGreaterThan(1000); // the real 70-workout export is in there
    const old = await copyAtVersion(cur.db, 9);
    expect((await old.get<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(9);
    expect((await old.all<{ name: string }>("PRAGMA table_info(programme_day_exercise)")).map((c) => c.name)).not.toContain("top_sets");
    const r = await migrate(old, MIGRATIONS.filter((m) => m.version <= 10));
    expect(r).toEqual({ from: 9, to: 10 });
    expect((await old.all<{ name: string }>("PRAGMA table_info(programme_day_exercise)")).map((c) => c.name)).toContain("top_sets");
    const after = await dumpAll(old);
    // Row for row identical to the data it came from (the source has no top sets either), including the new column being NULL.
    expect(after).toEqual({ ...before, ...Object.fromEntries(Object.keys(after).filter((k) => !(k in before)).map((k) => [k, after[k]])) });
    for (const row of after.programme_day_exercise as { top_sets: number | null }[]) expect(row.top_sets).toBeNull();
    expect((await old.get<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(10);
  });
  it("refuses a top set count of 0 or 12 at the database level", async () => {
    const { db } = await freshDb();
    await db.exec("PRAGMA foreign_keys = OFF");
    const ins = (n: number) => db.run("INSERT INTO programme_day_exercise (id, programme_day_id, exercise_id, position, sets, rep_min, rep_max, top_sets, created_at, updated_at) VALUES ('x','d','e',0,3,6,10,?,1,1)", [n]);
    await expect(ins(0)).rejects.toThrow();
    await expect(ins(12)).rejects.toThrow();
    await ins(1);
  });
});

describe("draft helpers", () => {
  const d0: ProgrammeDraft = { name: "P", days: [{ name: "A", exercises: [newExercise("e1", { sets: 4 })] }] };
  it("normTopSets: 1..sets-1, anything else is straight sets", () => {
    expect(normTopSets(4, 1)).toBe(1);
    expect(normTopSets(4, 9)).toBe(3);
    expect(normTopSets(1, 1)).toBeNull();
    expect(normTopSets(4, 0)).toBeNull();
    expect(normTopSets(4, null)).toBeNull();
    expect(normTopSets(4, undefined)).toBeNull();
    expect(normTopSets(4, 1.5)).toBeNull();
  });
  it("new exercises are straight sets; choosing a top set works; fewer sets pull it back (and to 1 set it becomes straight)", () => {
    expect(d0.days[0]!.exercises[0]!.topSets).toBeNull();
    let d = updateExercise(d0, 0, 0, { topSets: 2 });
    expect(d.days[0]!.exercises[0]!.topSets).toBe(2);
    d = updateExercise(d, 0, 0, { sets: 2 });
    expect(d.days[0]!.exercises[0]!.topSets).toBe(1);
    d = updateExercise(d, 0, 0, { sets: 1 });
    expect(d.days[0]!.exercises[0]!.topSets).toBeNull();
    expect(updateExercise(d0, 0, 0, { topSets: 1 }).days[0]!.exercises[0]!.topSets).toBe(1);
  });
  it("a hand-made bad value is a problem; the fingerprint changes with the choice", () => {
    const bad = { ...d0, days: [{ name: "A", exercises: [{ ...d0.days[0]!.exercises[0]!, topSets: 4 }] }] };
    expect(validateDraft(bad).map((p) => p.code)).toContain("topsets_bad");
    expect(validateDraft(d0)).toEqual([]);
    expect(validateDraft(updateExercise(d0, 0, 0, { topSets: 1 }))).toEqual([]);
    expect(draftFingerprint(updateExercise(d0, 0, 0, { topSets: 1 }))).not.toBe(draftFingerprint(d0));
    expect(addExercise(d0, 0, newExercise("e2")).days[0]!.exercises).toHaveLength(2);
  });
  it("older drafts without the field behave as straight sets", () => {
    const old = { exerciseId: "e", sets: 3, repMin: 6, repMax: 10, repCeiling: null, isGoalLift: false, trackEffort: false };
    expect(validateDraft({ name: "P", days: [{ name: "A", exercises: [old] }] })).toEqual([]);
  });
});

describe("saving and reading the choice", () => {
  async function setup() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    return { ...ctx, gymId, gym };
  }
  it("the choice round-trips through a new program version, and old versions keep theirs", async () => {
    const s = await setup();
    const a = (await s.programmes.getActive())!;
    const draft = await s.programmes.loadDraft(a.versionId);
    expect(draft.days.every((d) => d.exercises.every((e) => !e.topSets))).toBe(true);
    const edited = updateExercise(draft, 0, 0, { sets: 4, topSets: 1 });
    const saved = await s.programmes.saveNewVersion(a.programmeId, edited);
    const back = await s.programmes.loadDraft(saved.versionId);
    expect(back.days[0]!.exercises[0]).toMatchObject({ sets: 4, topSets: 1 });
    expect((await s.programmes.loadDraft(a.versionId)).days[0]!.exercises[0]!.topSets).toBeFalsy();
    const rows = await s.repos.listDayExercises((await s.repos.getNextDay())!.day.id);
    expect(rows[0]).toMatchObject({ sets: 4, topSets: 1 });
    expect(rows.slice(1).every((r) => r.topSets === null)).toBe(true);
  });
  it("a top set stored for more top sets than fit (sets cut later, e.g. by a short week) reads back as straight or clamped, never impossible", async () => {
    const s = await setup();
    const day = (await s.repos.getNextDay())!.day;
    await s.db.run("UPDATE programme_day_exercise SET sets = 3, top_sets = 3 WHERE programme_day_id = ? AND position = 0", [day.id]);
    expect((await s.repos.listDayExercises(day.id))[0]!.topSets).toBe(2);
    await s.db.run("UPDATE programme_day_exercise SET sets = 1, top_sets = 1 WHERE programme_day_id = ? AND position = 0", [day.id]);
    expect((await s.repos.listDayExercises(day.id))[0]!.topSets).toBeNull();
  });
  it("switching an exercise to seconds clears the choice", async () => {
    const s = await setup();
    const a = (await s.programmes.getActive())!;
    const draft = await s.programmes.loadDraft(a.versionId);
    const saved = await s.programmes.saveNewVersion(a.programmeId, updateExercise(draft, 0, 0, { sets: 4, topSets: 1 }));
    const id = (await s.programmes.loadDraft(saved.versionId)).days[0]!.exercises[0]!.exerciseId;
    await s.programmes.setExerciseMeasure(id, "time");
    const day = (await s.repos.getNextDay())!.day;
    expect((await s.repos.listDayExercises(day.id))[0]!.topSets).toBeNull();
  });
});

describe("end to end: back-off sets do not block progression", () => {
  async function bench(topSets: number | null) {
    const s = await freshDb();
    await s.repos.seedIfNeeded();
    const gymId = (await s.repos.getActiveGymId())!;
    const gym = await s.repos.loadGymFingerprint(gymId);
    const a = (await s.programmes.getActive())!;
    let draft = await s.programmes.loadDraft(a.versionId);
    const benchId = (await s.db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = 'Barbell Bench Press'"))!.id;
    draft = { ...draft, days: draft.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => (e.exerciseId === benchId ? { ...e, sets: 4, repMin: 6, repMax: 10, topSets } : e)) })) };
    await s.programmes.saveNewVersion(a.programmeId, draft);
    const trainRotation = async (plan: { load: number; reps: number }[]) => {
      let written: string | null = null;
      for (let d = 0; d < draft.days.length; d++) {
        const next = (await s.repos.getNextDay())!;
        const exs = await s.repos.listDayExercises(next.day.id);
        const { id } = await s.workout.startOrResumeSession(next.day.id, gymId);
        const mine = exs.find((e) => e.exerciseId === benchId) ?? exs[0]!;
        const sets = mine.exerciseId === benchId ? plan : [{ load: 40, reps: 10 }];
        for (const x of sets) await s.workout.logSet({ sessionId: id, exerciseId: mine.exerciseId, load: x.load, reps: x.reps }, { gym, equipment: mine.equipment, setup: mine.setup });
        s.deps.tick(1000);
        await s.workout.finishSession(id);
        written = (await s.finish.writeNextSessionTargets(id))!.sessionId;
        s.deps.tick(DAY);
      }
      return (await s.finish.getTargets(written!)).find((t) => t.exerciseId === benchId)!;
    };
    return { ...s, trainRotation, benchId };
  }
  const plan = [{ load: 60, reps: 10 }, { load: 50, reps: 12 }, { load: 50, reps: 12 }, { load: 50, reps: 12 }];

  it("straight sets: one top set plus lighter sets does NOT earn more weight (the lighter sets are the weakest)", async () => {
    const s = await bench(null);
    await s.trainRotation(plan);
    const t = await s.trainRotation(plan);
    expect(t.currency).not.toBe("load");
    expect(t.load).toBe(60);
  });
  it("top set + back-offs: the same session earns more weight, and the Why text says only the top set counts", async () => {
    const s = await bench(1);
    await s.trainRotation(plan);
    const t = await s.trainRotation(plan);
    expect(t.currency).toBe("load");
    expect(t.load).toBeGreaterThan(60);
    const d = (await s.finish.getDecision(t.id))!;
    expect(d.payload.inputs.topSets).toBe(1);
    expect(d.payload.inputs.readiness.requiredSetsAtTop).toBe(1);
    const lines = describeDecision(d.payload, { ruleVersion: d.ruleVersion, path: d.path }, L, "en").find((x) => x.title === en["why.rule"])!.lines.join("\n");
    expect(lines).toContain("Top set + back-offs: only your 1 heaviest set(s) decide whether weight goes up. The lighter back-off sets after them are ignored for progression.");
  });
  it("top set + back-offs still needs the top set itself to reach the top of the range", async () => {
    const s = await bench(1);
    await s.trainRotation([{ load: 60, reps: 9 }, ...plan.slice(1)]);
    const t = await s.trainRotation([{ load: 60, reps: 9 }, ...plan.slice(1)]);
    expect(t.currency).toBe("reps");
    expect(t.load).toBe(60);
  });
  it("a straight-sets exercise has no top-set sentence in its Why text", async () => {
    const s = await bench(null);
    await s.trainRotation(plan);
    const t = await s.trainRotation(plan);
    const d = (await s.finish.getDecision(t.id))!;
    expect(d.payload.inputs.topSets).toBeUndefined();
    expect(describeDecision(d.payload, { ruleVersion: d.ruleVersion, path: d.path }, L, "en").flatMap((x) => x.lines).join("\n")).not.toContain("Top set + back-offs");
  });
});

describe("the logger rows for back-offs", () => {
  const key = (() => { let n = 0; return () => `k${n++}`; })();
  it("top-set rows get the target, back-off rows get last time's set at that position (or nothing), never the top load", () => {
    const rows = initialRows([], 4, { load: 100, reps: 8 }, key, backoffPrefill(1, [{ load: 100, reps: 8 }, { load: 80, reps: 12 }, { load: 80, reps: 11 }]));
    expect(rows.map((r) => [r.ghostLoad, r.ghostReps])).toEqual([[100, 8], [80, 12], [80, 11], [null, null]]);
  });
  it("two top sets", () => {
    const rows = initialRows([], 4, { load: 100, reps: 8 }, key, backoffPrefill(2, [{ load: 100, reps: 8 }, { load: 100, reps: 8 }, { load: 85, reps: 10 }]));
    expect(rows.map((r) => r.ghostLoad)).toEqual([100, 100, 85, null]);
  });
  it("straight sets are unchanged", () => {
    expect(initialRows([], 3, { load: 60, reps: 10 }, key).map((r) => r.ghostLoad)).toEqual([60, 60, 60]);
    expect(backoffPrefill(null, [])).toBeNull();
  });
});

describe("export, import and older files", () => {
  it("the export carries top_sets; a backup made before this version (no such column) still restores, as straight sets", async () => {
    const a = await freshDb();
    await a.repos.seedIfNeeded();
    const prog = (await a.programmes.getActive())!;
    const draft = await a.programmes.loadDraft(prog.versionId);
    await a.programmes.saveNewVersion(prog.programmeId, updateExercise(draft, 0, 0, { sets: 4, topSets: 1 }));
    const json = JSON.parse(await a.data.exportJson());
    const pde = json.tables.programme_day_exercise as Record<string, unknown>[];
    expect(pde.some((r) => r.top_sets === 1)).toBe(true);
    // same file as the app wrote before: schema 9, no top_sets key anywhere
    const older = JSON.parse(JSON.stringify(json));
    older.schemaVersion = 9;
    for (const r of older.tables.programme_day_exercise) delete r.top_sets;
    const b = await freshDb();
    await b.data.restoreJson(JSON.stringify(older));
    const rows = await b.db.all<{ top_sets: number | null }>("SELECT top_sets FROM programme_day_exercise");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.top_sets === null)).toBe(true);
    // and the new file restores with the choice intact
    const c = await freshDb();
    await c.data.restoreJson(JSON.stringify(json));
    expect((await c.db.all<{ top_sets: number | null }>("SELECT top_sets FROM programme_day_exercise WHERE top_sets IS NOT NULL")).length).toBe(1);
  });
  it("a file with a column this app does not know is still refused (unchanged safety)", async () => {
    const a = await freshDb();
    await a.repos.seedIfNeeded();
    const j = JSON.parse(await a.data.exportJson());
    j.tables.programme_day_exercise[0].not_a_column = 1;
    await expect(a.data.restoreJson(JSON.stringify(j))).rejects.toBeInstanceOf(BackupInvalid);
  });
});

describe("strings", () => {
  it("English and Egyptian Arabic (draft) exist with the same placeholders, and English says 'program'", () => {
    for (const k of ["prog.ex.scheme", "prog.ex.scheme.straight", "prog.ex.scheme.top", "prog.ex.topSets", "prog.ex.schemeHint", "prog.problem.topsets_bad", "why.topSets", "workout.topset.note"] as const) {
      expect(ar[k], k).toMatch(/[\u0600-\u06FF]/);
      expect((en[k].match(/\{\w+\}/g) ?? []).sort()).toEqual((ar[k].match(/\{\w+\}/g) ?? []).sort());
      expect(en[k].toLowerCase()).not.toContain("programme");
    }
  });
});
