import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseImport } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { BackupInvalid, buildCsv, csvTime, parseBackup } from "../src/logic/backup";
import { RestoreFailed } from "../src/db/dataRepo";
import type { MappingChoice, TitlePreview } from "../src/db/importRepo";
import { freshDb } from "./helpers";

const DAY = 86_400_000;
const fx = (n: string) => readFileSync(join(__dirname, "../../../fixtures", n), "utf8");

function acceptAll(titles: TitlePreview[]): Record<string, MappingChoice> {
  const out: Record<string, MappingChoice> = {};
  for (const t of titles) {
    const s = t.suggestion;
    out[t.title] = s.kind === "new" ? { kind: "new", nameEn: s.nameEn, pattern: s.pattern, equipment: s.equipment ?? "cable", setup: s.setup ?? "free" } : { kind: "existing", exerciseId: s.exerciseId };
  }
  return out;
}

/** A phone with history: imported Hevy workouts, own sessions with warm-ups, an accepted target, a declined jump, a goal. */
async function populated() {
  const c = await freshDb();
  await c.repos.seedIfNeeded();
  const gymId = (await c.repos.getActiveGymId())!;
  const gym = await c.repos.loadGymFingerprint(gymId);
  const parse = parseImport(fx("hevy-export.csv"));
  const prev = await c.imports.preview(parse);
  await c.imports.importHistory({ parse, gymId, mappings: acceptAll(prev.titles) });
  c.deps.tick(400 * DAY);
  let last = "";
  for (let r = 0; r < 3; r++) {
    for (let d = 0; d < 4; d++) {
      const next = (await c.repos.getNextDay())!;
      const exs = await c.repos.listDayExercises(next.day.id);
      const { id } = await c.workout.startOrResumeSession(next.day.id, gymId);
      const ex = exs[0]!;
      const ctx = { gym, equipment: ex.equipment, setup: ex.setup };
      await c.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 30, reps: 10, warmup: true }, ctx);
      for (const reps of [10, 10, 9]) await c.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 60, reps, rir: 2 }, ctx);
      c.deps.tick(1000);
      await c.workout.finishSession(id);
      const w = await c.finish.writeNextSessionTargets(id);
      last = w!.sessionId;
      c.deps.tick(DAY);
    }
  }
  const targets = (await c.finish.getTargets(last)).filter((t) => t.currency !== "none" && t.load !== null);
  if (targets[0]) await c.finish.acceptTarget(targets[0].id);
  if (targets[1]) await c.finish.rejectTarget(targets[1].id);
  return { ...c, gymId, last };
}

async function dumpAll(db: Awaited<ReturnType<typeof freshDb>>["db"]) {
  const names = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((r) => r.name);
  const out: Record<string, unknown[]> = {};
  for (const n of names) out[n] = await db.all(`SELECT * FROM ${n} ORDER BY id`).catch(() => db.all(`SELECT * FROM ${n}`));
  return out;
}

describe("export, wipe, restore (Step 12)", () => {
  it("export then restore into an empty phone gives back every row, sessions and targets included", async () => {
    const a = await populated();
    const json = await a.data.exportJson();
    const before = await a.data.counts();
    expect(before.sessions).toBeGreaterThan(70);

    const b = await freshDb(); // a new phone, first run
    const r = await b.data.restoreJson(json);
    expect(r.sessions).toBe(before.sessions);
    expect(await b.data.counts()).toEqual(before);
    expect(await dumpAll(b.db)).toEqual(await dumpAll(a.db));

    // And it behaves the same: history, targets, decisions, rejection memory.
    expect((await b.history.listSessions(500)).map((s) => s.id)).toEqual((await a.history.listSessions(500)).map((s) => s.id));
    expect(await b.finish.getTargets(a.last)).toEqual(await a.finish.getTargets(a.last));
    expect(await b.decisions.count()).toBe(await a.decisions.count());
    expect(await b.rejections.list()).toEqual(await a.rejections.list());
  });

  it("export, wipe the same phone, restore: back to the same state", async () => {
    const a = await populated();
    const json = await a.data.exportJson();
    const snapshot = await dumpAll(a.db);
    await a.data.deleteAll();
    expect((await a.data.counts()).sets).toBe(0);
    await a.data.restoreJson(json);
    expect(await dumpAll(a.db)).toEqual(snapshot);
  });

  it("delete everything empties every table and returns the app to first run", async () => {
    const a = await populated();
    await a.data.deleteAll();
    for (const [name, rows] of Object.entries(await dumpAll(a.db))) expect(rows, name).toEqual([]);
    expect(await a.onboarding.getState()).toBeNull();
    expect(await a.repos.getActiveGymId()).toBeNull();
    // First run works again: the app seeds itself and has no history.
    await a.repos.seedIfNeeded();
    expect(await a.repos.getActiveGymId()).not.toBeNull();
    expect((await a.data.counts()).sessions).toBe(0);
    expect(await a.history.listSessions()).toEqual([]);
  });

  it("a bad backup changes nothing", async () => {
    const a = await populated();
    const snapshot = await dumpAll(a.db);
    const good = JSON.parse(await a.data.exportJson());
    const cases: [string, string, unknown][] = [
      ["not json", "{oops", BackupInvalid],
      ["another app", JSON.stringify({ ...good, app: "other" }), BackupInvalid],
      ["newer schema", JSON.stringify({ ...good, schemaVersion: 999 }), BackupInvalid],
      ["unknown table", JSON.stringify({ ...good, tables: { ...good.tables, evil: [{ id: "x" }] } }), BackupInvalid],
      ["unknown column", JSON.stringify({ ...good, tables: { ...good.tables, gym: [{ id: "x", nope: 1 }] } }), BackupInvalid],
      ["object value", JSON.stringify({ ...good, tables: { ...good.tables, gym: [{ id: { a: 1 } }] } }), BackupInvalid],
      ["dangling reference", JSON.stringify({ ...good, tables: { ...good.tables, session: good.tables.session.slice(0, 1) } }), RestoreFailed],
    ];
    for (const [label, text, err] of cases) {
      await expect(a.data.restoreJson(text), label).rejects.toBeInstanceOf(err as never);
      expect(await dumpAll(a.db), label).toEqual(snapshot);
    }
    // Foreign keys are back on after a failed restore.
    const fk = await a.db.get<{ foreign_keys: number }>("PRAGMA foreign_keys");
    expect(Number(fk!.foreign_keys)).toBe(1);
  });

  it("inspect reports counts without writing; an older-schema backup is accepted when columns exist", async () => {
    const a = await populated();
    const json = await a.data.exportJson();
    const i = await a.data.inspectBackup(json);
    expect(i.counts.sessions).toBe((await a.data.counts()).sessions);
    const old = { ...JSON.parse(json), schemaVersion: 1 };
    expect(parseBackup(JSON.stringify(old), 5).schemaVersion).toBe(1);
  });
});

describe("CSV export (Hevy columns)", () => {
  it("reads back through GAIN's own Hevy parser: same workouts, sets, loads, reps, warm-ups, effort", async () => {
    const a = await populated();
    const csv = await a.data.exportCsv();
    const parsed = parseImport(csv);
    expect(parsed.source).toBe("hevy");
    expect(parsed.unit).toBe("kg");
    const sessions = await a.data.counts();
    expect(parsed.workouts).toHaveLength(sessions.sessions);
    const csvSets = parsed.workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets));
    const csvTimed = parsed.workouts.flatMap((w) => w.exercises.flatMap((e) => e.timed ?? []));
    expect(csvSets.length + csvTimed.length).toBe(sessions.sets); // holds and carries are written with an empty reps cell and read back as timed
    expect(csvTimed.length).toBeGreaterThan(0);
    expect(csvSets.filter((s) => s.warmup).length).toBeGreaterThanOrEqual(12);
    const own = csvSets.find((s) => s.load === 60 && s.reps === 9)!;
    expect(own.rir).toBe(2); // RIR 2 -> RPE 8 -> RIR 2
    expect(own.warmup).toBeFalsy();
  });

  it("re-imports into an empty phone (dedupe key is the start time, nothing doubles on a second import)", async () => {
    const a = await populated();
    const csv = await a.data.exportCsv();
    const b = await freshDb();
    await b.repos.seedIfNeeded();
    const gymId = (await b.repos.getActiveGymId())!;
    const parse = parseImport(csv);
    const prev = await b.imports.preview(parse);
    expect(prev.newWorkouts).toBe((await a.data.counts()).sessions);
    await b.imports.importHistory({ parse, gymId, mappings: acceptAll(prev.titles) });
    expect((await b.data.counts()).sets).toBe((await a.data.counts()).sets);
    const again = await b.imports.preview(parse);
    expect(again.newWorkouts).toBe(0);
  });

  it("quotes commas and quotes, guards formula cells, and writes local time Excel can read", () => {
    const start = new Date(2026, 8, 29, 15, 15).getTime();
    expect(csvTime(start)).toBe("Sep 29, 2026, 3:15 PM");
    expect(csvTime(new Date(2026, 0, 1, 0, 5).getTime())).toBe("Jan 1, 2026, 12:05 AM");
    const csv = buildCsv([{ title: 'Pull, "heavy"', startMs: start, endMs: start + 3600_000, exerciseTitle: "=SUM(A1)", setIndex: 0, warmup: false, drop: true, weightKg: 22.5, reps: 8, rir: null }]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain('"title","start_time"');
    expect(lines[1]).toContain('"Pull, ""heavy"""');
    expect(lines[1]).toContain(`"'=SUM(A1)"`);
    expect(lines[1]).toContain('"dropset",22.5,8');
    const back = parseImport(csv);
    expect(back.workouts[0]!.title).toBe('Pull, "heavy"');
    expect(back.workouts[0]!.exercises[0]!.sets[0]).toMatchObject({ load: 22.5, reps: 8, tags: ["drop"] });
  });

  it("an empty phone exports a header and nothing else", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    const csv = await c.data.exportCsv();
    expect(csv.trim().split("\n")).toHaveLength(1);
  });
});
