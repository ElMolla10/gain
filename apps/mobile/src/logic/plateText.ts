import { barbellPlates, type GymLoadSpec, type PlateCalc } from "@gain/engine";
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
