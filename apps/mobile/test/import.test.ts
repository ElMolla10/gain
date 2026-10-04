import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isGymLoad, parseImport, toKilograms, type ImportParse } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { defaultGymLoads } from "../src/logic/defaultGym";
import { kgToUnit } from "../src/logic/units";
import { ImportIncomplete, localToEpoch, snapImportedLoad, type MappingChoice, type TitlePreview } from "../src/db/importRepo";
import { freshDb } from "./helpers";

const fx = (n: string) => readFileSync(join(__dirname, "../../../fixtures", n), "utf8");
const hevy = parseImport(fx("hevy-export.csv")); // the lifter's real export
const usableSets = (p: ImportParse) => p.workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length + (e.timed?.length ?? 0), 0), 0); // reps sets + timed rows (a title the library does not know is created counted the way the file recorded it)

/** What a lifter would confirm on screen: take every suggestion; where the title does not say the equipment, choose cable. */
function acceptAll(titles: TitlePreview[]): Record<string, MappingChoice> {
  const out: Record<string, MappingChoice> = {};
  for (const t of titles) {
    const s = t.suggestion;
    out[t.title] = s.kind === "new"
      ? { kind: "new", nameEn: s.nameEn, pattern: s.pattern, equipment: s.equipment ?? "cable", setup: s.setup ?? "free" }
      : { kind: "existing", exerciseId: s.exerciseId };
  }
  return out;
}

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  return { ...ctx, gymId };
}
const count = async (db: Awaited<ReturnType<typeof freshDb>>["db"], sql: string) => Number((await db.get<{ n: number }>(sql))?.n);

describe("import preview (real Hevy export)", () => {
  it("counts what is in the file and what is new, writing nothing", async () => {
    const { db, imports } = await setup();
    const p = await imports.preview(hevy);
    expect(p.source).toBe("hevy");
    expect(p.fileWorkouts).toBe(70);
    expect(p.newWorkouts).toBe(70);
    expect(p.duplicateWorkouts).toBe(0);
    expect(p.newSets).toBe(usableSets(hevy));
    expect(p.titles.reduce((n, t) => n + t.sets, 0)).toBe(p.newSets);
    expect(p.firstDate! <= p.lastDate!).toBe(true);
    expect(await count(db, "SELECT COUNT(*) AS n FROM session WHERE status = 'finished'")).toBe(0);
    expect(await count(db, "SELECT COUNT(*) AS n FROM import_batch")).toBe(0);
  });
  it("suggests an exact library match when there is one, a new exercise otherwise, and asks for equipment when the title has none", async () => {
    const { imports, programmes } = await setup();
    const p = await imports.preview(hevy);
    const by = new Map(p.titles.map((t) => [t.title, t.suggestion]));
    const bench = by.get("Bench Press (Barbell)")!;
    expect(bench.kind).toBe("library");
    const lib = await programmes.listExercises();
    expect(lib.find((e) => bench.kind === "library" && e.id === bench.exerciseId)?.seedKey).toBe("bench_press");
    const pullUp = by.get("Pull Up")!;
    expect(pullUp).toMatchObject({ kind: "new", equipment: null, setup: null });
    const smith = [...by.entries()].filter(([t]) => /smith/i.test(t));
    for (const [, s] of smith) expect(s.kind === "new" ? s.equipment : "machine").not.toBe("barbell");
  });
});

describe("importing", () => {
  it("refuses to start while any exercise is undecided, and writes nothing", async () => {
    const { db, imports, gymId } = await setup();
    const p = await imports.preview(hevy);
    const m = acceptAll(p.titles);
    delete m["Pull Up"];
    await expect(imports.importHistory({ parse: hevy, gymId, mappings: m })).rejects.toBeInstanceOf(ImportIncomplete);
    expect(await count(db, "SELECT COUNT(*) AS n FROM session WHERE import_key IS NOT NULL")).toBe(0);
    const bad = { ...acceptAll(p.titles), "Pull Up": { kind: "new", nameEn: "Pull Up", pattern: "vertical_pull", equipment: undefined as never, setup: "free" } as MappingChoice };
    await expect(imports.importHistory({ parse: hevy, gymId, mappings: bad })).rejects.toBeInstanceOf(ImportIncomplete);
  });
  it("is all or nothing: a bad mapping rolls everything back", async () => {
    const { db, imports, gymId } = await setup();
    const p = await imports.preview(hevy);
    const m = acceptAll(p.titles);
    m["Pull Up"] = { kind: "existing", exerciseId: "does-not-exist" };
    await expect(imports.importHistory({ parse: hevy, gymId, mappings: m })).rejects.toThrow(/Unknown exercise/);
    expect(await count(db, "SELECT COUNT(*) AS n FROM session WHERE import_key IS NOT NULL")).toBe(0);
    expect(await count(db, "SELECT COUNT(*) AS n FROM workout_set")).toBe(0);
    expect(await count(db, "SELECT COUNT(*) AS n FROM import_batch")).toBe(0);
    expect(await count(db, "SELECT COUNT(*) AS n FROM programme WHERE kind = 'import_history'")).toBe(0);
  });
  it("imports every workout and set as finished history, with the file's own times, and nothing else", async () => {
    const { db, imports, gymId } = await setup();
    const p = await imports.preview(hevy);
    const r = await imports.importHistory({ parse: hevy, gymId, mappings: acceptAll(p.titles), fileName: "hevy-export.csv" });
    expect(r).toMatchObject({ workouts: 70, sets: usableSets(hevy), duplicates: 0, empty: 0, skippedSets: 0 });
    expect(await count(db, "SELECT COUNT(*) AS n FROM session WHERE status = 'finished' AND import_key IS NOT NULL")).toBe(70);
    expect(await count(db, "SELECT COUNT(*) AS n FROM workout_set WHERE deleted_at IS NULL")).toBe(usableSets(hevy));
    const w = hevy.workouts[0]!;
    const s = await db.get<{ started_at: number; finished_at: number }>("SELECT started_at, finished_at FROM session WHERE import_key = ?", [w.key]);
    expect(s!.started_at).toBe(localToEpoch(w.startTime));
    expect(s!.finished_at).toBe(localToEpoch(w.endTime!));
    // a drop set keeps its tag
    expect(await count(db, `SELECT COUNT(*) AS n FROM workout_set WHERE tags_json LIKE '%drop%'`)).toBe(22);
  });
  it("importing the same file again adds nothing", async () => {
    const { db, imports, gymId } = await setup();
    const p = await imports.preview(hevy);
    await imports.importHistory({ parse: hevy, gymId, mappings: acceptAll(p.titles) });
    const again = await imports.preview(hevy);
    expect(again).toMatchObject({ newWorkouts: 0, duplicateWorkouts: 70, newSets: 0, titles: [] });
    const r = await imports.importHistory({ parse: hevy, gymId, mappings: {} });
    expect(r).toMatchObject({ batchId: null, workouts: 0, sets: 0, duplicates: 70 });
    expect(await count(db, "SELECT COUNT(*) AS n FROM session WHERE import_key IS NOT NULL")).toBe(70);
    expect(await count(db, "SELECT COUNT(*) AS n FROM import_batch")).toBe(1);
  });
  it("a partly new file imports only the new workouts", async () => {
    const { db, imports, gymId } = await setup();
    const half: ImportParse = { ...hevy, workouts: hevy.workouts.slice(0, 30) };
    await imports.importHistory({ parse: half, gymId, mappings: acceptAll((await imports.preview(half)).titles) });
    const p = await imports.preview(hevy);
    expect(p).toMatchObject({ newWorkouts: 40, duplicateWorkouts: 30 });
    const r = await imports.importHistory({ parse: hevy, gymId, mappings: acceptAll(p.titles) });
    expect(r.workouts).toBe(40);
    expect(await count(db, "SELECT COUNT(*) AS n FROM session WHERE import_key IS NOT NULL")).toBe(70);
  });
  it("remembers the lifter's choices for the next file", async () => {
    const { imports, gymId } = await setup();
    const p = await imports.preview(hevy);
    const m = acceptAll(p.titles);
    await imports.importHistory({ parse: hevy, gymId, mappings: m });
    // a later file with one new workout of a title that was mapped before
    const w0 = hevy.workouts[0]!;
    const next: ImportParse = { ...hevy, workouts: [{ ...w0, startTime: "2027-01-01T10:00:00", endTime: "2027-01-01T11:00:00", key: "hevy|2027-01-01T10:00:00|" + w0.title }] };
    const q = await imports.preview(next);
    expect(q.newWorkouts).toBe(1);
    expect(q.titles.every((t) => t.suggestion.kind === "saved")).toBe(true);
  });
});

describe("history becomes comparable lines", () => {
  it("one line per exercise + gym + setup; the engine proposes from imported history", async () => {
    const { db, imports, gymId, workout, programmes, repos } = await setup();
    const p = await imports.preview(hevy);
    await imports.importHistory({ parse: hevy, gymId, mappings: acceptAll(p.titles) });
    const dup = await db.all("SELECT exercise_id, gym_id, setup, COUNT(*) AS n FROM exercise_line WHERE deleted_at IS NULL GROUP BY exercise_id, gym_id, setup HAVING n > 1");
    expect(dup).toEqual([]);
    const lib = await programmes.listExercises();
    const bench = lib.find((e) => e.seedKey === "bench_press")!;
    const benchWorkouts = hevy.workouts.filter((w) => w.exercises.some((e) => e.title === "Bench Press (Barbell)" && e.sets.length > 0)).length;
    const lineId = await workout.ensureLine(bench.id, gymId, bench.setup);
    const hist = await workout.getHistory({ exerciseId: bench.id, gymId, setup: bench.setup }, lineId);
    expect(hist).toHaveLength(benchWorkouts);
    expect(hist.map((h) => h.performedAt)).toEqual([...hist.map((h) => h.performedAt)].sort());
    const gym = await repos.loadGymFingerprint(gymId);
    const { proposal } = await workout.liveProposal({ exerciseId: bench.id, name: bench.nameEn, equipment: bench.equipment, setup: bench.setup, repMin: 6, repMax: 10, isGoalLift: true, trackEffort: false, sets: 3 }, gym);
    expect(proposal.inputs).toBeDefined();
    expect(JSON.stringify(proposal.inputs)).toContain(String(hist[hist.length - 1]!.sets.filter((s) => !s.warmup)[0]!.load));
  });
  it("a second gym keeps its own line: the same exercise is not mixed across gyms", async () => {
    const { db, imports, gymId, gyms } = await setup();
    const other = await gyms.createGym({ name: "Other gym", loads: [{ equipment: "barbell", increment: 2.5 }] });
    const half: ImportParse = { ...hevy, workouts: hevy.workouts.slice(0, 35) };
    const rest: ImportParse = { ...hevy, workouts: hevy.workouts.slice(35) };
    await imports.importHistory({ parse: half, gymId, mappings: acceptAll((await imports.preview(half)).titles) });
    await imports.importHistory({ parse: rest, gymId: other, mappings: acceptAll((await imports.preview(rest)).titles) });
    const lines = await db.all<{ exercise_id: string; n: number }>("SELECT exercise_id, COUNT(*) AS n FROM exercise_line WHERE deleted_at IS NULL GROUP BY exercise_id HAVING n > 1");
    expect(lines.length).toBeGreaterThan(0);
    const mixed = await count(db, `SELECT COUNT(*) AS n FROM workout_set ws JOIN session s ON s.id = ws.session_id JOIN exercise_line l ON l.id = ws.line_id WHERE l.gym_id <> s.gym_id`);
    expect(mixed).toBe(0);
  });
  it("the hidden history program is never the active program and does not move the rotation", async () => {
    const { imports, gymId, repos } = await setup();
    const before = await repos.getNextDay();
    await imports.importHistory({ parse: hevy, gymId, mappings: acceptAll((await imports.preview(hevy)).titles) });
    const v = await repos.getLatestProgrammeVersion();
    expect(v?.programmeName).not.toBe("Imported history");
    expect((await repos.getNextDay())?.day.id).toBe(before?.day.id);
  });
});

describe("undo", () => {
  it("takes the import back completely and lets the same file be imported again", async () => {
    const { db, imports, gymId } = await setup();
    const r = await imports.importHistory({ parse: hevy, gymId, mappings: acceptAll((await imports.preview(hevy)).titles) });
    expect((await imports.listBatches()).map((b) => [b.id, b.workouts, b.sets])).toEqual([[r.batchId, 70, r.sets]]);
    expect(await imports.undoBatch(r.batchId!)).toEqual({ workouts: 70, sets: r.sets });
    expect(await imports.listBatches()).toEqual([]);
    expect(await count(db, "SELECT COUNT(*) AS n FROM session WHERE import_key IS NOT NULL AND deleted_at IS NULL")).toBe(0);
    expect(await count(db, "SELECT COUNT(*) AS n FROM workout_set WHERE deleted_at IS NULL")).toBe(0);
    const again = await imports.preview(hevy);
    expect(again.newWorkouts).toBe(70);
    const r2 = await imports.importHistory({ parse: hevy, gymId, mappings: acceptAll(again.titles) });
    expect(r2.workouts).toBe(70);
    await expect(imports.undoBatch("nope")).rejects.toThrow(/Unknown import/);
  });
});

describe("pounds (synthetic Strong file)", () => {
  it("is stored in kilograms only after the lifter has said the file is in pounds", async () => {
    const { db, imports, gymId } = await setup();
    const raw = parseImport(fx("strong-synthetic.csv"));
    expect(raw.unit).toBe("unknown");
    const kg = toKilograms(raw, "lb");
    const p = await imports.preview(kg);
    expect(p.source).toBe("strong");
    expect(p.newWorkouts).toBe(2);
    await imports.importHistory({ parse: kg, gymId, mappings: acceptAll(p.titles) });
    const loads = (await db.all<{ load: number }>("SELECT load FROM workout_set ws JOIN exercise e ON e.id = ws.exercise_id WHERE e.name_en LIKE '%Bench%' AND is_warmup = 0 ORDER BY ws.position")).map((r) => r.load);
    expect(loads).toEqual([45.36, 45.36, 36.29]);
    const warm = await count(db, "SELECT COUNT(*) AS n FROM workout_set WHERE is_warmup = 1");
    expect(warm).toBe(1);
  });
  it("sessions with no end time end when they start; nothing is estimated", async () => {
    const { db, imports, gymId } = await setup();
    const raw = parseImport(fx("strong-synthetic.csv"));
    const noEnd: ImportParse = { ...toKilograms(raw, "kg"), workouts: raw.workouts.map((w) => ({ ...w, endTime: null })) };
    await imports.importHistory({ parse: noEnd, gymId, mappings: acceptAll((await imports.preview(noEnd)).titles) });
    expect(await count(db, "SELECT COUNT(*) AS n FROM session WHERE import_key IS NOT NULL AND started_at = finished_at")).toBe(2);
  });
});

describe("local time", () => {
  it("reads wall-clock times in the phone's own time zone", () => {
    expect(localToEpoch("2026-09-29T15:15:00")).toBe(new Date(2026, 8, 29, 15, 15, 0).getTime());
    expect(() => localToEpoch("29 Sep 2026")).toThrow();
  });
});

describe("converted loads land on loads that exist", () => {
  it("snaps conversion noise (135 lb = 61.23 kg) to the lb barbell's rung, and leaves a real off-grid load alone", async () => {
    const { db, imports, gyms } = await setup();
    const lbGym = await gyms.createGym({ name: "Lb gym", loads: defaultGymLoads("lb") });
    const raw = parseImport(fx("strong-synthetic.csv"));
    const kg = toKilograms(raw, "lb");
    const p = await imports.preview(kg);
    await imports.importHistory({ parse: kg, gymId: lbGym, mappings: acceptAll(p.titles) });
    const loads = (await db.all<{ load: number }>("SELECT load FROM workout_set ws JOIN exercise e ON e.id = ws.exercise_id WHERE e.name_en LIKE '%Bench%' AND is_warmup = 0 ORDER BY ws.position")).map((r) => r.load);
    expect(loads.map((l) => kgToUnit(l, "lb"))).toEqual([100, 100, 80]);
    const gym = await gyms.getGym(lbGym);
    const bar = gym!.loads.find((l) => l.equipment === "barbell")!;
    for (const l of loads) expect(isGymLoad(bar, l)).toBe(true);
  });
  it("snapImportedLoad keeps anything further than conversion noise from a rung exactly as written", () => {
    const gym = { gymId: "g", loads: [{ equipment: "barbell" as const, increment: 2.5, min: 20 }] };
    expect(snapImportedLoad(gym, "barbell", "free", 60.01)).toBe(60);
    expect(snapImportedLoad(gym, "barbell", "free", 61.25)).toBe(61.25);
    expect(snapImportedLoad(gym, "cable", "free", 33.3)).toBe(33.3);
  });
});
