import { normalizeDigits } from "./gymInput";
import { kgToUnit, unitToKg, type Unit } from "./units";

/** Same limits the history editor uses, so a typo like 1000 reps can never be saved from the logger either. */
export const MAX_LOAD_KG = 1000;
export const MAX_REPS = 100;

/** One decimal number from typed text: Arabic-Indic digits and "٫" or one "," accepted as the decimal mark. Junk and "" are null. */
export function parseTyped(text: string): number | null {
  let s = normalizeDigits(text).trim().replace(/\u066C/g, "");
  if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * A weight typed in the lifter's unit as kilograms. Typing exactly what the current value shows ("44.1" for a 20 kg bar in lb)
 * gives that stored kilogram value back, so a field that was only looked at never moves a load by a few grams.
 */
export function parseLoadInput(text: string, unit: Unit, currentKg: number | null = null): number | null {
  const n = parseTyped(text);
  if (n === null) return null;
  const kg = currentKg !== null && kgToUnit(currentKg, unit) === n ? currentKg : unitToKg(n, unit);
  return kg >= 0 && kg <= MAX_LOAD_KG ? kg : null;
}

/** Whole reps, 1..100. "8.5", "0", "" and junk are null. */
export function parseRepsInput(text: string): number | null {
  const n = parseTyped(text);
  return n !== null && Number.isInteger(n) && n >= 1 && n <= MAX_REPS ? n : null;
}

/** Reps left in the tank: a whole number 0..10 (empty = not tracked, which the field reports as null too). */
export function parseRirInput(text: string): number | null {
  const n = parseTyped(text);
  return n !== null && Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
}
