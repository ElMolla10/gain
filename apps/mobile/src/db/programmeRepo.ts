import type { EquipmentType, GymLoadSpec, Measure, SetupType } from "@gain/engine";
import { validateGym } from "../logic/gymInput";
import { DEFAULT_TIMED_RANGE } from "./library/measures";
import { computeExposure, type ExposureRow } from "../logic/exposure";
import { draftFingerprint, normTopSets, validateDraft, type DraftProblem, type ProgrammeDraft } from "../logic/programmeDraft";
import type { Db, Deps } from "./driver";
import type { FinishRepo } from "./finishRepo";
import type { Repos } from "./repos";

export class DraftInvalid extends Error {
  constructor(public readonly problems: DraftProblem[]) {
    super(`Program is not valid: ${problems.map((p) => p.code).join(", ")}`);
  }
}

/** An open workout belongs to the version it was started on; switching versions under it would orphan it. */
export class SessionInProgress extends Error {
  constructor() {
    super("Finish your open workout before changing the program");
  }
}

export interface LibraryExercise {
  id: string;
  seedKey: string | null;
  nameEn: string;
  nameAr: string;
  aliasesAr: string[];
  pattern: string;
  equipment: EquipmentType;
  setup: SetupType;
  /** How it is counted: reps (default), time (seconds held) or distance (metres carried). */
  measure: Measure;
  isCustom: boolean;
}

export interface VersionInfo {
  versionId: string;
  version: number;
  createdAt: number;
  isCurrent: boolean;
  days: number;
  exercises: number;
  /** Sessions (planned, in progress or finished) written on this version. Finished ones stay readable forever. */
  sessions: number;
  finishedSessions: number;
}

export interface ProgrammeInfo {
  programmeId: string;
  name: string;
  isSample: boolean;
  isActive: boolean;
  /** Latest saved version number (older versions stay in the program's history). */
  version: number;
  versions: number;
  days: number;
  finishedSessions: number;
  createdAt: number;
}

export interface NewExerciseInput {
  nameEn: string;
  nameAr?: string;
  aliasesAr?: string[];
  pattern: string;
  equipment: EquipmentType;
  setup: SetupType;
  /** Omitted = reps. */
  measure?: Measure;
}

/** A change of how an exercise is counted is refused once sets were logged for it: old sets would change meaning. */
export class MeasureLocked extends Error {
  constructor() {
    super("This exercise already has logged sets, so it keeps the way it is counted");
  }
}

/**
 * Program editor data layer. Editing never rewrites a saved version: "save" writes a NEW version (copy + changes).
 * Old versions keep their days and exercises, so sessions logged on them stay readable.
 */
export function createProgrammeRepo(db: Db, deps: Deps, repos: Repos, finish: FinishRepo) {
  const { newId, now } = deps;

  // ---- exercise library -----------------------------------------------------------------------------------
  async function listExercises(): Promise<LibraryExercise[]> {
    const rows = await db.all<{ id: string; seed_key: string | null; name_en: string; name_ar: string; aliases_ar_json: string; pattern: string; equipment: EquipmentType; setup: SetupType; measure: Measure; is_sample: number }>(
      "SELECT id, seed_key, name_en, name_ar, aliases_ar_json, pattern, equipment, setup, measure, is_sample FROM exercise WHERE deleted_at IS NULL ORDER BY name_en",
    );
    return rows.map((r) => ({
      id: r.id,
      seedKey: r.seed_key,
      nameEn: r.name_en,
      nameAr: r.name_ar,
      aliasesAr: JSON.parse(r.aliases_ar_json) as string[],
      pattern: r.pattern,
      equipment: r.equipment,
      setup: r.setup,
      measure: r.measure,
      isCustom: r.seed_key === null,
    }));
  }

  /** The lifter's own exercise. An empty Arabic name falls back to the English one (never a made-up translation). */
  async function createExercise(input: NewExerciseInput): Promise<string> {
    const nameEn = input.nameEn.trim();
    if (nameEn === "") throw new Error("Exercise name is empty");
    const measure = input.measure ?? "reps";
    const dup = await db.get<{ id: string }>("SELECT id FROM exercise WHERE lower(name_en) = lower(?) AND equipment = ? AND setup = ? AND measure = ? AND deleted_at IS NULL", [nameEn, input.equipment, input.setup, measure]);
    if (dup) return dup.id; // the same movement is never created twice
    const id = newId();
    const t = now();
    await db.run(
      `INSERT INTO exercise (id, seed_key, name_en, name_ar, aliases_ar_json, pattern, equipment, setup, measure, is_sample, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, nameEn, (input.nameAr ?? "").trim() || nameEn, JSON.stringify(input.aliasesAr ?? []), input.pattern, input.equipment, input.setup, measure, t, t],
    );
    return id;
  }

  /**
   * Counts an exercise in reps, seconds or metres. Refused once any set was logged for it (the numbers already stored would change meaning).
   * Program slots that use it get the new unit's starting range (a reps range such as 8-12 would read as 8-12 seconds), in every saved
   * version, so the Today list and the next target stay consistent; sessions already finished are untouched. Planned targets are rewritten.
   */
  async function setExerciseMeasure(exerciseId: string, measure: Measure): Promise<{ changed: boolean; slots: number }> {
    const ex = await db.get<{ measure: Measure }>("SELECT measure FROM exercise WHERE id = ? AND deleted_at IS NULL", [exerciseId]);
    if (!ex) throw new Error("Unknown exercise");
    if (ex.measure === measure) return { changed: false, slots: 0 };
    const logged = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM workout_set WHERE exercise_id = ? AND deleted_at IS NULL", [exerciseId]);
    if (Number(logged?.n) > 0) throw new MeasureLocked();
    const range = measure === "reps" ? { min: 6, max: 10, sets: null } : DEFAULT_TIMED_RANGE[measure];
    const slots = await db.transaction(async () => {
      const t = now();
      await db.run("UPDATE exercise SET measure = ?, updated_at = ? WHERE id = ?", [measure, t, exerciseId]);
      const r = await db.run(
        "UPDATE programme_day_exercise SET rep_min = ?, rep_max = ?, rep_ceiling = NULL, top_sets = NULL, track_effort = 0, updated_at = ? WHERE exercise_id = ? AND deleted_at IS NULL",
        [range.min, range.max, t, exerciseId],
      );
      return r.changes;
    });
    // Planned sessions hold targets written under the old unit: drop and rewrite them.
    const gymId = await repos.getActiveGymId();
    if (gymId) await finish.refreshPlannedSessions(gymId);
    return { changed: true, slots };
  }

  /**
   * Sets (spec) or clears (null) the weights that exist for ONE exercise, in kilograms. Changes no logged set and no earlier decision; planned
   * sessions hold targets written on the old grid, so they are rewritten (kept choices that are still weights on the new grid stay).
   */
  async function setExerciseLoads(exerciseId: string, spec: GymLoadSpec | null): Promise<void> {
    const cur = await repos.getExerciseLoads(exerciseId);
    if (!cur) throw new Error("Unknown exercise");
    if (spec && spec.equipment !== cur.equipment) throw new Error("Weights do not match the exercise's equipment");
    if (spec && validateGym("x", [spec]).length > 0) throw new Error("Weights are not valid");
    await repos.setExerciseLoads(exerciseId, spec);
    const gymId = await repos.getActiveGymId();
    if (gymId) await finish.refreshPlannedSessions(gymId);
  }

  async function seedKeyMap(): Promise<Map<string, { exerciseId: string; equipment: EquipmentType }>> {
    const rows = await db.all<{ id: string; seed_key: string; equipment: EquipmentType }>("SELECT id, seed_key, equipment FROM exercise WHERE seed_key IS NOT NULL AND deleted_at IS NULL");
    return new Map(rows.map((r) => [r.seed_key, { exerciseId: r.id, equipment: r.equipment }]));
  }

  async function patternOf(): Promise<(exerciseId: string) => string | undefined> {
    const rows = await db.all<{ id: string; pattern: string }>("SELECT id, pattern FROM exercise");
    const m = new Map(rows.map((r) => [r.id, r.pattern]));
    return (id) => m.get(id);
  }

  // ---- reading programs ---------------------------------------------------------------------------------
  async function getActive() {
    return repos.getLatestProgrammeVersion();
  }

  async function loadDraft(versionId: string): Promise<ProgrammeDraft> {
    const v = await db.get<{ name: string }>(
      "SELECT p.name AS name FROM programme_version pv JOIN programme p ON p.id = pv.programme_id WHERE pv.id = ? AND pv.deleted_at IS NULL",
      [versionId],
    );
    if (!v) throw new Error("Unknown program version");
    const days = await db.all<{ id: string; name: string }>("SELECT id, name FROM programme_day WHERE programme_version_id = ? AND deleted_at IS NULL ORDER BY position", [versionId]);
    const out: ProgrammeDraft = { name: v.name, days: [] };
    for (const d of days) {
      const ex = await db.all<{ exercise_id: string; sets: number; rep_min: number; rep_max: number; rep_ceiling: number | null; top_sets: number | null; is_goal_lift: number; track_effort: number }>(
        `SELECT exercise_id, sets, rep_min, rep_max, rep_ceiling, top_sets, is_goal_lift, track_effort FROM programme_day_exercise
         WHERE programme_day_id = ? AND deleted_at IS NULL ORDER BY position`,
        [d.id],
      );
      out.days.push({
        name: d.name,
        exercises: ex.map((e) => ({ exerciseId: e.exercise_id, sets: e.sets, repMin: e.rep_min, repMax: e.rep_max, repCeiling: e.rep_ceiling, isGoalLift: e.is_goal_lift === 1, trackEffort: e.track_effort === 1, topSets: normTopSets(e.sets, e.top_sets) })),
      });
    }
    return out;
  }

  async function listVersions(programmeId: string): Promise<VersionInfo[]> {
    const cur = await getActive();
    const rows = await db.all<{ id: string; version: number; created_at: number }>(
      "SELECT id, version, created_at FROM programme_version WHERE programme_id = ? AND deleted_at IS NULL ORDER BY version DESC",
      [programmeId],
    );
    const out: VersionInfo[] = [];
    for (const r of rows) {
      const c = await db.get<{ days: number; exercises: number }>(
        `SELECT COUNT(DISTINCT pd.id) AS days, COUNT(pde.id) AS exercises FROM programme_day pd
         LEFT JOIN programme_day_exercise pde ON pde.programme_day_id = pd.id AND pde.deleted_at IS NULL
         WHERE pd.programme_version_id = ? AND pd.deleted_at IS NULL`,
        [r.id],
      );
      const s = await db.get<{ n: number; f: number }>(
        "SELECT COUNT(*) AS n, COALESCE(SUM(status = 'finished'), 0) AS f FROM session WHERE programme_version_id = ? AND deleted_at IS NULL",
        [r.id],
      );
      out.push({ versionId: r.id, version: r.version, createdAt: r.created_at, isCurrent: cur?.versionId === r.id, days: Number(c?.days ?? 0), exercises: Number(c?.exercises ?? 0), sessions: Number(s?.n ?? 0), finishedSessions: Number(s?.f ?? 0) });
    }
    return out;
  }

  /** Every program the lifter has (the hidden Hevy-import history program is not one), the active one marked. Nothing is deleted by switching. */
  async function listProgrammes(): Promise<ProgrammeInfo[]> {
    const active = await getActive();
    const rows = await db.all<{ id: string; name: string; is_sample: number; created_at: number }>("SELECT id, name, is_sample, created_at FROM programme WHERE deleted_at IS NULL AND kind = 'user' ORDER BY created_at DESC");
    const out: ProgrammeInfo[] = [];
    for (const r of rows) {
      const v = await db.get<{ id: string; version: number; n: number }>(
        "SELECT id, version, (SELECT COUNT(*) FROM programme_version x WHERE x.programme_id = ? AND x.deleted_at IS NULL) AS n FROM programme_version WHERE programme_id = ? AND deleted_at IS NULL ORDER BY version DESC LIMIT 1",
        [r.id, r.id],
      );
      if (!v) continue;
      const d = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM programme_day WHERE programme_version_id = ? AND deleted_at IS NULL", [v.id]);
      const s = await db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM session s JOIN programme_version pv ON pv.id = s.programme_version_id WHERE pv.programme_id = ? AND s.status = 'finished' AND s.deleted_at IS NULL",
        [r.id],
      );
      out.push({ programmeId: r.id, name: r.name, isSample: r.is_sample === 1, isActive: active?.programmeId === r.id, version: Number(v.version), versions: Number(v.n), days: Number(d?.n ?? 0), finishedSessions: Number(s?.n ?? 0), createdAt: r.created_at });
    }
    return out;
  }

  /** Weekly exposure of a draft with the lifter's days per week (null = not told, so no weekly numbers are made up). */
  async function exposureOf(draft: ProgrammeDraft): Promise<ExposureRow[]> {
    const dpw = Number(await repos.getSetting("days_per_week"));
    return computeExposure(draft, await patternOf(), Number.isFinite(dpw) && dpw > 0 ? dpw : null);
  }

  // ---- writing --------------------------------------------------------------------------------------------
  async function insertVersion(programmeId: string, version: number, draft: ProgrammeDraft): Promise<string> {
    const t = now();
    const versionId = newId();
    await db.run("INSERT INTO programme_version (id, programme_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [versionId, programmeId, version, t, t]);
    for (const [di, day] of draft.days.entries()) {
      const dayId = newId();
      await db.run("INSERT INTO programme_day (id, programme_version_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [dayId, versionId, day.name.trim(), di, t, t]);
      for (const [ei, e] of day.exercises.entries()) {
        await db.run(
          `INSERT INTO programme_day_exercise (id, programme_day_id, exercise_id, position, sets, rep_min, rep_max, rep_ceiling, top_sets, is_goal_lift, track_effort, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), dayId, e.exerciseId, ei, e.sets, e.repMin, e.repMax, e.repCeiling, normTopSets(e.sets, e.topSets), e.isGoalLift ? 1 : 0, e.trackEffort ? 1 : 0, t, t],
        );
      }
    }
    return versionId;
  }

  /**
   * Planned (not started) sessions written for another program version are voided (soft delete, with their targets),
   * because their days no longer exist in the current version. In-progress and finished sessions are never touched.
   */
  async function voidStalePlanned(currentVersionId: string): Promise<number> {
    const t = now();
    const stale = await db.all<{ id: string }>("SELECT id FROM session WHERE status = 'planned' AND deleted_at IS NULL AND programme_version_id <> ?", [currentVersionId]);
    for (const s of stale) {
      await db.run("UPDATE decision_log SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL AND target_id IN (SELECT id FROM target WHERE session_id = ?)", [t, t, s.id]);
      await db.run("UPDATE target SET deleted_at = ?, updated_at = ? WHERE session_id = ? AND deleted_at IS NULL", [t, t, s.id]);
      await db.run("UPDATE session SET deleted_at = ?, updated_at = ? WHERE id = ?", [t, t, s.id]);
    }
    return stale.length;
  }

  async function assertNoOpenWorkout(): Promise<void> {
    const open = await db.get<{ id: string }>("SELECT id FROM session WHERE status = 'in_progress' AND deleted_at IS NULL LIMIT 1");
    if (open) throw new SessionInProgress();
  }

  async function replan(): Promise<void> {
    const gymId = await repos.getActiveGymId();
    if (gymId) await finish.planNextSession(gymId);
  }

  /** A new program (e.g. from a template or built from scratch). It becomes the active one unless told otherwise. */
  async function createProgramme(draft: ProgrammeDraft, opts: { activate?: boolean } = {}): Promise<{ programmeId: string; versionId: string }> {
    const problems = validateDraft(draft);
    if (problems.length > 0) throw new DraftInvalid(problems);
    const activate = opts.activate ?? true;
    if (activate) await assertNoOpenWorkout();
    const ids = await db.transaction(async () => {
      const t = now();
      const programmeId = newId();
      await db.run("INSERT INTO programme (id, name, is_sample, created_at, updated_at) VALUES (?, ?, 0, ?, ?)", [programmeId, draft.name.trim(), t, t]);
      const versionId = await insertVersion(programmeId, 1, draft);
      if (activate) {
        await repos.setSetting("active_programme_id", programmeId);
        await voidStalePlanned(versionId);
      }
      return { programmeId, versionId };
    });
    if (activate) await replan();
    return ids;
  }

  /**
   * Saves an edit as version N+1. No-op (no new version) when nothing changed. The name is the program's, not the version's.
   * Rotation continues where it was (by day position); the next planned session is rewritten from the new version.
   */
  async function saveNewVersion(programmeId: string, draft: ProgrammeDraft, opts: { background?: boolean; /** Runs inside the same transaction, after the version is written: other rows that must exist together with it. */ alsoInTransaction?: (versionId: string) => Promise<void> } = {}): Promise<{ versionId: string; version: number; changed: boolean }> {
    const problems = validateDraft(draft);
    if (problems.length > 0) throw new DraftInvalid(problems);
    const cur = await db.get<{ id: string; version: number }>("SELECT id, version FROM programme_version WHERE programme_id = ? AND deleted_at IS NULL ORDER BY version DESC LIMIT 1", [programmeId]);
    if (!cur) throw new Error("Unknown program");
    const before = await loadDraft(cur.id);
    if (draftFingerprint(before) === draftFingerprint(draft)) return { versionId: cur.id, version: cur.version, changed: false };
    // `background`: a program that is not the active one (e.g. closing a short week left behind). Nothing about today's workout or plan is touched.
    if (!opts.background) await assertNoOpenWorkout();
    const res = await db.transaction(async () => {
      const t = now();
      if (draft.name.trim() !== before.name.trim()) await db.run("UPDATE programme SET name = ?, updated_at = ? WHERE id = ?", [draft.name.trim(), t, programmeId]);
      const version = cur.version + 1;
      const versionId = await insertVersion(programmeId, version, draft);
      if (!opts.background) await voidStalePlanned(versionId);
      if (opts.alsoInTransaction) await opts.alsoInTransaction(versionId);
      return { versionId, version, changed: true };
    });
    if (!opts.background) await replan();
    return res;
  }

  async function setActiveProgramme(programmeId: string): Promise<void> {
    const p = await db.get<{ id: string }>("SELECT id FROM programme WHERE id = ? AND deleted_at IS NULL", [programmeId]);
    if (!p) throw new Error("Unknown program");
    await assertNoOpenWorkout();
    await repos.setSetting("active_programme_id", programmeId);
    const v = await getActive();
    if (v) await voidStalePlanned(v.versionId);
    await replan();
  }

  return { listExercises, createExercise, setExerciseMeasure, setExerciseLoads, getExerciseLoads: repos.getExerciseLoads, seedKeyMap, getActive, loadDraft, listVersions, listProgrammes, exposureOf, createProgramme, saveNewVersion, setActiveProgramme };
}
export type ProgrammeRepo = ReturnType<typeof createProgrammeRepo>;
