// Bidi-safe display strings (docs/DESIGN.md "RTL and numbers"). Rule: never force LTR on, or isolate, a string that contains Arabic;
// build it in the language's direction and isolate only the pure-number runs.
import { formatLoad, isolateLtr, NBSP, type Lang } from "../i18n/format";
import { isTimed, quantityText, setQuantity, targetQuantity } from "./quantity";
import { previousText } from "./liveSummary";
import { weightText, type Unit } from "./units";

type Measure = Parameters<typeof isTimed>[0];
type Letters = { s: string; m: string };

/** U+2013, the range dash: "6–10". */
export const EN_DASH = "\u2013";

/** Planned scheme "3 × 6–10" (timed: "3 × 30–45 s"), isolated so it reads the same in both languages. */
export function plannedScheme(sets: number, repMin: number, repMax: number, measure: Measure, letters: Letters): string {
  const max = measure === "reps" ? String(repMax) : quantityText(repMax, measure, letters);
  return isolateLtr(`${sets}${NBSP}×${NBSP}${repMin}${EN_DASH}${max}`);
}

/**
 * A load target in the language's order: "55 kg × 9" / "55 كجم × 9" (read from the right), timed "24 kg × 45 s" or just "45 s".
 * Built like the logger's target line: `formatLoad` (number isolated, unit in the language) then the isolated quantity. Render it
 * WITHOUT `ltr` and never wrap the whole string in `isolateLtr`.
 */
export function loadTargetText(load: number, q: number | string, measure: Measure, lang: Lang, unit: Unit, letters: Letters): string {
  if (!isTimed(measure)) return `${formatLoad(load, lang, unit)}${NBSP}×${NBSP}${isolateLtr(String(q))}`;
  const qt = isolateLtr(quantityText(Number(q), measure, letters));
  return load > 0 ? `${formatLoad(load, lang, unit)}${NBSP}×${NBSP}${qt}` : qt;
}

/** `loadTargetText` for a stored or previewed target row (reps, seconds or metres by measure). */
export function targetRowText(
  tg: { measure: Measure; reps: number | null; durationS?: number | null; distanceM?: number | null; effectiveLoad: number | null },
  lang: Lang,
  unit: Unit,
  letters: Letters,
): string {
  const q = isTimed(tg.measure) ? targetQuantity(tg, tg.measure) ?? 0 : tg.reps ?? "";
  return loadTargetText(tg.effectiveLoad ?? 0, q, tg.measure, lang, unit, letters);
}

/**
 * The logger's PREVIOUS cell, unitless (the KG / LB column header beside it already names the unit): "55 × 10", timed "10 × 35 s" or
 * "40 s". Pure Latin digits, so it is isolated as a whole and may be drawn `ltr`. A dash when there is nothing to compare.
 */
export function previousCellText(
  lastWorking: readonly { load: number; reps: number; durationS?: number | null; distanceM?: number | null }[] | null,
  workingIndex: number | null,
  measure: Measure,
  unit: Unit,
  letters: Letters,
): string {
  if (!lastWorking || workingIndex === null) return "—";
  const s = lastWorking[workingIndex];
  if (!s) return "—";
  if (!isTimed(measure)) return isolateLtr(previousText(lastWorking, workingIndex, unit));
  const q = quantityText(setQuantity(s, measure), measure, letters);
  return isolateLtr(s.load > 0 ? `${weightText(s.load, unit)}${NBSP}×${NBSP}${q}` : q);
}
