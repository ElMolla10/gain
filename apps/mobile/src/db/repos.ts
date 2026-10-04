import { classifyLift, DEFAULT_REP_CEILINGS, type Measure, mergeRepCeilings, resolveProgression, resolveRepTop, validateRepCeiling, type CeilingClass, type GymFingerprint, type GymLoadSpec, type RepCeilings, type RepTopBasis } from "@gain/engine";
import { parseUnit, type Unit } from "../logic/units";
import type { Db, Deps } from "./driver";
import { normTopSets } from "../logic/programmeDraft";
import { parseStoredLoads, serializeLoads } from "../logic/exerciseLoads";
import { hasLoggedSets } from "./sessionSql";
import { DRAFT_LIBRARY, LIBRARY_VERSION } from "./libraryDraft";
import { DEFAULT_TIMED_RANGE, measureOfKey } from "./library/measures";
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
  /**
   * "Use GAIN rep ceilings" (rule-v0.4). Off by default: the program's own top rep limit is what earns more load. On: the ceilings above replace the top
   * of every program range (as before rule-v0.4); a ceiling set on one lift still wins over both.
   */
  async function getUseGainCeilings(): Promise<boolean> {
    return (await getSetting("use_gain_ceilings")) === "1";
  }
  async function setUseGainCeilings(on: boolean): Promise<void> {
    await setSetting("use_gain_ceilings", on ? "1" : "0");
  }
  /** Set (or clear with null) the rep ceiling of ONE lift in the program. Null falls back to the default for its kind. */
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
          if (!exerciseId) throw new Error(`Seed program refers to unknown exercise ${ex.key}`);
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
          `INSERT INTO exercise (id, seed_key, name_en, name_ar, aliases_ar_json, pattern, equipment, setup, measure, is_sample, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [newId(), e.key, e.en, e.ar, JSON.stringify(e.aliasesAr), e.pattern, e.equipment, e.setup, measureOfKey(e.key), t, t],
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

  /** The weights the lifter set for this exercise, or null (the gym's grid applies). Damaged stored text reads as null. */
  async function getExerciseLoads(exerciseId: string): Promise<{ equipment: GymLoadSpec["equipment"]; spec: GymLoadSpec | null } | null> {
    const r = await db.get<{ equipment: GymLoadSpec["equipment"]; load_spec_json: string | null }>("SELECT equipment, load_spec_json FROM exercise WHERE id = ? AND deleted_at IS NULL", [exerciseId]);
    return r ? { equipment: r.equipment, spec: parseStoredLoads(r.load_spec_json, r.equipment) } : null;
  }
  /** Sets (or, with null, clears) this exercise's own weights. The row's updated_at moves so the change syncs. Changes no history. */
  async function setExerciseLoads(exerciseId: string, spec: GymLoadSpec | null): Promise<void> {
    const json = spec ? serializeLoads(spec) : null;
    await db.run("UPDATE exercise SET load_spec_json = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL", [json, now(), exerciseId]);
  }

  // ---- program / Today ----------------------------------------------------------------------------------
  /**
   * The current version of the active program (setting `active_programme_id`; before one is set, the oldest program).
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
      measure: Measure;
      sets: number;
      rep_min: number;
      rep_max: number;
      rep_ceiling: number | null;
      top_sets: number | null;
      is_goal_lift: number;
      track_effort: number;
      position: number;
      pattern: string;
      load_spec_json: string | null;
    }>(
      `SELECT pde.id, pde.exercise_id, e.name_en, e.name_ar, e.aliases_ar_json, e.equipment, e.setup, e.measure, e.pattern, e.load_spec_json,
              pde.sets, pde.rep_min, pde.rep_max, pde.rep_ceiling, pde.top_sets, pde.is_goal_lift, pde.track_effort, pde.position
       FROM programme_day_exercise pde JOIN exercise e ON e.id = pde.exercise_id
       WHERE pde.programme_day_id = ? AND pde.deleted_at IS NULL ORDER BY pde.position`,
      [dayId],
    );
    const ceilings = await getRepCeilingDefaults();
    const useGain = await getUseGainCeilings();
    return rows.map((r) => {
      if (r.measure !== "reps") {
        // Seconds or metres: the range is the lifter's own (no rep ceiling, no kind-of-lift default); its top is what earns more load.
        return {
          id: r.id,
          exerciseId: r.exercise_id,
          nameEn: r.name_en,
          nameAr: r.name_ar,
          aliasesAr: JSON.parse(r.aliases_ar_json) as string[],
          equipment: r.equipment,
          setup: r.setup,
          measure: r.measure,
          pattern: r.pattern,
          sets: r.sets,
          repMin: r.rep_min,
          repMax: r.rep_max,
          programmeRepMin: r.rep_min,
          programmeRepMax: r.rep_max as number | null,
          repCeiling: r.rep_max,
          repCeilingIsCustom: false,
          repTopBasis: "program" as RepTopBasis,
          gainCeiling: r.rep_max,
          topSets: null as number | null,
          loadSpec: parseStoredLoads(r.load_spec_json, r.equipment),
          isGoalLift: r.is_goal_lift === 1,
          trackEffort: false,
        };
      }
      // rule-v0.4: the top of the range that decides when load goes up is the lift's own ceiling, else (only if "Use GAIN rep ceilings" is on) the GAIN
      // ceiling for this kind of lift, else the program's own top.
      const gainCeiling = resolveProgression(classifyLift(r.name_en).bodyRegion, {}, { name: r.name_en, ceilings }).repCeiling;
      const { top, basis } = resolveRepTop({ programMax: r.rep_max, liftCeiling: r.rep_ceiling, gainCeiling, useGainCeilings: useGain });
      const policy = { repCeiling: top };
      return {
      id: r.id,
      exerciseId: r.exercise_id,
      nameEn: r.name_en,
      nameAr: r.name_ar,
      aliasesAr: JSON.parse(r.aliases_ar_json) as string[],
      equipment: r.equipment,
      setup: r.setup,
      measure: r.measure,
      pattern: r.pattern,
      sets: r.sets,
      /** Bottom of the program range, never above the ceiling. */
      repMin: Math.min(r.rep_min, policy.repCeiling),
      /** Top of the range in force (what the Today screen shows): see repTopBasis. */
      repMax: policy.repCeiling,
      /** The range the program itself was written with, before the ceiling replaced its top (P05: shown, never silent). */
      programmeRepMin: r.rep_min,
      programmeRepMax: r.rep_max as number | null,
      repCeiling: policy.repCeiling,
      /** True when this lift has its own ceiling; false when it follows the default for its kind of lift. */
      repCeilingIsCustom: r.rep_ceiling !== null,
      /** Why repMax is what it is (lift / program / gain_setting). */
      repTopBasis: basis,
      /** The GAIN ceiling for this kind of lift, for the text that says what "Use GAIN rep ceilings" would change. */
      gainCeiling,
      /** null = straight sets; n = top set + back-offs (only the n heaviest sets are judged). */
      topSets: normTopSets(r.sets, r.top_sets),
      /** Weights the lifter set for this exercise (null = the gym's grid). */
      loadSpec: parseStoredLoads(r.load_spec_json, r.equipment),
      isGoalLift: r.is_goal_lift === 1,
      trackEffort: r.track_effort === 1,
      };
    });
  }

  /**
   * An exercise the lifter added to today's workout without it being in the program: the same shape as a program exercise with plain
   * defaults (3 sets, rep range 8 up to the rep ceiling for this kind of lift, not a goal lift, no effort tracking). Never stored in the program.
   */
  async function adHocDayExercise(exerciseId: string): Promise<DayExercise | null> {
    const r = await db.get<{ id: string; name_en: string; name_ar: string; aliases_ar_json: string; equipment: GymLoadSpec["equipment"]; setup: "free" | "assisted" | "bodyweight_plus_added"; measure: Measure; pattern: string; load_spec_json: string | null }>(
      "SELECT id, name_en, name_ar, aliases_ar_json, equipment, setup, measure, pattern, load_spec_json FROM exercise WHERE id = ? AND deleted_at IS NULL",
      [exerciseId],
    );
    if (!r) return null;
    if (r.measure !== "reps") {
      const d = DEFAULT_TIMED_RANGE[r.measure];
      return {
        id: `added:${r.id}`, exerciseId: r.id, nameEn: r.name_en, nameAr: r.name_ar, aliasesAr: JSON.parse(r.aliases_ar_json) as string[], equipment: r.equipment, setup: r.setup,
        measure: r.measure, pattern: r.pattern, sets: d.sets, repMin: d.min, repMax: d.max, programmeRepMin: d.min, programmeRepMax: d.max as number | null, repCeiling: d.max, repCeilingIsCustom: false, repTopBasis: "program" as RepTopBasis, gainCeiling: d.max, topSets: null as number | null, loadSpec: parseStoredLoads(r.load_spec_json, r.equipment), isGoalLift: false, trackEffort: false,
      };
    }
    const policy = resolveProgression(classifyLift(r.name_en).bodyRegion, {}, { name: r.name_en, ceilings: await getRepCeilingDefaults() });
    return {
      id: `added:${r.id}`,
      exerciseId: r.id,
      nameEn: r.name_en,
      nameAr: r.name_ar,
      aliasesAr: JSON.parse(r.aliases_ar_json) as string[],
      equipment: r.equipment,
      setup: r.setup,
      measure: r.measure,
      pattern: r.pattern,
      sets: 3,
      repMin: Math.min(8, policy.repCeiling),
      repMax: policy.repCeiling,
      programmeRepMin: 8,
      // An exercise added for today has no program range, so it has no top of its own: the GAIN ceiling for its kind of lift applies (and is shown as such).
      programmeRepMax: null as number | null,
      repCeiling: policy.repCeiling,
      repCeilingIsCustom: false,
      repTopBasis: "no_upper_bound" as RepTopBasis,
      gainCeiling: policy.repCeiling,
      topSets: null as number | null,
      loadSpec: parseStoredLoads(r.load_spec_json, r.equipment),
      isGoalLift: false,
      trackEffort: false,
    };
  }

  /**
   * The next program day in rotation: the day after the most recently FINISHED session's day, else the first day.
   * Missed workouts are not completed workouts, so only finished sessions advance the rotation.
   */
  async function getNextDay(): Promise<{ versionId: string; programmeName: string; day: { id: string; name: string; position: number }; dayCount: number } | null> {
    const v = await getLatestProgrammeVersion();
    if (!v) return null;
    const days = await listDays(v.versionId);
    if (days.length === 0) return null;
    // Rotation continues across program versions: the day after the last finished day's POSITION (any version of this program).
    const last = await db.get<{ position: number }>(
      `SELECT pd.position AS position FROM session s
       JOIN programme_day pd ON pd.id = s.programme_day_id
       JOIN programme_version pv ON pv.id = pd.programme_version_id
       WHERE s.status = 'finished' AND s.deleted_at IS NULL AND ${hasLoggedSets("s")} AND pv.programme_id = ?
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
    getUseGainCeilings,
    setUseGainCeilings,
    setRepCeilingDefaults,
    resetRepCeilingDefaults,
    setLiftRepCeiling,
    seedIfNeeded,
    topUpLibrary,
    getActiveGymId,
    loadGymFingerprint,
    getExerciseLoads,
    setExerciseLoads,
    getLatestProgrammeVersion,
    listDays,
    listDayExercises,
    adHocDayExercise,
    getNextDay,
  };
}
export type Repos = ReturnType<typeof createRepos>;
export type DayExercise = Awaited<ReturnType<Repos["listDayExercises"]>>[number];
