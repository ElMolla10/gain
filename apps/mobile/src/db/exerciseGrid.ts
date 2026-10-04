import { findSpec, type EquipmentType, type GymFingerprint, type GymLoadSpec } from "@gain/engine";
import { parseStoredLoads } from "../logic/exerciseLoads";
import type { Db } from "./driver";

/** The weights the lifter set for this exercise, or null when none are set (or the stored text is unusable). */
export async function exerciseOwnLoads(db: Db, exerciseId: string): Promise<GymLoadSpec | null> {
  const r = await db.get<{ equipment: EquipmentType; load_spec_json: string | null }>("SELECT equipment, load_spec_json FROM exercise WHERE id = ?", [exerciseId]);
  return r ? parseStoredLoads(r.load_spec_json, r.equipment) : null;
}

/** The grid of loadable weights for this exercise: its own when the lifter set them, else the gym's grid for its equipment (null = unknown). */
export async function gridFor(db: Db, gym: GymFingerprint, exerciseId: string, equipment: EquipmentType): Promise<GymLoadSpec | null> {
  return (await exerciseOwnLoads(db, exerciseId)) ?? findSpec(gym, equipment);
}
