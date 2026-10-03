import type { EquipmentType, GymLoadSpec } from "@gain/engine";
import { defaultGymLoads, defaultGymName } from "../logic/defaultGym";
import { validateGym } from "../logic/gymInput";
import { validateDraft } from "../logic/programmeDraft";
import { validateProfile, type GoalInput, type Profile, type ProfileProblem } from "../logic/onboarding";
import type { ProgrammeDraft } from "../logic/programmeDraft";
import type { Db, Deps } from "./driver";
import { GymInvalid, type GymRepo } from "./gymRepo";
import { DraftInvalid, SessionInProgress, type ProgrammeRepo } from "./programmeRepo";
import type { Repos } from "./repos";

export class ProfileInvalid extends Error {
  constructor(public readonly problems: ProfileProblem[]) {
    super(`Profile is not valid: ${problems.map((p) => p.code).join(", ")}`);
  }
}

export type OnboardingState = "done" | "skipped" | null;

export interface CompleteInput {
  profile: Profile;
  /** The first programme, already shaped (from a template or built by the lifter). */
  programme: ProgrammeDraft;
  /**
   * Optional. Leave it out (what onboarding does) and a default gym is created silently from the profile's unit, unless the lifter
   * already has a real (non-sample) gym in use, which is kept. Give it to create exactly this rack instead.
   */
  gym?: { name: string; loads: GymLoadSpec[] };
}

/**
 * Onboarding data layer. `complete` is one step: it saves the answers, a default gym (made silently; refined later in the Gym tab) and the first programme, retires the
 * sample gym and sample programme when nothing was logged on them, and plans the first session, so there is no half-done state
 * that shows a mix of sample and real data.
 */
export function createOnboardingRepo(db: Db, deps: Deps, repos: Repos, gyms: GymRepo, programmes: ProgrammeRepo) {
  const { newId, now } = deps;

  async function getState(): Promise<OnboardingState> {
    const v = await repos.getSetting("onboarding_state");
    return v === "done" || v === "skipped" ? v : null;
  }

  /** Lifter chose to keep what they have (or already has real data from an earlier version). Sample data stays labelled as sample. */
  async function skip(): Promise<void> {
    await repos.setSetting("onboarding_state", "skipped");
  }

  /**
   * An install that already has the lifter's own data (a finished session, or a gym / programme that is not the sample) should not be
   * pushed through setup. Returns true when it marked the install as set up.
   */
  async function markExistingInstall(): Promise<boolean> {
    if ((await getState()) !== null) return false;
    const s = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM session WHERE status = 'finished' AND deleted_at IS NULL");
    const g = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM gym WHERE is_sample = 0 AND deleted_at IS NULL");
    const p = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM programme WHERE is_sample = 0 AND kind = 'user' AND deleted_at IS NULL");
    if (Number(s?.n) + Number(g?.n) + Number(p?.n) === 0) return false;
    await skip();
    return true;
  }

  async function getProfile(): Promise<Partial<Profile>> {
    const num = async (k: string) => {
      const v = await repos.getSetting(k);
      return v === null || v === "" ? null : Number(v);
    };
    const eq = await repos.getSetting("equipment_json");
    return {
      language: await repos.getLanguage(),
      units: await repos.getUnits(),
      daysPerWeek: (await num("days_per_week")) ?? undefined,
      sessionMinutes: (await num("session_minutes")) ?? undefined,
      equipment: eq ? (JSON.parse(eq) as EquipmentType[]) : undefined,
      heightCm: await num("height_cm"),
      bodyweightKg: await num("bodyweight_kg"),
      birthDate: (await repos.getSetting("birth_date")) || null,
    };
  }

  async function writeGoal(goal: GoalInput): Promise<void> {
    const t = now();
    // One goal at a time: an earlier goal is retired (soft delete), not edited in place.
    await db.run("UPDATE goal SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL", [t, t]);
    const id = newId();
    if (goal.kind === "lift")
      await db.run("INSERT INTO goal (id, kind, exercise_id, target_load, target_reps, target_date, created_at, updated_at) VALUES (?, 'lift', ?, ?, ?, ?, ?, ?)", [id, goal.exerciseId, goal.targetLoad, goal.targetReps, goal.targetDate, t, t]);
    else if (goal.kind === "bodyweight")
      await db.run("INSERT INTO goal (id, kind, target_weight_kg, target_date, created_at, updated_at) VALUES (?, 'bodyweight', ?, ?, ?, ?)", [id, goal.targetWeightKg, goal.targetDate, t, t]);
    else await db.run("INSERT INTO goal (id, kind, note, created_at, updated_at) VALUES (?, 'muscle', ?, ?, ?)", [id, goal.muscle, t, t]);
  }

  async function getGoal(): Promise<GoalInput | null> {
    const r = await db.get<{ kind: "lift" | "bodyweight" | "muscle"; exercise_id: string | null; target_load: number | null; target_reps: number | null; target_weight_kg: number | null; target_date: string | null; note: string | null }>(
      "SELECT kind, exercise_id, target_load, target_reps, target_weight_kg, target_date, note FROM goal WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
    );
    if (!r) return null;
    if (r.kind === "lift") return { kind: "lift", exerciseId: r.exercise_id!, targetLoad: r.target_load!, targetReps: r.target_reps!, targetDate: r.target_date };
    if (r.kind === "bodyweight") return { kind: "bodyweight", targetWeightKg: r.target_weight_kg!, targetDate: r.target_date };
    return { kind: "muscle", muscle: r.note as never };
  }

  /** Retire sample rows that nothing was logged on. Sample data with real sessions on it stays (inactive) so history never breaks. */
  async function retireSample(): Promise<void> {
    const t = now();
    const gymsToGo = await db.all<{ id: string }>(
      `SELECT g.id FROM gym g WHERE g.is_sample = 1 AND g.deleted_at IS NULL AND g.id <> ?
       AND NOT EXISTS (SELECT 1 FROM session s WHERE s.gym_id = g.id AND s.status = 'finished' AND s.deleted_at IS NULL)`,
      [(await repos.getActiveGymId()) ?? ""],
    );
    for (const g of gymsToGo) {
      await db.run("UPDATE gym SET deleted_at = ?, updated_at = ? WHERE id = ?", [t, t, g.id]);
      await db.run("UPDATE gym_load SET deleted_at = ?, updated_at = ? WHERE gym_id = ? AND deleted_at IS NULL", [t, t, g.id]);
    }
    const activeProg = (await repos.getSetting("active_programme_id")) ?? "";
    const progs = await db.all<{ id: string }>(
      `SELECT p.id FROM programme p WHERE p.is_sample = 1 AND p.deleted_at IS NULL AND p.id <> ?
       AND NOT EXISTS (SELECT 1 FROM session s JOIN programme_version pv ON pv.id = s.programme_version_id
                       WHERE pv.programme_id = p.id AND s.status IN ('finished','in_progress') AND s.deleted_at IS NULL)`,
      [activeProg],
    );
    for (const p of progs) {
      await db.run("UPDATE programme_version SET deleted_at = ?, updated_at = ? WHERE programme_id = ? AND deleted_at IS NULL", [t, t, p.id]);
      await db.run("UPDATE programme SET deleted_at = ?, updated_at = ? WHERE id = ?", [t, t, p.id]);
    }
  }

  /** The gym the first session uses: the one asked for, else the lifter's own gym already in use, else a new default gym. */
  async function resolveGym(asked: CompleteInput["gym"], p: Profile): Promise<string> {
    if (asked) return gyms.createGym({ name: asked.name, loads: asked.loads, activate: true });
    const active = await repos.getActiveGymId();
    if (active && (await db.get("SELECT id FROM gym WHERE id = ? AND is_sample = 0 AND deleted_at IS NULL", [active]))) return active;
    return gyms.createGym({ name: defaultGymName(p.language), loads: defaultGymLoads(p.units), activate: true });
  }

  async function complete(input: CompleteInput): Promise<{ gymId: string; programmeId: string }> {
    const problems = validateProfile(input.profile, now());
    if (problems.length > 0) throw new ProfileInvalid(problems);
    const p = input.profile;
    // Validate everything before writing anything, so a bad answer never leaves a half-set-up app.
    if (input.gym) {
      const gymProblems = validateGym(input.gym.name, input.gym.loads);
      if (gymProblems.length > 0) throw new GymInvalid(gymProblems);
    }
    const draftProblems = validateDraft(input.programme);
    if (draftProblems.length > 0) throw new DraftInvalid(draftProblems);
    if (await db.get("SELECT id FROM session WHERE status = 'in_progress' AND deleted_at IS NULL LIMIT 1")) throw new SessionInProgress();
    const gymId = await resolveGym(input.gym, p);
    const { programmeId } = await programmes.createProgramme(input.programme, { activate: true });
    await db.transaction(async () => {
      await repos.setSetting("language", p.language);
      await repos.setSetting("units", p.units);
      await repos.setSetting("days_per_week", String(p.daysPerWeek));
      await repos.setSetting("session_minutes", String(p.sessionMinutes));
      await repos.setSetting("equipment_json", JSON.stringify(p.equipment));
      await repos.setSetting("height_cm", p.heightCm === null ? "" : String(p.heightCm));
      await repos.setSetting("birth_date", p.birthDate ?? "");
      await repos.setSetting("bodyweight_kg", p.bodyweightKg === null ? "" : String(p.bodyweightKg));
      if (p.bodyweightKg !== null) {
        const t = now();
        await db.run("INSERT INTO bodyweight_entry (id, weight_kg, measured_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [newId(), p.bodyweightKg, t, t, t]);
      }
      await writeGoal(p.goal);
      await retireSample();
      await repos.setSetting("onboarding_state", "done");
    });
    return { gymId, programmeId };
  }

  return { getState, skip, markExistingInstall, getProfile, getGoal, complete };
}
export type OnboardingRepo = ReturnType<typeof createOnboardingRepo>;
