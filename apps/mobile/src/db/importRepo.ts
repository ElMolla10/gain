import { preferUsedTwin } from "./library/equivalents";
import { classifyTitle, findSpec, guessPattern, matchLibrary, MAX_METRES, MAX_SECONDS, roundToGymLoad, type EquipmentType, type GymFingerprint, type ImportedExercise, type ImportParse, type ImportSource, type ImportedWorkout, type LibraryEntry, type Measure, type SetupType } from "@gain/engine";
import type { Db, Deps } from "./driver";
import type { FinishRepo } from "./finishRepo";
import type { ProgrammeRepo } from "./programmeRepo";
import type { Repos } from "./repos";
import type { WorkoutRepo } from "./workoutRepo";

/** The lifter's decision for one exported title. */
export type MappingChoice =
  | { kind: "existing"; exerciseId: string }
  | { kind: "new"; nameEn: string; pattern: string; equipment: EquipmentType; setup: SetupType; /** Omitted = counted from the file (seconds / metres when the title only has those). */ measure?: Measure };

/** What the app proposes for a title before the lifter confirms it. Equipment `null` means the title does not say, so the lifter must choose. */
export type Suggestion =
  | { kind: "saved"; exerciseId: string; exerciseName: string }
  | { kind: "library"; exerciseId: string; exerciseName: string }
  | { kind: "new"; nameEn: string; pattern: string; equipment: EquipmentType | null; setup: SetupType | null };

export interface TitlePreview {
  title: string;
  /** New workouts (not already imported) that use this title. */
  workouts: number;
  sets: number;
  /** Rows of this title the suggested exercise cannot count (seconds for a distance exercise, a hold for a reps exercise): they would be skipped. */
  unfit: number;
  suggestion: Suggestion;
}

export interface ImportPreview {
  source: ImportSource;
  fileWorkouts: number;
  newWorkouts: number;
  /** Already in the app from an earlier import (same source, start time and title): skipped. */
  duplicateWorkouts: number;
  /** New workouts without a single usable set: skipped, reported. */
  emptyWorkouts: number;
  newSets: number;
  /** Local dates (YYYY-MM-DD) of the first and last new workout. */
  firstDate: string | null;
  lastDate: string | null;
  titles: TitlePreview[];
  warnings: string[];
}

export interface ImportResult {
  batchId: string | null;
  workouts: number;
  sets: number;
  duplicates: number;
  empty: number;
  skippedSets: number;
  newExercises: number;
}

export interface BatchInfo {
  id: string;
  source: ImportSource;
  fileName: string | null;
  gymId: string;
  gymName: string;
  workouts: number;
  sets: number;
  createdAt: number;
}

export class ImportIncomplete extends Error {
  constructor(public readonly titles: string[]) {
    super(`Every exercise needs a decision before importing; missing: ${titles.slice(0, 5).join(", ")}${titles.length > 5 ? "…" : ""}`);
  }
}

/** Wall-clock time in the file ("2026-09-29T15:15:00") to epoch ms, read in the phone's own time zone (exports carry none). */
export function localToEpoch(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Unrecognised time ${iso}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])).getTime();
}

/**
 * Converted weights carry rounding noise (135 lb is 61.23 kg in the file's conversion, 61.236 kg on a 5 lb barbell). A load within
 * this many kg of one of the standard steps is that load; anything further away is kept exactly as written.
 */
export const IMPORT_SNAP_KG = 0.015;
export function snapImportedLoad(gym: GymFingerprint, equipment: EquipmentType, setup: SetupType, load: number): number {
  const spec = findSpec(gym, equipment);
  if (!spec) return load;
  const r = roundToGymLoad(spec, load, { zero: setup !== "free" });
  return r.load !== null && Math.abs(r.load - load) <= IMPORT_SNAP_KG ? r.load : load;
}

const usable = (s: { load: number; reps: number }) => Number.isFinite(s.load) && s.load >= 0 && Number.isInteger(s.reps) && s.reps >= 1;

type Timed = NonNullable<ImportedExercise["timed"]>[number];
const usableTimed = (t: Timed, measure: "time" | "distance"): boolean => {
  const q = measure === "time" ? t.durationS : t.distanceM;
  return Number.isFinite(t.load) && t.load >= 0 && q !== null && Number.isFinite(q) && q > 0 && q <= (measure === "time" ? MAX_SECONDS : MAX_METRES);
};
/** Rows that could be imported under SOME exercise: reps sets, or rows with seconds / metres. Whether they are depends on how the exercise is counted. */
const hasAnyRows = (e: ImportedExercise): boolean => e.sets.some(usable) || (e.timed ?? []).length > 0;
/** The rows of one exercise that are importable when it is counted in `measure`; `dropped` = rows of the file that do not fit that measure. */
export function rowsFor(e: ImportedExercise, measure: Measure): { sets: number; dropped: number } {
  if (measure === "reps") return { sets: e.sets.filter(usable).length, dropped: e.sets.filter((x) => !usable(x)).length + (e.timed ?? []).length };
  const timed = e.timed ?? [];
  const ok = timed.filter((t) => usableTimed(t, measure)).length;
  return { sets: ok, dropped: timed.length - ok + e.sets.length };
}
/** How a NEW exercise with this title is counted: seconds when the file only has durations for it, metres when it only has distances, else reps. */
export function inferMeasure(parse: ImportParse, title: string): Measure {
  let reps = 0, secs = 0, metres = 0;
  for (const w of parse.workouts) for (const e of w.exercises) {
    if (e.title !== title) continue;
    reps += e.sets.filter(usable).length;
    for (const t of e.timed ?? []) {
      if (t.distanceM !== null) metres++;
      else if (t.durationS !== null) secs++;
    }
  }
  if (reps > 0 || secs + metres === 0) return "reps";
  return metres > secs ? "distance" : "time";
}

/**
 * Imports other apps' history as finished sessions. The data is the lifter's, read as written: nothing is estimated or filled in.
 * Weights must already be in kg (engine `toKilograms`). History lands on one line per exercise + gym + setup, the same lines the
 * engine reads for suggestions, so imported sessions and new ones are comparable.
 */
export function createImportRepo(db: Db, deps: Deps, repos: Repos, workout: WorkoutRepo, programmes: ProgrammeRepo, finish: FinishRepo) {
  const { newId, now } = deps;

  async function existingKeys(keys: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    for (let i = 0; i < keys.length; i += 400) {
      const chunk = keys.slice(i, i + 400);
      const rows = await db.all<{ import_key: string }>(`SELECT import_key FROM session WHERE deleted_at IS NULL AND import_key IN (${chunk.map(() => "?").join(",")})`, chunk);
      for (const r of rows) found.add(r.import_key);
    }
    return found;
  }

  /** Splits the file's workouts into new, duplicate and empty. */
  async function triage(parse: ImportParse) {
    const have = await existingKeys(parse.workouts.map((w) => w.key));
    const seen = new Set<string>();
    const fresh: ImportedWorkout[] = [];
    let duplicates = 0;
    let empty = 0;
    for (const w of parse.workouts) {
      if (have.has(w.key) || seen.has(w.key)) {
        duplicates++;
        continue;
      }
      seen.add(w.key);
      if (!w.exercises.some(hasAnyRows)) {
        empty++;
        continue;
      }
      fresh.push(w);
    }
    return { fresh, duplicates, empty };
  }

  async function savedMappings(source: ImportSource): Promise<Map<string, { exerciseId: string; name: string }>> {
    const rows = await db.all<{ source_title: string; exercise_id: string; name_en: string }>(
      `SELECT m.source_title, m.exercise_id, e.name_en FROM import_mapping m JOIN exercise e ON e.id = m.exercise_id
       WHERE m.source = ? AND m.deleted_at IS NULL AND e.deleted_at IS NULL`,
      [source],
    );
    return new Map(rows.map((r) => [r.source_title, { exerciseId: r.exercise_id, name: r.name_en }]));
  }

  /** What the file contains and what would happen, before anything is written. Saved choice first, then an exact library match, else a new exercise. */
  async function preview(parse: ImportParse): Promise<ImportPreview> {
    const { fresh, duplicates, empty } = await triage(parse);
    const all = await programmes.listExercises();
    const library: LibraryEntry[] = all.map((e) => ({ id: e.id, nameEn: e.nameEn, equipment: e.equipment, setup: e.setup }));
    const measureById = new Map(all.map((e) => [e.id, e.measure]));
    const saved = await savedMappings(parse.source);
    const twins = await twinChoices(all);
    const byTitle = new Map<string, TitlePreview>();
    let newSets = 0;
    for (const w of fresh) {
      for (const e of w.exercises) {
        let t = byTitle.get(e.title);
        const sugg = t?.suggestion ?? suggest(e.title, saved, library, twins);
        const measure: Measure = sugg.kind === "new" ? inferMeasure(parse, e.title) : measureById.get(sugg.exerciseId) ?? "reps";
        const n = rowsFor(e, measure).sets;
        const unfit = rowsFor(e, measure).dropped;
        if (n === 0 && !hasAnyRows(e)) continue; // nothing in it for anyone
        if (n === 0 && unfit === 0) continue;
        newSets += n;
        if (!t) {
          t = { title: e.title, workouts: 0, sets: 0, unfit: 0, suggestion: sugg };
          byTitle.set(e.title, t);
        }
        if (n > 0) t.workouts++;
        t.sets += n;
        t.unfit += unfit;
      }
    }
    const dates = fresh.map((w) => w.startTime.slice(0, 10)).sort();
    return {
      source: parse.source,
      fileWorkouts: parse.workouts.length,
      newWorkouts: fresh.length,
      duplicateWorkouts: duplicates,
      emptyWorkouts: empty,
      newSets,
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      titles: [...byTitle.values()].sort((a, b) => b.sets - a.sets || a.title.localeCompare(b.title)),
      warnings: parse.warnings,
    };
  }

  /**
   * For library rows that are the same movement under two keys (see library/equivalents.ts): row id -> the twin row the lifter already uses.
   * Only rows that have no use of their own and whose twin has some appear here. Nothing is written.
   */
  async function twinChoices(all: { id: string; seedKey: string | null; nameEn: string }[]): Promise<Map<string, { id: string; nameEn: string }>> {
    const used = await db.all<{ id: string; n: number }>(
      `SELECT exercise_id AS id, COUNT(*) AS n FROM (
         SELECT exercise_id FROM workout_set WHERE deleted_at IS NULL
         UNION ALL SELECT exercise_id FROM exercise_line WHERE deleted_at IS NULL
         UNION ALL SELECT exercise_id FROM programme_day_exercise WHERE deleted_at IS NULL
       ) GROUP BY exercise_id`,
    );
    const useById = new Map(used.map((u) => [u.id, u.n]));
    const byKey = new Map(all.filter((e) => e.seedKey).map((e) => [e.seedKey as string, e]));
    const usageByKey = new Map<string, number>();
    for (const [k, e] of byKey) usageByKey.set(k, useById.get(e.id) ?? 0);
    const out = new Map<string, { id: string; nameEn: string }>();
    for (const [k, e] of byKey) {
      const pick = preferUsedTwin(k, usageByKey);
      const target = byKey.get(pick);
      if (pick !== k && target) out.set(e.id, { id: target.id, nameEn: target.nameEn });
    }
    return out;
  }

  function suggest(title: string, saved: Map<string, { exerciseId: string; name: string }>, library: LibraryEntry[], twins: Map<string, { id: string; nameEn: string }>): Suggestion {
    const s = saved.get(title);
    if (s) return { kind: "saved", exerciseId: s.exerciseId, exerciseName: s.name };
    const m = matchLibrary(title, library);
    if (m) {
      const t = twins.get(m.id);
      return t ? { kind: "library", exerciseId: t.id, exerciseName: t.nameEn } : { kind: "library", exerciseId: m.id, exerciseName: m.nameEn };
    }
    const c = classifyTitle(title);
    return { kind: "new", nameEn: title.trim(), pattern: guessPattern(title), equipment: c.equipment, setup: c.setup };
  }

  /** The hidden program day that imported sessions hang on (sessions need one). Created on first import. */
  async function ensureHistoryDay(): Promise<{ versionId: string; dayId: string }> {
    const v = await db.get<{ vid: string }>(
      `SELECT pv.id AS vid FROM programme_version pv JOIN programme p ON p.id = pv.programme_id
       WHERE p.kind = 'import_history' AND p.deleted_at IS NULL AND pv.deleted_at IS NULL ORDER BY pv.version DESC LIMIT 1`,
    );
    const t = now();
    let versionId = v?.vid;
    if (!versionId) {
      const programmeId = newId();
      versionId = newId();
      await db.run("INSERT INTO programme (id, name, is_sample, kind, created_at, updated_at) VALUES (?, 'Imported history', 0, 'import_history', ?, ?)", [programmeId, t, t]);
      await db.run("INSERT INTO programme_version (id, programme_id, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)", [versionId, programmeId, t, t]);
    }
    let day = await db.get<{ id: string }>("SELECT id FROM programme_day WHERE programme_version_id = ? AND deleted_at IS NULL ORDER BY position LIMIT 1", [versionId]);
    if (!day) {
      day = { id: newId() };
      await db.run("INSERT INTO programme_day (id, programme_version_id, name, position, created_at, updated_at) VALUES (?, ?, 'Imported workouts', 0, ?, ?)", [day.id, versionId, t, t]);
    }
    return { versionId, dayId: day.id };
  }

  /**
   * Writes the new workouts as finished sessions at `gymId`, all or nothing. `mappings` must decide every title used by a new workout.
   * Re-running the same file adds nothing. Decisions are remembered for the next file.
   */
  async function importHistory(input: { parse: ImportParse; gymId: string; mappings: Record<string, MappingChoice>; fileName?: string }): Promise<ImportResult> {
    const { parse, gymId, mappings } = input;
    const gym = await db.get<{ id: string }>("SELECT id FROM gym WHERE id = ? AND deleted_at IS NULL", [gymId]);
    if (!gym) throw new Error("Unknown gym");
    const { fresh, duplicates, empty } = await triage(parse);
    const need = new Set<string>();
    for (const w of fresh) for (const e of w.exercises) if (hasAnyRows(e)) need.add(e.title);
    const missing = [...need].filter((t) => !mappings[t]);
    if (missing.length > 0) throw new ImportIncomplete(missing);
    for (const t of need) {
      const c = mappings[t]!;
      if (c.kind === "new" && (c.nameEn.trim() === "" || !c.equipment || !c.setup)) throw new ImportIncomplete([t]);
    }
    if (fresh.length === 0) return { batchId: null, workouts: 0, sets: 0, duplicates, empty, skippedSets: 0, newExercises: 0 };

    return db.transaction(async () => {
      const exerciseOf = new Map<string, { id: string; setup: SetupType; equipment: EquipmentType; measure: Measure }>();
      const gymLoads = await repos.loadGymFingerprint(gymId);
      let newExercises = 0;
      for (const title of need) {
        const c = mappings[title]!;
        let exerciseId: string;
        if (c.kind === "existing") {
          exerciseId = c.exerciseId;
        } else {
          const before = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercise");
          exerciseId = await programmes.createExercise({ nameEn: c.nameEn, pattern: c.pattern, equipment: c.equipment, setup: c.setup, measure: c.measure ?? inferMeasure(parse, title) });
          const after = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercise");
          if (Number(after?.n) > Number(before?.n)) newExercises++;
        }
        const ex = await db.get<{ id: string; setup: SetupType; equipment: EquipmentType; measure: Measure }>("SELECT id, setup, equipment, measure FROM exercise WHERE id = ? AND deleted_at IS NULL", [exerciseId]);
        if (!ex) throw new Error(`Unknown exercise for "${title}"`);
        exerciseOf.set(title, ex);
      }
      const { versionId, dayId } = await ensureHistoryDay();
      const batchId = newId();
      const t0 = now();
      await db.run("INSERT INTO import_batch (id, source, file_name, gym_id, workouts, sets, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?)", [batchId, parse.source, input.fileName ?? null, gymId, t0, t0]);

      let sets = 0;
      let skippedSets = 0;
      let workouts = 0;
      let emptyNow = empty;
      for (const w of fresh) {
        // What each exercise of this workout contributes under the way its exercise is counted; a workout with nothing left is skipped, not stored empty.
        const plan = w.exercises.map((e) => {
          const ex = exerciseOf.get(e.title);
          return { e, ex, rows: ex ? rowsFor(e, ex.measure) : { sets: 0, dropped: 0 } };
        });
        if (plan.every((x) => x.rows.sets === 0)) {
          emptyNow++;
          continue;
        }
        workouts++;
        const sessionId = newId();
        const start = localToEpoch(w.startTime);
        const end = w.endTime ? Math.max(start, localToEpoch(w.endTime)) : start; // no end time in the file: the session ends when it starts, nothing is estimated
        await db.run(
          `INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, started_at, finished_at, import_key, import_batch_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'finished', ?, ?, ?, ?, ?, ?)`,
          [sessionId, versionId, dayId, gymId, start, end, w.key, batchId, t0, t0],
        );
        const position = new Map<string, number>();
        for (const { e, ex, rows } of plan) {
          if (!ex) continue; // an exercise with no usable set was not mapped
          skippedSets += rows.dropped;
          if (rows.sets === 0) continue;
          const lineId = await workout.ensureLine(ex.id, gymId, ex.setup);
          if (ex.measure === "reps") {
            for (const s of e.sets) {
              if (!usable(s)) continue;
              const pos = (position.get(ex.id) ?? 0) + 1;
              position.set(ex.id, pos);
              await db.run(
                `INSERT INTO workout_set (id, session_id, exercise_id, line_id, position, load, reps, rir, is_warmup, tags_json, outlier_status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', ?, ?)`,
                [newId(), sessionId, ex.id, lineId, pos, snapImportedLoad(gymLoads, ex.equipment, ex.setup, s.load), s.reps, s.rir ?? null, s.warmup ? 1 : 0, JSON.stringify(s.tags ?? []), t0, t0],
              );
              sets++;
            }
          } else {
            for (const s of e.timed ?? []) {
              if (!usableTimed(s, ex.measure)) continue;
              const pos = (position.get(ex.id) ?? 0) + 1;
              position.set(ex.id, pos);
              await db.run(
                `INSERT INTO workout_set (id, session_id, exercise_id, line_id, position, load, reps, duration_s, distance_m, rir, is_warmup, tags_json, outlier_status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NULL, ?, ?, 'none', ?, ?)`,
                [newId(), sessionId, ex.id, lineId, pos, snapImportedLoad(gymLoads, ex.equipment, ex.setup, s.load), ex.measure === "time" ? Math.round(s.durationS!) : null, ex.measure === "distance" ? s.distanceM! : null, s.warmup ? 1 : 0, JSON.stringify(s.tags ?? []), t0, t0],
              );
              sets++;
            }
          }
        }
      }
      await db.run("UPDATE import_batch SET workouts = ?, sets = ?, updated_at = ? WHERE id = ?", [workouts, sets, deps.now(), batchId]);
      for (const title of need) {
        const ex = exerciseOf.get(title)!;
        await db.run(
          `INSERT INTO import_mapping (id, source, source_title, exercise_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(source, source_title) WHERE deleted_at IS NULL DO UPDATE SET exercise_id = excluded.exercise_id, updated_at = excluded.updated_at`,
          [newId(), parse.source, title, ex.id, t0, t0],
        );
      }
      return { batchId, workouts, sets, duplicates, empty: emptyNow, skippedSets, newExercises };
    }).then(async (r) => {
      await resync();
      return r;
    });
  }

  /** Planned sessions were proposed from the history that existed then; imported history can change them. */
  async function resync(): Promise<void> {
    const active = await repos.getActiveGymId();
    if (active) await finish.refreshPlannedSessions(active);
  }

  async function listBatches(): Promise<BatchInfo[]> {
    const rows = await db.all<{ id: string; source: ImportSource; file_name: string | null; gym_id: string; gym_name: string; workouts: number; sets: number; created_at: number }>(
      `SELECT b.id, b.source, b.file_name, b.gym_id, g.name AS gym_name, b.workouts, b.sets, b.created_at
       FROM import_batch b JOIN gym g ON g.id = b.gym_id WHERE b.deleted_at IS NULL ORDER BY b.created_at DESC, b.rowid DESC`,
    );
    return rows.map((r) => ({ id: r.id, source: r.source, fileName: r.file_name, gymId: r.gym_id, gymName: r.gym_name, workouts: r.workouts, sets: r.sets, createdAt: r.created_at }));
  }

  /**
   * Takes one import back: its sessions and sets are soft-deleted, so the history lines return to what they were and the same file
   * can be imported again. Exercises and lines created by the import stay (they hold no history once the sessions are gone).
   */
  async function undoBatch(batchId: string): Promise<{ workouts: number; sets: number }> {
    const r = await db.transaction(async () => {
      const b = await db.get<{ id: string }>("SELECT id FROM import_batch WHERE id = ? AND deleted_at IS NULL", [batchId]);
      if (!b) throw new Error("Unknown import");
      const t = now();
      const sets = await db.run(
        `UPDATE workout_set SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL AND session_id IN (SELECT id FROM session WHERE import_batch_id = ?)`,
        [t, t, batchId],
      );
      const sessions = await db.run("UPDATE session SET deleted_at = ?, updated_at = ? WHERE import_batch_id = ? AND deleted_at IS NULL", [t, t, batchId]);
      await db.run("UPDATE import_batch SET deleted_at = ?, updated_at = ? WHERE id = ?", [t, t, batchId]);
      return { workouts: sessions.changes, sets: sets.changes };
    });
    await resync();
    return r;
  }

  return { preview, importHistory, listBatches, undoBatch };
}
export type ImportRepo = ReturnType<typeof createImportRepo>;
