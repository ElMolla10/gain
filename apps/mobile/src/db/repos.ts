import { classifyLift, DEFAULT_REP_CEILINGS, mergeRepCeilings, resolveProgression, validateRepCeiling, type CeilingClass, type GymFingerprint, type GymLoadSpec, type RepCeilings } from "@gain/engine";
import { parseUnit, type Unit } from "../logic/units";
import type { Db, Deps } from "./driver";
import { DRAFT_LIBRARY, LIBRARY_VERSION } from "./libraryDraft";
import { SAMPLE_EXERCISES, SAMPLE_GYM, SAMPLE_PROGRAMME, SEED_VERSION } from "./seedData";

export type Language = "en" | "ar";
export type RtlOverride = "auto" | "on" | "off";

/** Insert-or-update helper timestamps. Every write goes through updated_at so sync can follow later. */
export function createRepos(db: Db, deps: Deps) {
  const { newId, now } = deps;

  // ---- settings -------------------------------------------------------------------------------------------
  async function getSetting(key: string): Promise<string | null> {
    const r = await db.get<{ value: string }>("SELECT value FROM setting WHERE id = ? AND deleted_at IS NULL", [key]);
    return r?.value ?? null;
  }
  async function setSetting(key: string, value: string): Promise<void> {
    const t = now();
    await db.run(
      `INSERT INTO setting (id, value, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, deleted_at = NULL`,
      [key, value, t, t],
    );
  }
  async function getLanguage(): Promise<Language> {
    return (await getSetting("language")) === "ar" ? "ar" : "en"; // English is the default for now
  }
  /** Weight unit for display and typing. Loads are always stored in kg; kg is the default. */
  async function getUnits(): Promise<Unit> {
    return parseUnit(await getSetting("units"));
  }
  async function setUnits(unit: Unit): Promise<void> {
    await setSetting("units", parseUnit(unit));
  }
  async function getRtlOverride(): Promise<RtlOverride> {
    const v = await getSetting("rtl_override");
    return v === "on" || v === "off" ? v : "auto";
  }

  // ---- rep ceilings (reps at which load goes up) ----------------------------------------------------------
  /** App-wide defaults per kind of lift: the lifter's edits over 10 upper / 12 legs / 15 lateral raises. */
  async function getRepCeilingDefaults(): Promise<RepCeilings> {
    const raw = await getSetting("rep_ceilings");
    if (!raw) return { ...DEFAULT_REP_CEILINGS };
    try {
      return mergeRepCeilings(JSON.parse(raw) as Partial<RepCeilings>);
    } catch {
      return { ...DEFAULT_REP_CEILINGS }; // a damaged setting never blocks a workout
    }
  }
  /** Edit one or more defaults. Only the edited kinds are stored, so untouched kinds keep following the built-in defaults. */
  async function setRepCeilingDefaults(edit: Partial<RepCeilings>): Promise<RepCeilings> {
    for (const [k, v] of Object.entries(edit)) validateRepCeiling(v as number, `repCeilings.${k}`);
    const raw = await getSetting("rep_ceilings");
    let stored: Partial<RepCeilings> = {};
    try {
      stored = raw ? (JSON.parse(raw) as Partial<RepCeilings>) : {};
    } catch {
      stored = {};
    }
    const next = { ...stored, ...edit };
    await setSetting("rep_ceilings", JSON.stringify(next));
    return mergeRepCeilings(next);
  }
  async function resetRepCeilingDefaults(kind: CeilingClass): Promise<RepCeilings> {
    const raw = await getSetting("rep_ceilings");
    const stored = raw ? (JSON.parse(raw) as Partial<RepCeilings>) : {};
    delete stored[kind];
    await setSetting("rep_ceilings", JSON.stringify(stored));
    return mergeRepCeilings(stored);
  }
  /** Set (or clear with null) the rep ceiling of ONE lift in the programme. Null falls back to the default for its kind. */
  async function setLiftRepCeiling(programmeDayExerciseId: string, ceiling: number | null): Promise<void> {
    if (ceiling !== null) validateRepCeiling(ceiling);
    await db.run("UPDATE programme_day_exercise SET rep_ceiling = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL", [ceiling, now(), programmeDayExerciseId]);
  }

  // ---- seed (sample data, clearly labelled) ---------------------------------------------------------------
  /** Idempotent: runs once per SEED_VERSION, never duplicates rows when the app is re-opened. */
  async function seedIfNeeded(): Promise<{ seeded: boolean }> {
    if ((await getSetting("seed_version")) === String(SEED_VERSION)) return { seeded: false };
    await db.transaction(async () => {
      const t = now();
      const gymId = newId();
      await db.run("INSERT INTO gym (id, name, is_sample, created_at, updated_at) VALUES (?, ?, 1, ?, ?)", [
        gymId,
        SAMPLE_GYM.name,
        t,
        t,
      ]);
      for (const l of SAMPLE_GYM.loads as GymLoadSpec[]) {
        await db.run(
          `INSERT INTO gym_load (id, gym_id, equipment, loads_json, increment, min_load, max_load, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), gymId, l.equipment, l.loads ? JSON.stringify(l.loads) : null, l.increment ?? null, l.min ?? null, l.max ?? null, t, t],
        );
      }
      const exId = new Map<string, string>();
      for (const e of SAMPLE_EXERCISES) {
        const id = newId();
        exId.set(e.key, id);
        await db.run(
          `INSERT INTO exercise (id, seed_key, name_en, name_ar, aliases_ar_json, pattern, equipment, setup, is_sample, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [id, e.key, e.en, e.ar, JSON.stringify(e.aliasesAr), e.pattern, e.equipment, e.setup, t, t],
        );
        await db.run(
          "INSERT INTO exercise_line (id, exercise_id, gym_id, setup, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          [newId(), id, gymId, e.setup, t, t],
        );
      }
      const progId = newId();
      await db.run("INSERT INTO programme (id, name, is_sample, created_at, updated_at) VALUES (?, ?, 1, ?, ?)", [progId, SAMPLE_PROGRAMME.name, t, t]);
      const verId = newId();
      await db.run("INSERT INTO programme_version (id, programme_id, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)", [verId, progId, t, t]);
      for (const [di, day] of SAMPLE_PROGRAMME.days.entries()) {
        const dayId = newId();
        await db.run(
          "INSERT INTO programme_day (id, programme_version_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          [dayId, verId, day.name, di, t, t],
        );
        for (const [ei, ex] of day.exercises.entries()) {
          const exerciseId = exId.get(ex.key);
          if (!exerciseId) throw new Error(`Seed programme refers to unknown exercise ${ex.key}`);
          await db.run(
            `INSERT INTO programme_day_exercise (id, programme_day_id, exercise_id, position, sets, rep_min, rep_max, is_goal_lift, track_effort, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [newId(), dayId, exerciseId, ei, ex.sets, ex.repMin, ex.repMax, "goalLift" in ex && ex.goalLift ? 1 : 0, t, t],
          );
        }
      }
      await setSetting("active_gym_id", gymId);
      await setSetting("active_programme_id", progId);
      await setSetting("seed_version", String(SEED_VERSION));
    });
    return { seeded: true };
  }

  /**
   * Adds the draft library exercises that are missing (matched by seed_key), once per LIBRARY_VERSION.
   * It never changes or resurrects an exercise the lifter already has, edited, or deleted: a seed_key that exists in any state is left alone.
   * Rows are NOT sample rows (is_sample = 0): they are library entries with a draft Arabic name.
   */
  async function topUpLibrary(): Promise<{ added: number }> {
    if ((await getSetting("library_version")) === String(LIBRARY_VERSION)) return { added: 0 };
    let added = 0;
    await db.transaction(async () => {
      const t = now();
      for (const e of DRAFT_LIBRARY) {
        const have = await db.get<{ id: string }>("SELECT id FROM exercise WHERE seed_key = ?", [e.key]);
        if (have) continue;
        await db.run(
          `INSERT INTO exercise (id, seed_key, name_en, name_ar, aliases_ar_json, pattern, equipment, setup, is_sample, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [newId(), e.key, e.en, e.ar, JSON.stringify(e.aliasesAr), e.pattern, e.equipment, e.setup, t, t],
        );
        added++;
      }
      await setSetting("library_version", String(LIBRARY_VERSION));
    });
    return { added };
  }

  // ---- gym ------------------------------------------------------------------------------------------------
  async function getActiveGymId(): Promise<string | null> {
    return getSetting("active_gym_id");
  }
  async function loadGymFingerprint(gymId: string): Promise<GymFingerprint> {
    const rows = await db.all<{
      equipment: GymLoadSpec["equipment"];
      loads_json: string | null;
      increment: number | null;
      min_load: number | null;
      max_load: number | null;
    }>("SELECT equipment, loads_json, increment, min_load, max_load FROM gym_load WHERE gym_id = ? AND deleted_at IS NULL", [gymId]);
    return {
      gymId,
      loads: rows.map((r) => {
        const spec: GymLoadSpec = { equipment: r.equipment };
        if (r.loads_json) spec.loads = JSON.parse(r.loads_json) as number[];
        if (r.increment !== null) spec.increment = r.increment;
        if (r.min_load !== null) spec.min = r.min_load;
        if (r.max_load !== null) spec.max = r.max_load;
        return spec;
      }),
    };
  }

  // ---- programme / Today ----------------------------------------------------------------------------------
  /**
   * The current version of the active programme (setting `active_programme_id`; before one is set, the oldest programme).
   * Older versions stay in the database so the sessions logged on them remain readable.
   */
  async function getLatestProgrammeVersion(): Promise<{ versionId: string; programmeId: string; programmeName: string; version: number; isSample: boolean } | null> {
    const activeId = await getSetting("active_programme_id");
    const r = await db.get<{ id: string; pid: string; name: string; version: number; is_sample: number }>(
      `SELECT pv.id AS id, p.id AS pid, p.name AS name, pv.version AS version, p.is_sample AS is_sample
       FROM programme_version pv JOIN programme p ON p.id = pv.programme_id
       WHERE pv.deleted_at IS NULL AND p.deleted_at IS NULL AND p.kind = 'user' ${activeId ? "AND p.id = ?" : ""}
       ORDER BY p.created_at, pv.version DESC LIMIT 1`,
      activeId ? [activeId] : [],
    );
    return r ? { versionId: r.id, programmeId: r.pid, programmeName: r.name, version: r.version, isSample: r.is_sample === 1 } : null;
  }

  async function listDays(versionId: string): Promise<{ id: string; name: string; position: number }[]> {
    return db.all("SELECT id, name, position FROM programme_day WHERE programme_version_id = ? AND deleted_at IS NULL ORDER BY position", [versionId]) as Promise<
      { id: string; name: string; position: number }[]
    >;
  }

  async function listDayExercises(dayId: string) {
    const rows = await db.all<{
      id: string;
      exercise_id: string;
      name_en: string;
      name_ar: string;
      aliases_ar_json: string;
      equipment: GymLoadSpec["equipment"];
      setup: "free" | "assisted" | "bodyweight_plus_added";
      sets: number;
      rep_min: number;
      rep_max: number;
      rep_ceiling: number | null;
      is_goal_lift: number;
      track_effort: number;
      position: number;
    }>(
      `SELECT pde.id, pde.exercise_id, e.name_en, e.name_ar, e.aliases_ar_json, e.equipment, e.setup,
              pde.sets, pde.rep_min, pde.rep_max, pde.rep_ceiling, pde.is_goal_lift, pde.track_effort, pde.position
       FROM programme_day_exercise pde JOIN exercise e ON e.id = pde.exercise_id
       WHERE pde.programme_day_id = ? AND pde.deleted_at IS NULL ORDER BY pde.position`,
      [dayId],
    );
    const ceilings = await getRepCeilingDefaults();
    return rows.map((r) => {
      // The ceiling (per-lift edit, else the default for this kind of lift) is the top of the range that decides when load goes up.
      const policy = resolveProgression(classifyLift(r.name_en).bodyRegion, r.rep_ceiling !== null ? { repCeiling: r.rep_ceiling } : {}, { name: r.name_en, ceilings });
      return {
      id: r.id,
      exerciseId: r.exercise_id,
      nameEn: r.name_en,
      nameAr: r.name_ar,
      aliasesAr: JSON.parse(r.aliases_ar_json) as string[],
      equipment: r.equipment,
      setup: r.setup,
      sets: r.sets,
      /** Bottom of the programme range, never above the ceiling. */
      repMin: Math.min(r.rep_min, policy.repCeiling),
      /** Top of the range = the rep ceiling (what the Today screen shows). */
      repMax: policy.repCeiling,
      repCeiling: policy.repCeiling,
      /** True when this lift has its own ceiling; false when it follows the default for its kind. */
      repCeilingIsCustom: r.rep_ceiling !== null,
      isGoalLift: r.is_goal_lift === 1,
      trackEffort: r.track_effort === 1,
      };
    });
  }

  /**
   * The next programme day in rotation: the day after the most recently FINISHED session's day, else the first day.
   * Missed workouts are not completed workouts, so only finished sessions advance the rotation.
   */
  async function getNextDay(): Promise<{ versionId: string; programmeName: string; day: { id: string; name: string; position: number }; dayCount: number } | null> {
    const v = await getLatestProgrammeVersion();
    if (!v) return null;
    const days = await listDays(v.versionId);
    if (days.length === 0) return null;
    // Rotation continues across programme versions: the day after the last finished day's POSITION (any version of this programme).
    const last = await db.get<{ position: number }>(
      `SELECT pd.position AS position FROM session s
       JOIN programme_day pd ON pd.id = s.programme_day_id
       JOIN programme_version pv ON pv.id = pd.programme_version_id
       WHERE s.status = 'finished' AND s.deleted_at IS NULL AND pv.programme_id = ?
       ORDER BY s.finished_at DESC LIMIT 1`,
      [v.programmeId],
    );
    const idx = last ? (last.position + 1) % days.length : 0;
    return { versionId: v.versionId, programmeName: v.programmeName, day: days[idx]!, dayCount: days.length };
  }

  return {
    getSetting,
    setSetting,
    getLanguage,
    getUnits,
    setUnits,
    getRtlOverride,
    getRepCeilingDefaults,
    setRepCeilingDefaults,
    resetRepCeilingDefaults,
    setLiftRepCeiling,
    seedIfNeeded,
    topUpLibrary,
    getActiveGymId,
    loadGymFingerprint,
    getLatestProgrammeVersion,
    listDays,
    listDayExercises,
    getNextDay,
  };
}
export type Repos = ReturnType<typeof createRepos>;
