import type { EquipmentType, GymLoadSpec } from "@gain/engine";
import { GYM_EQUIPMENT, parseNumber, parseNumberList, validateGym, type GymProblem } from "./gymInput";
import { kgToUnit, numberText, unitToKgKnown, type Unit } from "./units";

/** What one equipment section of the gym form holds while the lifter types. Text fields stay text until saved. */
export interface EquipmentForm {
  enabled: boolean;
  /** "list": the exact loads that exist (dumbbell pairs, a pin stack). "grid": a step from a first rung. */
  mode: "list" | "grid";
  listText: string;
  incrementText: string;
  /** First rung: the empty bar for a barbell, the lightest load otherwise. */
  minText: string;
  maxText: string;
}

export type GymForm = Record<EquipmentType, EquipmentForm>;

export const defaultMode = (e: EquipmentType): "list" | "grid" => (e === "dumbbell" ? "list" : "grid");

export const emptyEquipmentForm = (e: EquipmentType): EquipmentForm => ({ enabled: false, mode: defaultMode(e), listText: "", incrementText: "", minText: "", maxText: "" });

export function emptyForm(enabled: EquipmentType[] = []): GymForm {
  const f = {} as GymForm;
  for (const e of GYM_EQUIPMENT) f[e] = { ...emptyEquipmentForm(e), enabled: enabled.includes(e) };
  return f;
}

/** The form for saved loads (always kg), with every number shown in `unit`. */
export function formFromLoads(loads: GymLoadSpec[], unit: Unit = "kg"): GymForm {
  const f = emptyForm();
  const show = (x: number): string => numberText(kgToUnit(x, unit));
  for (const l of loads) {
    f[l.equipment] = {
      enabled: true,
      mode: l.loads && l.loads.length > 0 ? "list" : "grid",
      listText: l.loads ? l.loads.map(show).join(", ") : "",
      incrementText: l.increment !== undefined ? show(l.increment) : "",
      minText: l.min !== undefined ? show(l.min) : "",
      maxText: l.max !== undefined ? show(l.max) : "",
    };
  }
  return f;
}

/** Every kilogram number a saved spec holds: typed lb values that equal how one of these shows map back to it exactly. */
const knownKg = (original: GymLoadSpec[] | undefined, e: EquipmentType): number[] => {
  const o = original?.find((x) => x.equipment === e);
  return o ? [...(o.loads ?? []), ...[o.increment, o.min, o.max].filter((x): x is number => x !== undefined)] : [];
};

export type FormProblem = GymProblem;

export interface FormResult {
  loads: GymLoadSpec[];
  problems: FormProblem[];
}

/**
 * Turns the form into specs in kilograms. Nothing is invented: an empty required field is a problem, not a default.
 * Numbers are read in `unit`; `original` (the gym as saved, kg) lets an unchanged lb number keep its exact stored kg value.
 */
export function loadsFromForm(name: string, form: GymForm, unit: Unit = "kg", original?: GymLoadSpec[]): FormResult {
  const loads: GymLoadSpec[] = [];
  const problems: FormProblem[] = [];
  for (const e of GYM_EQUIPMENT) {
    const f = form[e];
    if (!f.enabled) continue;
    const known = knownKg(original, e);
    const kg = (x: number): number => unitToKgKnown(x, unit, known);
    const spec: GymLoadSpec = { equipment: e };
    if (f.mode === "list") {
      const { values, invalid } = parseNumberList(f.listText);
      if (invalid.length > 0) problems.push({ code: "number_invalid", equipment: e, detail: invalid });
      if (values.length === 0) problems.push({ code: "list_empty", equipment: e });
      else spec.loads = [...new Set(values.map(kg))].sort((a, b) => a - b);
    } else {
      const inc = parseNumber(f.incrementText);
      if (inc === null || !(inc > 0)) problems.push({ code: "increment_bad", equipment: e });
      else spec.increment = kg(inc);
      const min = f.minText.trim() === "" ? undefined : parseNumber(f.minText);
      if (min === null) problems.push({ code: "number_invalid", equipment: e, detail: [f.minText] });
      else if (min !== undefined) spec.min = kg(min);
      else if (e === "barbell") problems.push({ code: "min_required", equipment: e });
      const max = f.maxText.trim() === "" ? undefined : parseNumber(f.maxText);
      if (max === null) problems.push({ code: "number_invalid", equipment: e, detail: [f.maxText] });
      else if (max !== undefined) spec.max = kg(max);
    }
    loads.push(spec);
  }
  const hasFormProblem = problems.length > 0;
  // Engine-level rules (range, duplicates, rung caps) only when every field parsed, so one typo is not reported twice.
  if (!hasFormProblem) problems.push(...validateGym(name, loads));
  else if (name.trim() === "") problems.push({ code: "name_empty" });
  return { loads, problems };
}
