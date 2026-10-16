import { barbellPlates, type GymLoadSpec, type PlateCalc } from "@gain/engine";
import { weightText, type Unit } from "./units";

/** Plates line for a barbell load, numbers LTR-isolated. Null when the spec is not a barbell or the load is below the bar. */
export function plateLine(spec: GymLoadSpec | null | undefined, load: number | null, unit: Unit, t: (key: "plates.each" | "plates.nearest" | "plates.bar", p?: Record<string, string | number>) => string): { calc: PlateCalc; text: string } | null {
  if (!spec || spec.equipment !== "barbell" || load === null || !(load > 0)) return null;
  const calc = barbellPlates(spec, load);
  if (!calc) return null;
  const unitLabel = unit === "lb" ? "lb" : "kg";
  const parts = calc.perSide.map((p) => `${weightText(p, unit)} ${unitLabel}`).join(" + ");
  if (calc.perSide.length === 0) return { calc, text: t("plates.bar") };
  if (calc.exact) return { calc, text: t("plates.each", { plates: parts }) };
  return { calc, text: t("plates.nearest", { load: weightText(calc.load, unit), plates: parts }) };
}
