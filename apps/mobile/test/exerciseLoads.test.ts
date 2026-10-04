import { describe, expect, it } from "vitest";
import { BackupInvalid } from "../src/logic/backup";
import { LATEST_VERSION, MIGRATIONS, migrate } from "../src/db/migrations";
import { buildLoads, emptyLoadsForm, formFromSpec, loadsSummaryText, parseStoredLoads, serializeLoads, specValues } from "../src/logic/exerciseLoads";
import { describeDecision } from "../src/logic/why";
import { kgToUnit } from "../src/logic/units";
import { ar, en } from "../src/i18n/strings";
import { freshDb } from "./helpers";
import { copyAtVersion, dumpAll, populatedWithRealHistory } from "./realData";

const DAY = 86_400_000;
const L = (k: string, p?: Record<string, string | number>) => (en[k as keyof typeof en] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(p?.[n] ?? ""));
const form = (o: Partial<ReturnType<typeof emptyLoadsForm>>) => ({ ...emptyLoadsForm(), ...o });

describe("stored text", () => {
  it("round-trips a list and a step grid (kilograms, no equipment inside)", () => {
    const list = { equipment: "dumbbell" as const, loads: [12, 10, 14, 10] };
    expect(serializeLoads(list)).toBe('{"loads":[10,12,14]}');
    expect(parseStoredLoads(serializeLoads(list), "dumbbell")).toEqual({ equipment: "dumbbell", loads: [10, 12, 14] });
    const step = { equipment: "machine" as const, increment: 4.5, min: 4.5, max: 90 };
    expect(parseStoredLoads(serializeLoads(step), "machine")).toEqual(step);
  });
  it("unusable text reads as 'not set' and never throws", () => {
    for (const bad of [null, undefined, "", "{", "[]", "null", "7", '{"loads":[]}', '{"loads":[-1]}', '{"loads":"x"}', '{"increment":0}', '{"increment":"2"}', '{"increment":2.5,"min":10,"max":5}', '{"min":5}', '{"loads":[1e999]}'])
      expect(parseStoredLoads(bad as string | null, "barbell"), String(bad)).toBeNull();
  });
});

describe("the form", () => {
  it("default mode clears the setting", () => expect(buildLoads(form({ mode: "default" }), "dumbbell", "kg")).toEqual({ spec: null, problems: [] }));
  it("a list of dumbbells in kg", () => {
    const r = buildLoads(form({ mode: "list", listText: "10, 12 14,16" }), "dumbbell", "kg");
    expect(r.spec).toEqual({ equipment: "dumbbell", loads: [10, 12, 14, 16] });
  });
  it("Arabic digits and the Arabic comma are read", () => {
    expect(buildLoads(form({ mode: "list", listText: "١٠، ١٢٫٥" }), "dumbbell", "kg").spec).toEqual({ equipment: "dumbbell", loads: [10, 12.5] });
  });
  it("a barbell with a 20 kg bar and 1.25 kg plates", () => {
    expect(buildLoads(form({ mode: "step", stepText: "2.5", minText: "20", maxText: "250" }), "barbell", "kg").spec).toEqual({ equipment: "barbell", increment: 2.5, min: 20, max: 250 });
  });
  it("lb: a 5 lb step from a 45 lb bar is stored in kilograms and shows as the same numbers", () => {
    const r = buildLoads(form({ mode: "step", stepText: "5", minText: "45" }), "barbell", "lb");
    expect(r.spec!.increment).toBeCloseTo(2.268, 3);
    expect(r.spec!.min).toBeCloseTo(20.412, 3);
    const back = formFromSpec(r.spec, "lb");
    expect([back.stepText, back.minText, back.mode]).toEqual(["5", "45", "step"]);
    // reopening and saving unchanged moves no weight by a gram
    expect(buildLoads(back, "barbell", "lb", specValues(r.spec)).spec).toEqual(r.spec);
  });
  it("lb dumbbell list: 5, 7.5 and 10 lb", () => {
    const r = buildLoads(form({ mode: "list", listText: "5 7.5 10" }), "dumbbell", "lb");
    expect(r.spec!.loads!.map((x) => kgToUnit(x, "lb"))).toEqual([5, 7.5, 10]);
  });
  it("says what is wrong instead of guessing", () => {
    const codes = (f: Partial<ReturnType<typeof emptyLoadsForm>>, eq: Parameters<typeof buildLoads>[1] = "machine") => buildLoads(form(f), eq, "kg").problems.map((p) => p.code);
    expect(codes({ mode: "step" })).toEqual(["step_missing"]);
    expect(codes({ mode: "step", stepText: "0" })).toEqual(["step_bad"]);
    expect(codes({ mode: "step", stepText: "abc" })).toEqual(["step_bad"]);
    expect(codes({ mode: "step", stepText: "5", minText: "x" })).toEqual(["min_bad"]);
    expect(codes({ mode: "step", stepText: "5", maxText: "0" })).toEqual(["max_bad"]);
    expect(codes({ mode: "step", stepText: "5", minText: "50", maxText: "20" })).toEqual(["range_bad"]);
    expect(codes({ mode: "step", stepText: "0.001", minText: "1", maxText: "1000" })).toEqual(["too_many_rungs"]);
    expect(codes({ mode: "list" })).toEqual(["list_empty"]);
    expect(codes({ mode: "list", listText: "10 x 12" })).toEqual(["list_invalid"]);
    expect(buildLoads(form({ mode: "list", listText: "10 x 12" }), "dumbbell", "kg").problems[0]!.detail).toEqual(["x"]);
    expect(codes({ mode: "list", listText: "0 5" }, "dumbbell")).toEqual(["list_zero"]);
    expect(codes({ mode: "list", listText: "0 5" }, "assisted")).toEqual([]); // zero assistance is a real rung
  });
  it("summary in words, in the lifter's unit", () => {
    expect(loadsSummaryText({ equipment: "machine", increment: 4.5, min: 4.5, max: 90 }, "kg", "kg", L)).toBe("steps of 4.5 kg, from 4.5 to 90");
    expect(loadsSummaryText({ equipment: "machine", increment: 4.5 }, "kg", "kg", L)).toBe("steps of 4.5 kg");
    expect(loadsSummaryText({ equipment: "machine", increment: 4.5, max: 90 }, "kg", "kg", L)).toBe("steps of 4.5 kg, up to 90");
    expect(loadsSummaryText({ equipment: "dumbbell", loads: [10, 12] }, "kg", "kg", L)).toBe("the weights 10, 12 kg");
  });
});

describe("migration 11: weights set per exercise (upgrade from schema 10 with real data)", () => {
  it("every row of a real history survives, load_spec_json = NULL everywhere (the gym's grid, as before)", async () => {
    const cur = await populatedWithRealHistory();
    expect(LATEST_VERSION).toBeGreaterThanOrEqual(11);
    const before = await dumpAll(cur.db);
    expect((before.workout_set ?? []).length).toBeGreaterThan(1000);
    const old = await copyAtVersion(cur.db, 10);
    expect((await old.all<{ name: string }>("PRAGMA table_info(exercise)")).map((c) => c.name)).not.toContain("load_spec_json");
    expect(await migrate(old, MIGRATIONS.filter((m) => m.version <= 11))).toEqual({ from: 10, to: 11 });
    expect((await old.all<{ name: string }>("PRAGMA table_info(exercise)")).map((c) => c.name)).toContain("load_spec_json");
    const after = await dumpAll(old);
    expect(after).toEqual(before);
    for (const row of after.exercise as { load_spec_json: string | null }[]) expect(row.load_spec_json).toBeNull();
    expect((await old.get<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(11);
    // a second run changes nothing
    expect(await migrate(old, MIGRATIONS.filter((m) => m.version <= 11))).toEqual({ from: 11, to: 11 });
  });
});

describe("end to end: an exercise's own weights drive its targets", () => {
  async function bench() {
    const s = await freshDb();
    await s.repos.seedIfNeeded();
    const gymId = (await s.repos.getActiveGymId())!;
    const gym = await s.repos.loadGymFingerprint(gymId);
    const a = (await s.programmes.getActive())!;
    let draft = await s.programmes.loadDraft(a.versionId);
    const benchId = (await s.db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = 'Barbell Bench Press'"))!.id;
    draft = { ...draft, days: draft.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => (e.exerciseId === benchId ? { ...e, sets: 3, repMin: 6, repMax: 10, topSets: null } : e)) })) };
    await s.programmes.saveNewVersion(a.programmeId, draft);
    const rotation = async () => {
      let written: string | null = null;
      for (let d = 0; d < draft.days.length; d++) {
        const next = (await s.repos.getNextDay())!;
        const exs = await s.repos.listDayExercises(next.day.id);
        const { id } = await s.workout.startOrResumeSession(next.day.id, gymId);
        const mine = exs.find((e) => e.exerciseId === benchId) ?? exs[0]!;
        for (let i = 0; i < 3; i++) await s.workout.logSet({ sessionId: id, exerciseId: mine.exerciseId, load: mine.exerciseId === benchId ? 60 : 40, reps: 10 }, { gym, equipment: mine.equipment, setup: mine.setup });
        s.deps.tick(1000);
        await s.workout.finishSession(id);
        written = (await s.finish.writeNextSessionTargets(id))!.sessionId;
        s.deps.tick(DAY);
      }
      return (await s.finish.getTargets(written!)).find((t) => t.exerciseId === benchId)!;
    };
    return { ...s, rotation, benchId, gym };
  }
  const textOf = (d: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof bench>>["finish"]["getDecision"]>>>) =>
    describeDecision(d.payload, { ruleVersion: d.ruleVersion, path: d.path }, L, "en").find((x) => x.title === en["why.gym"])!.lines.join("\n");

  it("nothing set: the gym's 2.5 kg barbell step, and the Why text does not claim the lifter's own weights", async () => {
    const s = await bench();
    await s.rotation();
    const t = await s.rotation();
    expect(t.load).toBe(62.5);
    const d = (await s.finish.getDecision(t.id))!;
    expect(d.payload.inputs.gym.loadSource).toBeUndefined();
    const text = textOf(d);
    expect(text).toContain("typical weights, not a measurement of your gym");
    expect(text).not.toContain("you set");
  });
  it("own weights set: the next weight comes from them, the Why text says they are the lifter's, and earlier decisions are unchanged", async () => {
    const s = await bench();
    await s.rotation();
    const first = await s.rotation();
    const decisionBefore = JSON.stringify((await s.finish.getDecision(first.id))!.payload);
    await s.rotation(); // the session that used `first` is now done; the one after it is only planned
    await s.programmes.setExerciseLoads(s.benchId, { equipment: "barbell", increment: 3, min: 21, max: 150 });
    const t = await s.rotation();
    expect(t.load).toBe(63);
    const d = (await s.finish.getDecision(t.id))!;
    expect(d.payload.inputs.gym.loadSource).toBe("exercise");
    expect(d.payload.inputs.gym.loadSpec).toEqual({ equipment: "barbell", increment: 3, min: 21, max: 150 });
    const text = textOf(d);
    expect(text).toContain("Weights you set for this exercise: steps of 3 kg, from 21 to 150.");
    expect(text).not.toContain("typical weights");
    // Arabic and lb render too
    expect(describeDecision(d.payload, { ruleVersion: d.ruleVersion, path: d.path }, (k, p) => (ar[k as keyof typeof ar] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(p?.[n] ?? "")), "ar", "lb").length).toBeGreaterThan(3);
    // the decision behind a target that was already worked is exactly what it was
    expect(JSON.stringify((await s.finish.getDecision(first.id))!.payload)).toBe(decisionBefore);
    // clearing goes back to the gym's step
    await s.programmes.setExerciseLoads(s.benchId, null);
    expect((await s.repos.getExerciseLoads(s.benchId))!.spec).toBeNull();
  });
  it("planned targets follow a change at once, and the list screen data carries the weights", async () => {
    const s = await bench();
    await s.rotation();
    await s.rotation();
    const planned = (await s.db.get<{ id: string }>("SELECT id FROM session WHERE status = 'planned' AND deleted_at IS NULL"))!.id;
    const before = (await s.finish.getTargets(planned)).find((x) => x.exerciseId === s.benchId)!;
    expect(before.load).toBe(62.5);
    await s.programmes.setExerciseLoads(s.benchId, { equipment: "barbell", increment: 3, min: 21, max: 150 });
    const after = (await s.finish.getTargets(planned)).find((x) => x.exerciseId === s.benchId)!;
    expect(after.load).toBe(63);
    const day = (await s.repos.getNextDay())!.day;
    const ex = (await s.repos.listDayExercises(day.id)).find((e) => e.exerciseId === s.benchId);
    if (ex) expect(ex.loadSpec).toEqual({ equipment: "barbell", increment: 3, min: 21, max: 150 });
  });
  it("refuses weights for the wrong equipment or invalid weights", async () => {
    const s = await bench();
    await expect(s.programmes.setExerciseLoads(s.benchId, { equipment: "dumbbell", loads: [10] })).rejects.toThrow();
    await expect(s.programmes.setExerciseLoads(s.benchId, { equipment: "barbell", increment: 0 })).rejects.toThrow();
    await expect(s.programmes.setExerciseLoads("nope", null)).rejects.toThrow();
  });
  it("damaged stored text in the database cannot stop the workout: the gym's grid is used", async () => {
    const s = await bench();
    await s.db.run("UPDATE exercise SET load_spec_json = '{broken' WHERE id = ?", [s.benchId]);
    await s.rotation();
    const t = await s.rotation();
    expect(t.load).toBe(62.5);
  });
});

describe("export, import, sync and older files", () => {
  it("the export carries load_spec_json; a backup from before this version (no such column) restores as 'not set'", async () => {
    const a = await freshDb();
    await a.repos.seedIfNeeded();
    const id = (await a.db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = 'Barbell Bench Press'"))!.id;
    await a.programmes.setExerciseLoads(id, { equipment: "barbell", increment: 3, min: 21 });
    const json = JSON.parse(await a.data.exportJson());
    expect((json.tables.exercise as Record<string, unknown>[]).find((r) => r.id === id)!.load_spec_json).toBe('{"increment":3,"min":21}');
    const older = JSON.parse(JSON.stringify(json));
    older.schemaVersion = 10;
    for (const r of older.tables.exercise) delete r.load_spec_json;
    const b = await freshDb();
    await b.data.restoreJson(JSON.stringify(older));
    expect((await b.db.all<{ load_spec_json: string | null }>("SELECT load_spec_json FROM exercise")).every((r) => r.load_spec_json === null)).toBe(true);
    const c = await freshDb();
    await c.data.restoreJson(JSON.stringify(json));
    expect((await c.repos.getExerciseLoads(id))!.spec).toEqual({ equipment: "barbell", increment: 3, min: 21 });
  });
  it("changing the weights moves the row's updated_at, so it syncs", async () => {
    const a = await freshDb();
    await a.repos.seedIfNeeded();
    const id = (await a.db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = 'Barbell Bench Press'"))!.id;
    const t0 = (await a.db.get<{ u: number }>("SELECT updated_at AS u FROM exercise WHERE id = ?", [id]))!.u;
    a.deps.tick(5000);
    await a.programmes.setExerciseLoads(id, { equipment: "barbell", increment: 3, min: 21 });
    expect((await a.db.get<{ u: number }>("SELECT updated_at AS u FROM exercise WHERE id = ?", [id]))!.u).toBeGreaterThan(t0);
  });
  it("a file with a column this app does not know is still refused", async () => {
    const a = await freshDb();
    await a.repos.seedIfNeeded();
    const j = JSON.parse(await a.data.exportJson());
    j.tables.exercise[0].not_a_column = 1;
    await expect(a.data.restoreJson(JSON.stringify(j))).rejects.toBeInstanceOf(BackupInvalid);
  });
});

describe("strings", () => {
  it("English and Egyptian Arabic (draft) have the same placeholders, English says 'program', and nothing claims the gym's real loads", () => {
    const keys = (Object.keys(en) as (keyof typeof en)[]).filter((k) => k.startsWith("loads.") || k.startsWith("why.loads."));
    expect(keys.length).toBeGreaterThan(30);
    for (const k of keys) {
      expect(ar[k], k).toMatch(/[\u0600-\u06FF]/);
      expect((en[k].match(/\{\w+\}/g) ?? []).sort(), k).toEqual((ar[k].match(/\{\w+\}/g) ?? []).sort());
      expect(en[k].toLowerCase()).not.toContain("programme");
      expect(en[k].toLowerCase()).not.toContain("your gym's loads");
    }
  });
});
