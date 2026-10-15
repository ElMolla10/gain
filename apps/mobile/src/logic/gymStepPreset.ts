import type { EquipmentType, GymLoadSpec } from "@gain/engine";

/** Explicit rack preset for this gym; the missing 26 kg pair must not be proposed. */
export const dumbbellPairs = Array.from({ length: 25 }, (_, i) => (i + 1) * 2).filter((kg) => kg !== 26);
export const benchSteps: GymLoadSpec = { equipment: "barbell", increment: 10, min: 20, max: 200 };
export const plateMachineSteps: GymLoadSpec = { equipment: "machine", increment: 10, min: 10, max: 300 };

/** Do not infer a pin stack is plate-loaded from "Machine" alone. */
export function presetForExercise(name: string, equipment: EquipmentType): GymLoadSpec | null {
  if (equipment === "barbell" && /^(?:barbell\s+bench\s+press|bench\s+press\s*\(barbell\))$/i.test(name.trim())) return benchSteps;
  if (equipment === "machine" && /\b(?:plate[- ]loaded|machine plates)\b/i.test(name)) return plateMachineSteps;
  return null;
}
