import { norm } from "./loads";
import type { GymLoadSpec } from "./types";

const EPS = 1e-6;
const LB_PER_KG = 0.45359237;
const LB5_KG = 5 * LB_PER_KG;
const MAX_PER_SIDE = 12;

/** Standard kg plate denominations derived from a 2.5 kg barbell jump (1.25 kg each side). */
export const KG_PLATES = [1.25, 2.5, 5, 10, 15, 20, 25];
/** Standard lb plate denominations, stored in kilograms. */
export const LB_PLATES_KG = [2.5, 5, 10, 25, 35, 45].map((lb) => Math.round(lb * LB_PER_KG * 100) / 100);

/**
 * Plate denominations (kg) implied by a barbell increment. Never invents sizes the increment cannot make:
 * a 2.5 kg jump → 1.25 / 2.5 / 5 / 10 / 15 / 20 / 25; a 5 lb jump → the usual lb plates.
 */
export function derivePlates(increment: number): number[] {
  if (!(increment > 0)) return [];
  if (Math.abs(increment - LB5_KG) < 0.05) return [...LB_PLATES_KG];
  const small = norm(increment / 2);
  if (!(small > 0)) return [];
  return [1, 2, 4, 8, 12, 16, 20].map((m) => norm(small * m));
}

/** Plates this barbell spec may use: the gym's own list, else derived from its increment. */
export function platesOf(spec: GymLoadSpec): number[] {
  if (spec.plates && spec.plates.length > 0) return [...new Set(spec.plates.map(norm))].filter((p) => p > 0).sort((a, b) => a - b);
  if (spec.increment !== undefined) return derivePlates(spec.increment);
  return [];
}

export interface PlateCalc {
  bar: number;
  target: number;
  /** Total load that can be loaded with these plates (may differ from target). */
  load: number;
  exact: boolean;
  /** Plates on ONE side, heaviest first. Empty = empty bar. */
  perSide: number[];
}

/**
 * Plates on each side of `bar` that make `target` (or the nearest load these plates can make).
 * Uses only `plates` (denominations, unlimited copies of each). Returns null when the bar itself is heavier than the target.
 */
export function calculatePlates(target: number, bar: number, plates: number[]): PlateCalc | null {
  if (!(bar >= 0) || !(target >= 0)) return null;
  const side = (target - bar) / 2;
  if (side < -EPS) return null;
  if (side <= EPS) return { bar, target, load: bar, exact: Math.abs(target - bar) < EPS, perSide: [] };

  const denoms = [...new Set(plates.map(norm))].filter((p) => p > 0).sort((a, b) => b - a);
  if (denoms.length === 0) return { bar, target, load: bar, exact: false, perSide: [] };

  const scale = 1000;
  const coins = denoms.map((p) => Math.round(p * scale));
  const want = Math.round(side * scale);
  const cap = want + Math.max(...coins, 0);
  const INF = 99;
  const used = new Uint8Array(cap + 1);
  const parent = new Int32Array(cap + 1);
  used.fill(INF);
  parent.fill(-1);
  used[0] = 0;
  for (let a = 0; a <= cap; a++) {
    const ua = used[a] ?? INF;
    if (ua >= MAX_PER_SIDE) continue;
    for (const c of coins) {
      const n = a + c;
      if (n > cap) continue;
      const un = used[n] ?? INF;
      if (ua + 1 < un) {
        used[n] = ua + 1;
        parent[n] = c;
      }
    }
  }

  let bestAmt = 0;
  let bestErr = want;
  for (let a = 0; a <= cap; a++) {
    if ((used[a] ?? INF) >= INF) continue;
    const err = Math.abs(a - want);
    if (err < bestErr || (err === bestErr && a < bestAmt)) {
      bestErr = err;
      bestAmt = a;
    }
  }

  const perSide: number[] = [];
  for (let a = bestAmt; a > 0; ) {
    const c = parent[a]!;
    if (c <= 0) break;
    perSide.push(c / scale);
    a -= c;
  }
  perSide.sort((a, b) => b - a);
  const load = norm(bar + (2 * bestAmt) / scale);
  return { bar, target, load, exact: Math.abs(load - target) < 0.05, perSide };
}

/** Plate math for a barbell spec: bar is `min` (Olympic 20 kg when omitted). */
export function barbellPlates(spec: GymLoadSpec, target: number): PlateCalc | null {
  const bar = spec.min ?? 20;
  return calculatePlates(target, bar, platesOf(spec));
}
