import { ceilLoad, floorLoad, nextLoadAbove, nextLoadBelow, type GymLoadSpec } from "@gain/engine";
import { stepLoadKg, type Unit } from "./units";

/**
 * The load after one ± tap on the set row. The step is in the unit on screen (±2.5 kg or ±5 lb); the result is kilograms.
 * With the exercise's available loads known, the result snaps in the step's direction to a load the gym has
 * (100 kg +5 lb = 102.3 kg → 102.5 kg on a 2.5 kg grid), so a step never lands off-grid and always moves.
 * At the top of the list a + tap stays put. Without a spec the plain step is kept.
 */
export function stepLoadOnGrid(currentKg: number, delta: number, unit: Unit, spec: GymLoadSpec | null | undefined): number {
  const stepped = stepLoadKg(currentKg, delta, unit);
  if (!spec || delta === 0) return stepped;
  if (delta > 0) {
    const up = ceilLoad(spec, stepped);
    if (up !== null && up > currentKg) return up;
    return nextLoadAbove(spec, currentKg) ?? currentKg;
  }
  const down = floorLoad(spec, stepped, true);
  if (down !== null && down < currentKg) return down;
  return nextLoadBelow(spec, currentKg, true) ?? currentKg;
}
