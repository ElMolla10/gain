import type { ReasonText } from "@gain/engine";

/**
 * Weight units: a DISPLAY and INPUT layer on top of the kilogram engine.
 * Everything stored and everything the engine sees is kilograms. The lifter's unit (kg by default, or lb) only decides how
 * a weight is shown and how a typed weight is turned back into kilograms. Pure functions, no I/O.
 */
export type Unit = "kg" | "lb";
export const UNITS: Unit[] = ["kg", "lb"];
export const DEFAULT_UNIT: Unit = "kg";

/** Exact by definition (international avoirdupois pound). */
export const KG_PER_LB = 0.45359237;
export const LB_PER_KG = 1 / KG_PER_LB;

export const parseUnit = (s: string | null | undefined): Unit => (s === "lb" ? "lb" : "kg");

/** Strip float noise: 1e-3 for kilograms (a 0.625 kg plate pair exists), 0.1 for pounds (nothing finer is ever loaded). */
const round = (x: number, step: number): number => Math.round(x / step) * step;
const clean = (x: number): number => Math.round(x * 1000) / 1000;

/** A kilogram weight as a number in `unit`. Pounds are rounded to 0.1 lb: 20 kg -> 44.1, 2.268 kg -> 5. */
export function kgToUnit(kg: number, unit: Unit): number {
  return unit === "kg" ? clean(kg) : clean(round(kg * LB_PER_KG, 0.1));
}

/**
 * A weight typed in `unit` as kilograms for storage, at the engine's own precision (3 decimals; the engine rounds every
 * load it computes to that, so finer stored steps would not line up with its grid). A 5 lb step is stored as 2.268 kg and
 * stays a 5 lb step (to 0.1 lb) across a whole bar.
 */
export function unitToKg(value: number, unit: Unit): number {
  return unit === "kg" ? clean(value) : clean(value * KG_PER_LB);
}

/**
 * Typed weight -> kilograms, but a value that is just the display of a kilogram value the lifter already has
 * (e.g. "44.1" is how a 20 kg bar shows in lb) maps back to that exact stored value. Opening and saving an unchanged
 * gym in lb mode must not move any load by a few grams.
 */
export function unitToKgKnown(value: number, unit: Unit, known: readonly number[]): number {
  if (unit === "kg") return clean(value);
  const hit = known.find((k) => kgToUnit(k, "lb") === value);
  return hit !== undefined ? hit : unitToKg(value, "lb");
}

/** The number as text: no trailing zeros, "." as the decimal mark. */
export const numberText = (n: number): string => String(n);

/** "44.1" for a kilogram weight shown in `unit` (no unit label). */
export const weightText = (kg: number, unit: Unit): string => numberText(kgToUnit(kg, unit));

/** Short unit label. Arabic labels are a DRAFT for review by Egyptian lifters. */
export function unitLabel(unit: Unit, lang: "en" | "ar"): string {
  if (lang === "ar") return unit === "kg" ? "كجم" : "باوند";
  return unit;
}

/** Reason params that are weights in kilograms (see the engine's reason templates). */
const REASON_WEIGHT_PARAMS = ["load", "prevLoad", "nextLoad"] as const;

/**
 * An engine reason (always in kilograms) re-expressed in the lifter's unit, ready for `renderReason`.
 * Only the load params and the unit label change; reps, counts and percentages are left alone.
 */
export function localizeReason(reason: ReasonText, unit: Unit, lang: "en" | "ar"): ReasonText {
  const params: ReasonText["params"] = { ...reason.params };
  for (const k of REASON_WEIGHT_PARAMS) {
    const v = params[k];
    if (typeof v === "number") params[k] = kgToUnit(v, unit);
  }
  if ("unit" in params) params.unit = unitLabel(unit, lang);
  return { ...reason, params };
}

/** A load typed while editing a stored kilogram value: unchanged display means unchanged value (no drift of a few grams in lb). */
export const editedKg = (typed: number, origKg: number, unit: Unit): number => (typed === kgToUnit(origKg, unit) ? origKg : unitToKg(typed, unit));
