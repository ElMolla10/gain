import { describe, expect, it } from "vitest";
import { DraftInvalid, SessionInProgress } from "../src/db/programmeRepo";
import { SAMPLE_EXERCISES } from "../src/db/seedData";
import { ALL_LIBRARY } from "../src/db/libraryDraft";
import { computeExposure, diffExposure, goalLiftFrequency, groupOfPattern, PATTERNS } from "../src/logic/exposure";
import {
  addDay, addExercise, draftFingerprint, MAX_DAYS, moveDay, moveExercise, newExercise, removeDay, removeExercise, renameDay, updateExercise, validateDraft, type ProgrammeDraft,
} from "../src/logic/programmeDraft";
import { estimateSessionMinutes, instantiateTemplate, TEMPLATES, templatesForDays } from "../src/logic/templates";
import { freshDb } from "./helpers";

const d0: ProgrammeDraft = { name: "P", days: [{ name: "A", exercises: [newExercise("e1"), newExercise("e2")] }, { name: "B", exercises: [newExercise("e3")] }] };

describe("programme draft edits", () => {
  it("add / remove / rename / move days without touching the original", () => {
    const d1 = addDay(d0, "C");
    expect(d1.days.map((d) => d.name)).toEqual(["A", "B", "C"]);
    expect(d0.days).toHaveLength(2);
    expect(moveDay(d1, 2, 0).days.map((d) => d.name)).toEqual(["C", "A", "B"]);
    expect(moveDay(d1, 0, 9)).toEqual(d1); // out of range: unchanged
    expect(renameDay(d1, 1, "Pull").days[1]!.name).toBe("Pull");
    expect(removeDay(d1, 0).days.map((d) => d.name)).toEqual(["B", "C"]);
  });
  it("caps the number of days", () => {
    let d = d0;
    for (let i = 0; i < 12; i++) d = addDay(d, `D${i}`);
    expect(d.days).toHaveLength(MAX_DAYS);
  });
  it("exercises: add (no duplicates in a day), move, update, remove", () => {
    const a = addExercise(d0, 0, newExercise("e9"));
    expect(a.days[0]!.exercises.map((e) => e.exerciseId)).toEqual(["e1", "e2", "e9"]);
    expect(addExercise(a, 0, newExercise("e9")).days[0]!.exercises).toHaveLength(3);
    expect(moveExercise(a, 0, 2, 0).days[0]!.exercises.map((e) => e.exerciseId)).toEqual(["e9", "e1", "e2"]);
    expect(updateExercise(a, 0, 1, { sets: 5, isGoalLift: true }).days[0]!.exercises[1]).toMatchObject({ sets: 5, isGoalLift: true });
    expect(removeExercise(a, 0, 0).days[0]!.exercises.map((e) => e.exerciseId)).toEqual(["e2", "e9"]);
  });
  it("validates", () => {
    expect(validateDraft(d0)).toEqual([]);
    expect(validateDraft({ name: " ", days: [] }).map((p) => p.code)).toEqual(["name_empty", "no_days"]);
    expect(validateDraft({ name: "P", days: [{ name: "", exercises: [] }] }).map((p) => p.code)).toEqual(["day_name_empty", "day_empty"]);
    const bad = updateExercise(updateExercise(updateExercise(d0, 0, 0, { sets: 0 }), 0, 1, { repMin: 8, repMax: 5 }), 1, 0, { repCeiling: 0 });
    expect(validateDraft(bad).map((p) => p.code)).toEqual(["sets_bad", "reps_bad", "ceiling_bad"]);
    const dup: ProgrammeDraft = { name: "P", days: [{ name: "A", exercises: [newExercise("e1"), newExercise("e1")] }] };
    expect(validateDraft(dup).map((p) => p.code)).toContain("duplicate_exercise");
  });
  it("fingerprint ignores nothing that matters and nothing that does not", () => {
    expect(draftFingerprint(d0)).toBe(draftFingerprint(JSON.parse(JSON.stringify(d0))));
    expect(draftFingerprint(updateExercise(d0, 0, 0, { sets: 4 }))).not.toBe(draftFingerprint(d0));
    expect(draftFingerprint(renameDay(d0, 0, "A "))).toBe(draftFingerprint(d0)); // trailing space is not a change
  });
});

describe("weekly exposure", () => {
  const patterns: Record<string, string> = { e1: "horizontal_push", e2: "incline_push", e3: "squat", e4: "elbow_flexion" };
  const p = (id: string) => patterns[id];
  const draft: ProgrammeDraft = {
    name: "UL",
    days: [
      { name: "Upper", exercises: [newExercise("e1", { sets: 3 }), newExercise("e2", { sets: 3 }), newExercise("e4", { sets: 2 })] },
      { name: "Lower", exercises: [newExercise("e3", { sets: 4 })] },
      { name: "Upper 2", exercises: [newExercise("e1", { sets: 3 })] },
      { name: "Lower 2", exercises: [newExercise("e3", { sets: 3 })] },
    ],
  };
  it("counts each exercise once under its main pattern, scaled to a week by days per week", () => {
    const rows = computeExposure(draft, p, 4);
    const chest = rows.find((r) => r.group === "chest")!;
    expect(chest).toMatchObject({ setsPerRotation: 9, daysPerRotation: 2, setsPerWeek: 9, sessionsPerWeek: 2 });
    expect(rows.find((r) => r.group === "quads")).toMatchObject({ setsPerRotation: 7, setsPerWeek: 7, sessionsPerWeek: 2 });
    expect(rows.find((r) => r.group === "biceps")).toMatchObject({ setsPerWeek: 2, sessionsPerWeek: 1 });
  });
  it("a 4-day rotation trained 3 days a week takes 4/3 weeks, so weekly numbers shrink", () => {
    const chest = computeExposure(draft, p, 3).find((r) => r.group === "chest")!;
    expect(chest.setsPerWeek).toBe(6.8); // 9 * 3/4
    expect(chest.sessionsPerWeek).toBe(1.5);
  });
  it("makes up no weekly numbers when days per week is unknown", () => {
    const rows = computeExposure(draft, p, null);
    expect(rows.every((r) => r.setsPerWeek === null && r.sessionsPerWeek === null)).toBe(true);
    expect(rows[0]!.setsPerRotation).toBeGreaterThan(0);
  });
  it("unknown patterns land in 'other'", () => {
    expect(groupOfPattern("whatever")).toBe("other");
    expect(computeExposure({ name: "x", days: [{ name: "a", exercises: [newExercise("zz")] }] }, () => undefined, 1)[0]!.group).toBe("other");
  });
  it("every library pattern has a group", () => {
    for (const e of SAMPLE_EXERCISES) expect(PATTERNS as readonly string[]).toContain(e.pattern);
  });
  it("diff shows what an edit does: dropped chest day, added biceps", () => {
    const before = computeExposure(draft, p, 4);
    let after = removeExercise(draft, 2, 0); // Upper 2 loses its only exercise (chest, 3 sets)
    after = addExercise(after, 1, newExercise("e4", { sets: 3 }));
    const ch = diffExposure(before, computeExposure(after, p, 4));
    expect(ch.find((c) => c.group === "chest")).toMatchObject({ kind: "down", deltaSets: -3, deltaSessions: -1 });
    expect(ch.find((c) => c.group === "biceps")).toMatchObject({ kind: "up", deltaSets: 3, deltaSessions: 1 });
    expect(ch.find((c) => c.group === "quads")).toBeUndefined();
    const gone = diffExposure(before, computeExposure({ ...draft, days: draft.days.slice(1) }, p, 4));
    expect(gone.find((c) => c.group === "biceps")).toMatchObject({ kind: "removed" });
  });
  it("counts goal-lift frequency per rotation", () => {
    const g = updateExercise(updateExercise(draft, 0, 0, { isGoalLift: true }), 2, 0, { isGoalLift: true });
    expect(goalLiftFrequency(g).get("e1")).toBe(2);
  });
});

describe("templates", () => {
  const lib = { byKey: new Map(ALL_LIBRARY.map((e) => [e.key, { exerciseId: `id-${e.key}`, equipment: e.equipment }])) };
  const ceilingFor = (key: string) => (/squat|leg|romanian|calf/.test(key) ? 12 : /lateral/.test(key) ? 15 : 10);
  it("every template uses only library exercises and none claims to be reviewed", () => {
    for (const t of TEMPLATES) {
      expect(t.reviewed).toBe(false);
      expect(t.schedule.length).toBeLessThanOrEqual(t.days);
      for (const d of t.schedule) {
        expect(d.exercises.length).toBeGreaterThan(0);
        for (const e of d.exercises) expect(lib.byKey.has(e.key), e.key).toBe(true);
        expect(new Set(d.exercises.map((e) => e.key)).size).toBe(d.exercises.length);
      }
    }
  });
  it("offers the templates for the days attended; never more days than that", () => {
    const ids = (n: number) => templatesForDays(n).map((o) => o.template.id);
    expect(ids(4)).toEqual(expect.arrayContaining(["mix_4", "upper_lower_4"]));
    expect(templatesForDays(4).every((o) => o.fit === "exact" && o.template.days === 4)).toBe(true);
    expect(ids(3)).toEqual(expect.arrayContaining(["full_body_3", "ppl_3"]));
    expect(ids(6)).toContain("ppl_6");
    expect(templatesForDays(1)).toEqual([]);
    const seven = templatesForDays(7);
    expect(seven.every((o) => o.fit === "fewer" && o.template.days === 6)).toBe(true);
  });
  it("instantiates into a valid draft with the policy ceiling as the top of each range", () => {
    const t = TEMPLATES.find((x) => x.id === "upper_lower_4")!;
    const { draft, dropped } = instantiateTemplate(t, lib, { lang: "en", ceilingFor, goalLiftKey: "bench_press" });
    expect(dropped).toEqual([]);
    expect(validateDraft(draft)).toEqual([]);
    expect(draft.days.map((d) => d.name)).toEqual(["Upper A", "Lower A", "Upper B", "Lower B"]);
    const bench = draft.days[0]!.exercises.find((e) => e.exerciseId === "id-bench_press")!;
    expect(bench).toMatchObject({ isGoalLift: true, repMax: 10, repMin: 6 });
    const squat = draft.days[1]!.exercises.find((e) => e.exerciseId === "id-back_squat")!;
    expect(squat.repMax).toBe(12);
  });
  it("uses Arabic names when asked", () => {
    const { draft } = instantiateTemplate(TEMPLATES[0]!, lib, { lang: "ar", ceilingFor });
    expect(draft.name).toMatch(/[\u0600-\u06FF]/);
    expect(draft.days[0]!.name).toMatch(/[\u0600-\u06FF]/);
  });
  it("leaves out exercises whose equipment the lifter does not use, and says so", () => {
    const t = TEMPLATES.find((x) => x.id === "ppl_3")!;
    const { draft, dropped } = instantiateTemplate(t, lib, { lang: "en", ceilingFor, equipment: ["dumbbell", "cable"] });
    expect(dropped.every((x) => x.reason === "equipment")).toBe(true);
    expect(dropped.map((x) => x.key)).toContain("bench_press");
    const keys = draft.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(keys).not.toContain("id-bench_press");
    expect(keys).toContain("id-lat_pulldown");
  });
  it("trims accessories to the session length, never a main lift, and lists what it cut", () => {
    const t = TEMPLATES.find((x) => x.id === "upper_lower_4")!;
    const { draft, dropped } = instantiateTemplate(t, lib, { lang: "en", ceilingFor, sessionMinutes: 30 });
    for (const day of draft.days) expect(estimateSessionMinutes(day.exercises.reduce((n, e) => n + e.sets, 0))).toBeLessThanOrEqual(30);
    expect(dropped.every((x) => x.reason === "time")).toBe(true);
    expect(dropped.length).toBeGreaterThan(0);
    expect(draft.days[0]!.exercises[0]!.exerciseId).toBe("id-bench_press");
    expect(draft.days[1]!.exercises[0]!.exerciseId).toBe("id-back_squat");
  });
  it("a day with nothing the lifter can do is left out, not faked", () => {
    const t = TEMPLATES.find((x) => x.id === "mix_4")!;
    const { draft } = instantiateTemplate(t, lib, { lang: "en", ceilingFor, equipment: ["barbell"] });
    expect(draft.days.map((d) => d.name)).toEqual(["Chest and triceps", "Legs"]);
  });
});

describe("programme repo: versions", () => {
  async function seeded() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    const active = (await ctx.programmes.getActive())!;
    const v1 = await ctx.programmes.loadDraft(active.versionId);
    const trainDay = async () => {
      const next = (await ctx.repos.getNextDay())!;
      const exs = await ctx.repos.listDayExercises(next.day.id);
      const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
      const e = exs[0]!;
      for (let i = 0; i < 3; i++) await ctx.workout.logSet({ sessionId: id, exerciseId: e.exerciseId, load: 40, reps: 8 }, { gym, equipment: e.equipment, setup: e.setup });
      ctx.deps.tick();
      await ctx.workout.finishSession(id);
      await ctx.finish.writeNextSessionTargets(id);
      ctx.deps.tick(86_400_000);
      return { sessionId: id, dayName: next.day.name };
    };
    return { ...ctx, gymId, active, v1, trainDay };
  }

  it("saving an edit writes version 2 and leaves version 1 exactly as it was", async () => {
    const { programmes, active, v1 } = await seeded();
    const edited = updateExercise(v1, 0, 0, { sets: 5 });
    const r = await programmes.saveNewVersion(active.programmeId, edited);
    expect(r).toMatchObject({ version: 2, changed: true });
    expect(await programmes.loadDraft(active.versionId)).toEqual(v1);
    expect((await programmes.loadDraft(r.versionId)).days[0]!.exercises[0]!.sets).toBe(5);
    expect((await programmes.getActive())!.versionId).toBe(r.versionId);
    const versions = await programmes.listVersions(active.programmeId);
    expect(versions.map((v) => [v.version, v.isCurrent])).toEqual([[2, true], [1, false]]);
  });
  it("an edit that changes nothing does not create a version", async () => {
    const { programmes, active, v1 } = await seeded();
    const r = await programmes.saveNewVersion(active.programmeId, JSON.parse(JSON.stringify(v1)));
    expect(r).toMatchObject({ version: 1, changed: false });
    expect(await programmes.listVersions(active.programmeId)).toHaveLength(1);
  });
  it("sessions logged on the old version stay readable; the rotation carries on by position", async () => {
    const { programmes, active, v1, trainDay, db, repos } = await seeded();
    const first = await trainDay(); // Upper A done on v1, Lower A planned
    expect(first.dayName).toBe("Upper A");
    const r = await programmes.saveNewVersion(active.programmeId, renameDay(v1, 1, "Legs and hinge"));
    const old = await db.get<{ programme_version_id: string; status: string }>("SELECT programme_version_id, status FROM session WHERE id = ?", [first.sessionId]);
    expect(old).toEqual({ programme_version_id: active.versionId, status: "finished" });
    const sets = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM workout_set WHERE session_id = ? AND deleted_at IS NULL", [first.sessionId]);
    expect(sets!.n).toBe(3);
    const next = (await repos.getNextDay())!;
    expect(next.versionId).toBe(r.versionId);
    expect(next.day.name).toBe("Legs and hinge"); // the day after Upper A, by position
    const vs = await programmes.listVersions(active.programmeId);
    expect(vs.find((v) => v.version === 1)).toMatchObject({ finishedSessions: 1 });
  });
  it("the planned session of the old version is voided and rewritten on the new one", async () => {
    const { programmes, active, v1, trainDay, db, finish } = await seeded();
    await trainDay();
    const planned = await db.get<{ id: string }>("SELECT id FROM session WHERE status = 'planned' AND deleted_at IS NULL");
    expect((await finish.getTargets(planned!.id)).length).toBeGreaterThan(0);
    const r = await programmes.saveNewVersion(active.programmeId, removeExercise(v1, 1, 4)); // drop the calf raise from Lower A
    const rows = await db.all<{ id: string; programme_version_id: string }>("SELECT id, programme_version_id FROM session WHERE status = 'planned' AND deleted_at IS NULL");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.programme_version_id).toBe(r.versionId);
    const targets = await finish.getTargets(rows[0]!.id);
    expect(targets.map((t) => t.nameEn)).not.toContain("Seated Calf Raise");
    expect(targets).toHaveLength(4);
    const voided = await db.get<{ deleted_at: number | null }>("SELECT deleted_at FROM session WHERE id = ?", [planned!.id]);
    expect(voided!.deleted_at).not.toBeNull();
  });
  it("keeps per-lift rep ceilings and goal flags in the new version", async () => {
    const { programmes, active, v1, db } = await seeded();
    const withCeiling = updateExercise(v1, 0, 1, { repCeiling: 12 });
    const r = await programmes.saveNewVersion(active.programmeId, withCeiling);
    const row = await db.get<{ rep_ceiling: number | null }>(
      "SELECT pde.rep_ceiling FROM programme_day_exercise pde JOIN programme_day pd ON pd.id = pde.programme_day_id WHERE pd.programme_version_id = ? AND pd.position = 0 AND pde.position = 1",
      [r.versionId],
    );
    expect(row!.rep_ceiling).toBe(12);
    const again = await programmes.loadDraft(r.versionId);
    expect(again.days[0]!.exercises[0]!.isGoalLift).toBe(true); // bench press stays the goal lift
  });
  it("refuses an invalid draft and changes nothing", async () => {
    const { programmes, active, v1 } = await seeded();
    await expect(programmes.saveNewVersion(active.programmeId, { ...v1, name: "" })).rejects.toBeInstanceOf(DraftInvalid);
    expect(await programmes.listVersions(active.programmeId)).toHaveLength(1);
  });
  it("refuses to switch versions under an open workout", async () => {
    const { programmes, active, v1, workout, gymId, repos } = await seeded();
    const next = (await repos.getNextDay())!;
    await workout.startOrResumeSession(next.day.id, gymId);
    await expect(programmes.saveNewVersion(active.programmeId, updateExercise(v1, 0, 0, { sets: 4 }))).rejects.toBeInstanceOf(SessionInProgress);
    // an unchanged draft is still just a no-op
    expect((await programmes.saveNewVersion(active.programmeId, v1)).changed).toBe(false);
  });
  it("restoring an old version is saving its draft as a new version", async () => {
    const { programmes, active, v1 } = await seeded();
    await programmes.saveNewVersion(active.programmeId, updateExercise(v1, 0, 0, { sets: 5 }));
    const old = await programmes.loadDraft(active.versionId);
    const r = await programmes.saveNewVersion(active.programmeId, old);
    expect(r.version).toBe(3);
    expect(await programmes.loadDraft(r.versionId)).toEqual(v1);
  });
  it("a new programme becomes active, the old one stays", async () => {
    const { programmes, active, db } = await seeded();
    const exs = await programmes.listExercises();
    const squat = exs.find((e) => e.seedKey === "back_squat")!;
    const made = await programmes.createProgramme({ name: "Mine", days: [{ name: "Day 1", exercises: [newExercise(squat.id, { isGoalLift: true })] }] });
    const now = (await programmes.getActive())!;
    expect(now.programmeId).toBe(made.programmeId);
    expect(now.programmeName).toBe("Mine");
    expect(await db.get("SELECT id FROM programme WHERE id = ? AND deleted_at IS NULL", [active.programmeId])).not.toBeNull();
    await programmes.setActiveProgramme(active.programmeId);
    expect((await programmes.getActive())!.programmeId).toBe(active.programmeId);
  });
  it("exposure of a saved version uses the lifter's days per week", async () => {
    const { programmes, repos, v1 } = await seeded();
    expect((await programmes.exposureOf(v1)).every((r) => r.setsPerWeek === null)).toBe(true);
    await repos.setSetting("days_per_week", "4");
    const rows = await programmes.exposureOf(v1);
    expect(rows.find((r) => r.group === "chest")!.setsPerWeek).not.toBeNull();
  });
});

describe("custom exercises", () => {
  it("creates the lifter's own exercise, falls back to the English name in Arabic, and never duplicates", async () => {
    const { programmes } = await freshDb();
    const id = await programmes.createExercise({ nameEn: " Hack Squat ", pattern: "squat", equipment: "machine", setup: "free" });
    expect(await programmes.createExercise({ nameEn: "hack squat", pattern: "squat", equipment: "machine", setup: "free" })).toBe(id);
    const ex = (await programmes.listExercises()).find((e) => e.id === id)!;
    expect(ex).toMatchObject({ nameEn: "Hack Squat", nameAr: "Hack Squat", isCustom: true, seedKey: null });
    const other = await programmes.createExercise({ nameEn: "Hack Squat", pattern: "squat", equipment: "barbell", setup: "free" });
    expect(other).not.toBe(id);
    await expect(programmes.createExercise({ nameEn: "  ", pattern: "squat", equipment: "machine", setup: "free" })).rejects.toThrow(/empty/);
  });
});

describe("switching programme (v0.8.0)", () => {
  async function seeded() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const active = (await ctx.programmes.getActive())!;
    return { ...ctx, ctx, active };
  }
  it("lists every programme, marks the active one, and switching keeps all versions and history", async () => {
    const { programmes, active, db } = await seeded();
    const exs = await programmes.listExercises();
    const squat = exs.find((e) => e.seedKey === "back_squat")!;
    const first = await programmes.listProgrammes();
    expect(first.map((p) => p.programmeId)).toEqual([active.programmeId]);
    expect(first[0]).toMatchObject({ isActive: true, version: 1, versions: 1 });
    const draftB = { name: "Mine", days: [{ name: "Day 1", exercises: [newExercise(squat.id, { isGoalLift: true })] }] };
    const made = await programmes.createProgramme(draftB);
    await programmes.saveNewVersion(made.programmeId, { ...draftB, days: [{ name: "Day 1 edited", exercises: draftB.days[0]!.exercises }] });
    const both = await programmes.listProgrammes();
    expect(both).toHaveLength(2);
    expect(both.find((p) => p.programmeId === made.programmeId)).toMatchObject({ isActive: true, version: 2, versions: 2 });
    expect(both.find((p) => p.programmeId === active.programmeId)!.isActive).toBe(false);
    await programmes.setActiveProgramme(active.programmeId);
    const back = await programmes.listProgrammes();
    expect(back.find((p) => p.programmeId === active.programmeId)!.isActive).toBe(true);
    expect(back.find((p) => p.programmeId === made.programmeId)).toMatchObject({ isActive: false, versions: 2 });
    // The other programme's versions are still all there and the next session is planned from the programme now active.
    expect(await programmes.listVersions(made.programmeId)).toHaveLength(2);
    const planned = await db.get<{ pv: string }>("SELECT programme_version_id AS pv FROM session WHERE status = 'planned' AND deleted_at IS NULL");
    expect(planned!.pv).toBe((await programmes.getActive())!.versionId);
  });
  it("refuses to switch while a workout is open", async () => {
    const { programmes, active, ctx } = await seeded();
    const exs = await programmes.listExercises();
    const made = await programmes.createProgramme({ name: "Other", days: [{ name: "D", exercises: [newExercise(exs[0]!.id)] }] });
    const next = await ctx.repos.getNextDay();
    await ctx.workout.startOrResumeSession(next!.day.id, (await ctx.repos.getActiveGymId())!);
    await expect(programmes.setActiveProgramme(active.programmeId)).rejects.toThrow();
    expect((await programmes.getActive())!.programmeId).toBe(made.programmeId);
  });
});
