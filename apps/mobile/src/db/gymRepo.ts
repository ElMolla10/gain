import type { EquipmentType, GymLoadSpec } from "@gain/engine";
import { cleanSpec, validateGym, type GymProblem } from "../logic/gymInput";
import type { Db, Deps } from "./driver";
import type { FinishRepo } from "./finishRepo";
import type { Repos } from "./repos";

export interface GymSummary {
  id: string;
  name: string;
  isSample: boolean;
  isActive: boolean;
  equipment: EquipmentType[];
  finishedSessions: number;
}

export interface GymDetail {
  id: string;
  name: string;
  isSample: boolean;
  loads: GymLoadSpec[];
}

export class GymInvalid extends Error {
  constructor(public readonly problems: GymProblem[]) {
    super(`Gym is not valid: ${problems.map((p) => p.code + (p.equipment ? `:${p.equipment}` : "")).join(", ")}`);
  }
}

/**
 * Gym editor data layer. A gym is a list of loads that exist (the fingerprint), not an equipment checklist.
 * Several gyms can be saved; each has its own history lines (exercise + gym + setup), so editing or switching
 * a gym never mixes histories.
 */
export function createGymRepo(db: Db, deps: Deps, repos: Repos, finish: FinishRepo) {
  const { newId, now } = deps;

  /** Planned sessions must follow the active gym and its rack (see finish.refreshPlannedSessions). */
  async function syncPlanned(): Promise<void> {
    const active = await repos.getActiveGymId();
    if (active) await finish.refreshPlannedSessions(active);
  }

  async function listGyms(): Promise<GymSummary[]> {
    const active = await repos.getActiveGymId();
    const gyms = await db.all<{ id: string; name: string; is_sample: number }>("SELECT id, name, is_sample FROM gym WHERE deleted_at IS NULL ORDER BY created_at, rowid");
    const out: GymSummary[] = [];
    for (const g of gyms) {
      const eq = await db.all<{ equipment: EquipmentType }>("SELECT equipment FROM gym_load WHERE gym_id = ? AND deleted_at IS NULL", [g.id]);
      const n = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM session WHERE gym_id = ? AND status = 'finished' AND deleted_at IS NULL", [g.id]);
      out.push({ id: g.id, name: g.name, isSample: g.is_sample === 1, isActive: g.id === active, equipment: eq.map((e) => e.equipment), finishedSessions: Number(n?.n ?? 0) });
    }
    return out;
  }

  async function getGym(id: string): Promise<GymDetail | null> {
    const g = await db.get<{ id: string; name: string; is_sample: number }>("SELECT id, name, is_sample FROM gym WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!g) return null;
    const fp = await repos.loadGymFingerprint(id);
    return { id: g.id, name: g.name, isSample: g.is_sample === 1, loads: fp.loads };
  }

  async function writeLoads(gymId: string, loads: GymLoadSpec[]): Promise<void> {
    const t = now();
    const keep = loads.map((l) => l.equipment);
    // Specs for equipment the gym no longer has are soft-deleted (history that used them stays readable).
    const existing = await db.all<{ id: string; equipment: EquipmentType }>("SELECT id, equipment FROM gym_load WHERE gym_id = ? AND deleted_at IS NULL", [gymId]);
    for (const row of existing) {
      if (!keep.includes(row.equipment)) await db.run("UPDATE gym_load SET deleted_at = ?, updated_at = ? WHERE id = ?", [t, t, row.id]);
    }
    for (const raw of loads) {
      const l = cleanSpec(raw);
      const row = existing.find((e) => e.equipment === l.equipment);
      const vals = [l.loads ? JSON.stringify(l.loads) : null, l.increment ?? null, l.min ?? null, l.max ?? null];
      if (row) await db.run("UPDATE gym_load SET loads_json = ?, increment = ?, min_load = ?, max_load = ?, updated_at = ? WHERE id = ?", [...vals, t, row.id]);
      else
        await db.run(
          `INSERT INTO gym_load (id, gym_id, equipment, loads_json, increment, min_load, max_load, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), gymId, l.equipment, ...vals, t, t],
        );
    }
  }

  /** Saves a new gym. The first real gym becomes the active one (unless `activate` says otherwise). */
  async function createGym(input: { name: string; loads: GymLoadSpec[]; activate?: boolean }): Promise<string> {
    const problems = validateGym(input.name, input.loads);
    if (problems.length > 0) throw new GymInvalid(problems);
    const id = await db.transaction(async () => {
      const t = now();
      const id = newId();
      await db.run("INSERT INTO gym (id, name, is_sample, created_at, updated_at) VALUES (?, ?, 0, ?, ?)", [id, input.name.trim(), t, t]);
      await writeLoads(id, input.loads);
      if (input.activate ?? true) await repos.setSetting("active_gym_id", id);
      return id;
    });
    if (input.activate ?? true) await syncPlanned();
    return id;
  }

  /** Replaces the name and loads. Editing the sample gym makes it the lifter's own (it stops being flagged as sample). */
  async function updateGym(id: string, input: { name: string; loads: GymLoadSpec[] }): Promise<void> {
    const problems = validateGym(input.name, input.loads);
    if (problems.length > 0) throw new GymInvalid(problems);
    const cur = await getGym(id);
    if (!cur) throw new Error("Unknown gym");
    await db.transaction(async () => {
      await db.run("UPDATE gym SET name = ?, is_sample = 0, updated_at = ? WHERE id = ?", [input.name.trim(), now(), id]);
      await writeLoads(id, input.loads);
    });
    if ((await repos.getActiveGymId()) === id) await syncPlanned();
  }

  /** A copy of the rack under a new name. History is NOT copied: another gym is another set of lines. */
  async function copyGym(sourceId: string, name: string, activate = false): Promise<string> {
    const src = await getGym(sourceId);
    if (!src) throw new Error("Unknown gym");
    return createGym({ name, loads: src.loads, activate });
  }

  async function setActiveGym(id: string): Promise<void> {
    if (!(await getGym(id))) throw new Error("Unknown gym");
    await repos.setSetting("active_gym_id", id);
    await syncPlanned();
  }

  /** Soft delete. The active gym and the last gym cannot be deleted; its sessions stay readable. */
  async function deleteGym(id: string): Promise<void> {
    const gyms = await listGyms();
    if (!gyms.some((g) => g.id === id)) throw new Error("Unknown gym");
    if (gyms.length <= 1) throw new Error("Cannot delete the only gym");
    if (gyms.find((g) => g.id === id)!.isActive) throw new Error("Switch to another gym before deleting this one");
    const t = now();
    await db.transaction(async () => {
      await db.run("UPDATE gym SET deleted_at = ?, updated_at = ? WHERE id = ?", [t, t, id]);
      await db.run("UPDATE gym_load SET deleted_at = ?, updated_at = ? WHERE gym_id = ? AND deleted_at IS NULL", [t, t, id]);
    });
  }

  return { listGyms, getGym, createGym, updateGym, copyGym, setActiveGym, deleteGym };
}
export type GymRepo = ReturnType<typeof createGymRepo>;
