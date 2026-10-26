import { barbellPlates, roundToGymLoad, type GymLoadSpec, type PlateCalc } from "@gain/engine";
import { defaultGymLoads } from "./defaultGym";
import { formatLoad, type Lang } from "../i18n/format";
import type { Unit } from "./units";

/** Plates line for a barbell load, numbers LTR-isolated with an NBSP and the unit in the lifter's language ("15 كجم" in Arabic, never "kg"). Null when the spec is not a barbell or the load is below the bar. */
export function plateLine(spec: GymLoadSpec | null | undefined, load: number | null, unit: Unit, lang: Lang, t: (key: "plates.each" | "plates.nearest" | "plates.bar", p?: Record<string, string | number>) => string): { calc: PlateCalc; text: string } | null {
  if (!spec || spec.equipment !== "barbell" || load === null || !(load > 0)) return null;
  const calc = barbellPlates(spec, load);
  if (!calc) return null;
  const parts = calc.perSide.map((p) => formatLoad(p, lang, unit)).join(" + ");
  if (calc.perSide.length === 0) return { calc, text: t("plates.bar") };
  if (calc.exact) return { calc, text: t("plates.each", { plates: parts }) };
  return { calc, text: t("plates.nearest", { load: formatLoad(calc.load, lang, unit), plates: parts }) };
}

/**
 * Plates for a display-only barbell (Goals hero, session post-mortem): the default kg-based bar for the lifter's unit
 * (lb = a 45 lb bar and pound plates, all in kilograms), solved on the kg load snapped to that bar's grid. perSide is in kg (BarArt draws kg);
 * text formats each plate in the lifter's unit. Below the bar, or with no bar spec: no plates and "bar".
 */
export function displayBarPlates(kg: number | null, unit: Unit, lang: Lang, t: Parameters<typeof plateLine>[4]): { perSide: number[]; text: string } {
  const spec = defaultGymLoads(unit).find((s) => s.equipment === "barbell");
  if (!spec || kg === null || kg < (spec.min ?? 0)) return { perSide: [], text: t("plates.bar") };
  // A goal e1RM is any number: put it on the bar's grid first (100 kg in lb → 220 lb), so the plates are the usual ones
  // (45 + 35 + 5 + 2.5 lb) rather than the closest odd mix. Logged loads are already on the grid and stay unchanged.
  const onGrid = roundToGymLoad(spec, kg).load ?? kg;
  const line = plateLine(spec, onGrid, unit, lang, t);
  return line ? { perSide: line.calc.perSide, text: line.text } : { perSide: [], text: t("plates.bar") };
}
