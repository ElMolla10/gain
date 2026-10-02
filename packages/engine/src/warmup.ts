import { ceilLoad, roundToGymLoad } from "./loads";
import type { GymLoadSpec, SetupType } from "./types";

export interface WarmupStep {
  pct: number;
  reps: number;
}

export const DEFAULT_WARMUP_STEPS: WarmupStep[] = [
  { pct: 0.5, reps: 8 },
  { pct: 0.7, reps: 5 },
  { pct: 0.85, reps: 3 },
];

export interface WarmupSet {
  load: number;
  reps: number;
  warmup: true;
}

export interface WarmupPlan {
  sets: WarmupSet[];
  /** Why the list is empty, or null. */
  skipped: null | "assisted_line" | "working_load_too_light" | "no_gym_loads";
}

/**
 * Warm-up sets from the working load just decided, rounded to loads that exist in the gym.
 * They are logged with warmup=true and never drive progression. Each warm-up is strictly heavier than the last and
 * strictly lighter than the working load. Barbell-style grids open with the empty bar when the working load is >= 1.5x the bar.
 */
export function generateWarmups(
  workingLoad: number,
  spec: GymLoadSpec | null,
  opts: { setup?: SetupType; steps?: WarmupStep[]; maxSets?: number } = {},
): WarmupPlan {
  const setup = opts.setup ?? "free";
  if (setup === "assisted") return { sets: [], skipped: "assisted_line" };
  if (!spec) return { sets: [], skipped: "no_gym_loads" };
  const zero = setup === "bodyweight_plus_added";
  const steps = opts.steps ?? DEFAULT_WARMUP_STEPS;
  const maxSets = opts.maxSets ?? steps.length + 1;
  if (!(workingLoad > 0)) return { sets: [], skipped: "working_load_too_light" };

  const lowest = ceilLoad(spec, 0, false);
  const out: WarmupSet[] = [];
  const push = (load: number | null, reps: number) => {
    if (load === null) return;
    if (load >= workingLoad - 1e-6) return;
    if (out.length > 0 && load <= out[out.length - 1]!.load + 1e-6) return;
    if (load <= 0 && !zero) return;
    out.push({ load, reps, warmup: true });
  };

  // Empty bar opener for barbell-style grids with a real bar (min set), only for free lines.
  if (setup === "free" && spec.equipment === "barbell" && spec.min !== undefined) {
    if (workingLoad >= spec.min * 1.5) push(spec.min, 10);
  }

  for (const step of steps) {
    const r = roundToGymLoad(spec, workingLoad * step.pct, { mode: "nearest", zero });
    let load = r.load;
    if (load !== null && lowest !== null && !zero && load < lowest) load = lowest;
    push(load, step.reps);
  }

  const trimmed = out.slice(0, maxSets);
  return { sets: trimmed, skipped: trimmed.length === 0 ? "working_load_too_light" : null };
}
