import type { GymFingerprint, GymLoadSpec, SetupType } from "./types";

const EPS = 1e-6;

/** Remove float noise (22.500000001 -> 22.5). */
export const norm = (x: number): number => Math.round(x * 1000) / 1000;

export class InvalidGymLoadSpec extends Error {}

export function validateGymLoadSpec(spec: GymLoadSpec): void {
  const hasList = Array.isArray(spec.loads) && spec.loads.length > 0;
  const hasInc = typeof spec.increment === "number";
  if (!hasList && !hasInc) throw new InvalidGymLoadSpec(`${spec.equipment}: need loads or increment`);
  if (hasInc && !(spec.increment! > 0)) throw new InvalidGymLoadSpec(`${spec.equipment}: increment must be > 0`);
  if (hasList && spec.loads!.some((l) => !Number.isFinite(l) || l < 0))
    throw new InvalidGymLoadSpec(`${spec.equipment}: loads must be finite and >= 0`);
  if (spec.min !== undefined && spec.max !== undefined && spec.max < spec.min)
    throw new InvalidGymLoadSpec(`${spec.equipment}: max < min`);
}

/** Zero is a real rung for bodyweight (no added load) and assisted (no assistance) lines, never for free weights. */
export const allowsZero = (setup: SetupType): boolean => setup !== "free";

function gridMin(spec: GymLoadSpec): number {
  if (spec.min !== undefined) return spec.min;
  return spec.equipment === "assisted" ? 0 : (spec.increment ?? 0);
}

function sortedList(spec: GymLoadSpec, zero: boolean): number[] {
  const set = new Set<number>((spec.loads ?? []).map(norm));
  if (zero) set.add(0);
  return [...set].sort((a, b) => a - b);
}

/** Greatest load that exists and is <= x, or null if none. */
export function floorLoad(spec: GymLoadSpec, x: number, zero = false): number | null {
  validateGymLoadSpec(spec);
  if (spec.loads && spec.loads.length > 0) {
    const list = sortedList(spec, zero).filter((l) => spec.max === undefined || l <= spec.max + EPS);
    let best: number | null = null;
    for (const l of list) if (l <= x + EPS) best = l;
    return best;
  }
  const inc = spec.increment!;
  const min = gridMin(spec);
  if (x < min - EPS) return zero && x >= -EPS ? 0 : null;
  let k = Math.floor((x - min) / inc + EPS);
  if (spec.max !== undefined) k = Math.min(k, Math.floor((spec.max - min) / inc + EPS));
  if (k < 0) return null;
  return norm(min + k * inc);
}

/** Least load that exists and is >= x, or null if none (above max). */
export function ceilLoad(spec: GymLoadSpec, x: number, zero = false): number | null {
  validateGymLoadSpec(spec);
  if (spec.loads && spec.loads.length > 0) {
    const list = sortedList(spec, zero).filter((l) => spec.max === undefined || l <= spec.max + EPS);
    for (const l of list) if (l >= x - EPS) return l;
    return null;
  }
  const inc = spec.increment!;
  const min = gridMin(spec);
  if (x <= min + EPS) return zero && x <= EPS ? 0 : min;
  const k = Math.ceil((x - min) / inc - EPS);
  const r = norm(min + k * inc);
  if (spec.max !== undefined && r > spec.max + EPS) return null;
  return r;
}

export function isGymLoad(spec: GymLoadSpec, x: number, zero = false): boolean {
  const f = floorLoad(spec, x, zero);
  return f !== null && Math.abs(f - x) < EPS;
}

export type RoundMode = "nearest" | "down" | "up";

/**
 * Round a wanted load to a load that exists in this gym.
 * `nearest` ties go DOWN (the lighter, safer load). Returns `load: null` if nothing fits (e.g. `up` above the max).
 */
export function roundToGymLoad(
  spec: GymLoadSpec,
  target: number,
  opts: { mode?: RoundMode; zero?: boolean } = {},
): { load: number | null; exact: boolean } {
  const mode = opts.mode ?? "nearest";
  const zero = opts.zero ?? false;
  const lo = floorLoad(spec, target, zero);
  const hi = ceilLoad(spec, target, zero);
  const exact = lo !== null && Math.abs(lo - target) < EPS;
  if (exact) return { load: lo, exact: true };
  let load: number | null;
  if (mode === "down") load = lo ?? hi;
  else if (mode === "up") load = hi ?? lo;
  else if (lo === null) load = hi;
  else if (hi === null) load = lo;
  else load = target - lo <= hi - target + EPS ? lo : hi;
  return { load, exact: false };
}

/** Next load that exists strictly above x, or null. */
export function nextLoadAbove(spec: GymLoadSpec, x: number, zero = false): number | null {
  const v = norm(x);
  const c = ceilLoad(spec, v + 1e-4, zero);
  return c !== null && c > v + EPS ? c : null;
}

/** Next load that exists strictly below x, or null. */
export function nextLoadBelow(spec: GymLoadSpec, x: number, zero = false): number | null {
  const v = norm(x);
  const f = floorLoad(spec, v - 1e-4, zero);
  return f !== null && f < v - EPS ? f : null;
}

export function findSpec(gym: GymFingerprint, equipment: GymLoadSpec["equipment"]): GymLoadSpec | null {
  return gym.loads.find((l) => l.equipment === equipment) ?? null;
}

/** Every load that exists up to `upTo` (needed for increment grids). */
export function listLoads(spec: GymLoadSpec, upTo?: number, zero = false): number[] {
  validateGymLoadSpec(spec);
  if (spec.loads && spec.loads.length > 0) {
    return sortedList(spec, zero).filter(
      (l) => (spec.max === undefined || l <= spec.max + EPS) && (upTo === undefined || l <= upTo + EPS),
    );
  }
  const bound = upTo ?? spec.max;
  if (bound === undefined) throw new InvalidGymLoadSpec("listLoads on an increment grid needs upTo or max");
  const out: number[] = [];
  if (zero && gridMin(spec) > 0) out.push(0);
  for (let l = gridMin(spec); l <= bound + EPS && (spec.max === undefined || l <= spec.max + EPS); l += spec.increment!) {
    out.push(norm(l));
  }
  return out;
}
