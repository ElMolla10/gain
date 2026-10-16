import { allowsZero, roundToGymLoad } from "./loads";
import type { EquipmentType, GymLoadSpec, SetupType } from "./types";

const ISOLATION = new Set([
  "shoulder_isolation",
  "rear_delt",
  "elbow_extension",
  "elbow_flexion",
  "knee_extension",
  "knee_flexion",
  "calf",
]);

/** Conservative first-session loads (kg) when there is no history. Empty bar / light dumbbell, never a guessed max. */
const TABLE: Record<EquipmentType, { compound: number; isolation: number }> = {
  barbell: { compound: 20, isolation: 10 },
  dumbbell: { compound: 8, isolation: 4 },
  machine: { compound: 20, isolation: 10 },
  cable: { compound: 15, isolation: 10 },
  plate: { compound: 0, isolation: 0 },
  assisted: { compound: 0, isolation: 0 },
};

export interface StartingLoadInput {
  pattern: string;
  equipment: EquipmentType;
  setup: SetupType;
  bodyweightKg?: number | null;
  spec?: GymLoadSpec | null;
}

export interface StartingEstimate {
  load: number;
  /** Always true: this is a labeled prefill, never written as history by itself. */
  estimated: true;
}

export const isIsolationPattern = (pattern: string): boolean => ISOLATION.has(pattern);

function tableLoad(p: StartingLoadInput): number {
  const kind = isIsolationPattern(p.pattern) ? "isolation" : "compound";
  let load = TABLE[p.equipment][kind];
  const bw = p.bodyweightKg;
  if (typeof bw === "number" && bw >= 30 && bw <= 300) {
    const frac = kind === "compound" ? (p.equipment === "barbell" ? 0.25 : 0.08) : 0.05;
    load = Math.min(load, Math.max(0, bw * frac));
  }
  if (p.setup !== "free") return 0;
  return load;
}

/**
 * A conservative first weight for an exercise with no history. Snapped down to a gym load when the gym is known.
 * Returns null only when a free-weight line has no positive load that exists (should not happen on a standard rack).
 */
export function estimateStartingLoad(p: StartingLoadInput): StartingEstimate | null {
  const wanted = tableLoad(p);
  const zero = allowsZero(p.setup);
  if (p.spec) {
    const snapped = roundToGymLoad(p.spec, wanted, { mode: "down", zero });
    if (snapped.load !== null) return { load: snapped.load, estimated: true };
    if (zero) return { load: 0, estimated: true };
    return null;
  }
  if (zero) return { load: 0, estimated: true };
  const step = 2.5;
  return { load: Math.max(step, Math.floor(wanted / step) * step) || step, estimated: true };
}
