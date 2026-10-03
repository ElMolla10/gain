/**
 * Timed and distance exercises in the screens: one "quantity" box that holds seconds (a hold) or metres (a carry) where a reps exercise
 * has its reps box. Pure helpers, no I/O, so the rules are tested without a phone.
 */
import type { Measure } from "@gain/engine";
import { normalizeDigits } from "./gymInput";
import { parseTyped } from "./setInput";

export const MAX_SECONDS = 3600;
export const MAX_METRES = 5000;

/** Seconds typed as "45", "90", or "1:30" (minutes:seconds). Whole seconds 1..3600; anything else (0, "1:75", junk) is null. */
export function parseSecondsInput(text: string): number | null {
  const clock = /^(\d{1,3}):(\d{1,2})$/.exec(normalizeDigits(text).trim());
  if (clock) {
    const mins = Number(clock[1]);
    const secs = Number(clock[2]);
    const total = mins * 60 + secs;
    return secs <= 59 && total >= 1 && total <= MAX_SECONDS ? total : null;
  }
  const n = parseTyped(text);
  return n !== null && Number.isInteger(n) && n >= 1 && n <= MAX_SECONDS ? n : null;
}

/** Metres, up to one decimal: above 0 and at most 5000. */
export function parseMetresInput(text: string): number | null {
  const n = parseTyped(text);
  if (n === null || !(n > 0) || n > MAX_METRES) return null;
  return Math.round(n * 10) / 10;
}

/** Parse the quantity box for how the exercise is counted. Reps exercises use the reps parser elsewhere; this returns null for them. */
export function parseQuantityInput(text: string, measure: Measure): number | null {
  if (measure === "time") return parseSecondsInput(text);
  if (measure === "distance") return parseMetresInput(text);
  return null;
}

/** The value shown in the box ("90" stays "90"; the box accepts "1:30" too). */
export const quantityBoxText = (q: number): string => String(q);

/** "45 s" / "30 m" (Arabic: "٤٥ ث" is not used: digits stay Latin like the rest of the logger; only the unit letter is localised). */
export function quantityText(q: number, measure: Measure, unitLetters: { s: string; m: string } = { s: "s", m: "m" }): string {
  if (measure === "time") return `${q} ${unitLetters.s}`;
  if (measure === "distance") return `${q} ${unitLetters.m}`;
  return String(q);
}

/** The set row's quantity: seconds for a hold, metres for a carry, else the reps. */
export function setQuantity(s: { reps: number; durationS?: number | null; distanceM?: number | null }, measure: Measure): number {
  if (measure === "time") return s.durationS ?? s.reps;
  if (measure === "distance") return s.distanceM ?? s.reps;
  return s.reps;
}

/** What to pass to logSet / updateLiveSet for the quantity box of an exercise counted in `measure`. */
export function quantityFields(q: number, measure: Measure): { reps: number; durationS?: number; distanceM?: number } {
  if (measure === "time") return { reps: 1, durationS: q };
  if (measure === "distance") return { reps: 1, distanceM: q };
  return { reps: q };
}

/** "PREVIOUS" cell of a timed row: "24kg x 45 s" with a load, else "45 s". */
export function previousQuantityText(
  lastWorking: readonly { load: number; reps: number; durationS?: number | null; distanceM?: number | null }[] | null,
  workingIndex: number | null,
  measure: Measure,
  loadText: (kg: number) => string,
  unitLetters: { s: string; m: string } = { s: "s", m: "m" },
): string {
  if (!lastWorking || workingIndex === null) return "—";
  const s = lastWorking[workingIndex];
  if (!s) return "—";
  const q = quantityText(setQuantity(s, measure), measure, unitLetters);
  return s.load > 0 ? `${loadText(s.load)} x ${q}` : q;
}

/** Is this exercise counted in seconds or metres? */
export const isTimed = (m: Measure): boolean => m === "time" || m === "distance";

/** "60 kg × 8" for a reps target; "45 s" or "24 kg × 45 s" for a hold / carry. `loadText` formats a load in the lifter's unit. */
export function targetPhrase(
  load: number,
  q: number,
  measure: Measure,
  loadText: (kg: number) => string,
  unitLetters: { s: string; m: string } = { s: "s", m: "m" },
): string {
  if (!isTimed(measure)) return `${loadText(load)} × ${q}`;
  const qt = quantityText(q, measure, unitLetters);
  return load > 0 ? `${loadText(load)} × ${qt}` : qt;
}

/** A stored target's number of seconds / metres / reps by how the exercise is counted (null = none). */
export function targetQuantity(tg: { reps: number | null; durationS?: number | null; distanceM?: number | null }, measure: Measure): number | null {
  if (measure === "time") return tg.durationS ?? null;
  if (measure === "distance") return tg.distanceM ?? null;
  return tg.reps;
}
