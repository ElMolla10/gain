import { findSpec, type EquipmentType, type GymFingerprint, type GymLoadSpec, type SetupType } from "@gain/engine";
import { parseStoredLoads } from "../logic/exerciseLoads";
import { machineLoads } from "../logic/machineLoadKind";
import type { Db } from "./driver";

export type LoadSource = "line" | "exercise" | "gym";
export interface ResolvedLoads {
  spec: GymLoadSpec | null;
  source: LoadSource;
}

/** The weights the lifter set for this machine at this gym (this exercise + gym + setup line), or null. */
export async function lineOwnLoads(db: Db, exerciseId: string, gymId: string, setup: SetupType): Promise<GymLoadSpec | null> {
  const r = await db.get<{ equipment: EquipmentType; load_spec_json: string | null }>(
    `SELECT e.equipment, l.load_spec_json FROM exercise_line l JOIN exercise e ON e.id = l.exercise_id
     WHERE l.exercise_id = ? AND l.gym_id = ? AND l.setup = ? AND l.deleted_at IS NULL`,
    [exerciseId, gymId, setup],
  );
  return r ? parseStoredLoads(r.load_spec_json, r.equipment) : null;
}

/** The weights the lifter set for this exercise, or null when none are set (or the stored text is unusable). */
export async function exerciseOwnLoads(db: Db, exerciseId: string): Promise<GymLoadSpec | null> {
  const r = await db.get<{ equipment: EquipmentType; load_spec_json: string | null }>("SELECT equipment, load_spec_json FROM exercise WHERE id = ?", [exerciseId]);
  return r ? (r.equipment === "machine" ? machineLoads(r.load_spec_json) : parseStoredLoads(r.load_spec_json, r.equipment)) : null;
}

/**
 * Line (this machine at this gym) → this exercise's own weights → the gym's grid for its equipment.
 * A logged weight that is not on the grid stays valid; only suggestions and the plate calculator use this lookup.
 */
export async function resolveLoads(db: Db, gym: GymFingerprint, exerciseId: string, equipment: EquipmentType, setup?: SetupType): Promise<ResolvedLoads> {
  if (setup) {
    const line = await lineOwnLoads(db, exerciseId, gym.gymId, setup);
    if (line) return { spec: line, source: "line" };
  }
  const own = await exerciseOwnLoads(db, exerciseId);
  if (own) return { spec: own, source: "exercise" };
  return { spec: findSpec(gym, equipment), source: "gym" };
}

/** The grid of loadable weights for this exercise: line, then own, else the gym's grid for its equipment (null = unknown). */
export async function gridFor(db: Db, gym: GymFingerprint, exerciseId: string, equipment: EquipmentType, setup?: SetupType): Promise<GymLoadSpec | null> {
  return (await resolveLoads(db, gym, exerciseId, equipment, setup)).spec;
}

export async function attachLoads<T extends { exerciseId: string; equipment: EquipmentType; setup: SetupType }>(
  db: Db,
  gym: GymFingerprint,
  slots: T[],
): Promise<(T & { loadSpec: GymLoadSpec | null; loadSource: LoadSource })[]> {
  return Promise.all(slots.map(async (s) => {
    const r = await resolveLoads(db, gym, s.exerciseId, s.equipment, s.setup);
    return { ...s, loadSpec: r.spec, loadSource: r.source };
  }));
}
