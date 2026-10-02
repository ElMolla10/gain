import type { EquipmentType, GymLoadSpec } from "@gain/engine";
import { GYM_EQUIPMENT, parseNumber, parseNumberList, validateGym, type GymProblem } from "./gymInput";

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

export function formFromLoads(loads: GymLoadSpec[]): GymForm {
  const f = emptyForm();
  for (const l of loads) {
    f[l.equipment] = {
      enabled: true,
      mode: l.loads && l.loads.length > 0 ? "list" : "grid",
      listText: l.loads ? l.loads.join(", ") : "",
      incrementText: l.increment !== undefined ? String(l.increment) : "",
      minText: l.min !== undefined ? String(l.min) : "",
      maxText: l.max !== undefined ? String(l.max) : "",
    };
  }
  return f;
}

export type FormProblem = GymProblem;

export interface FormResult {
  loads: GymLoadSpec[];
  problems: FormProblem[];
}

/** Turns the form into specs. Nothing is invented: an empty required field is a problem, not a default. */
export function loadsFromForm(name: string, form: GymForm): FormResult {
  const loads: GymLoadSpec[] = [];
  const problems: FormProblem[] = [];
  for (const e of GYM_EQUIPMENT) {
    const f = form[e];
    if (!f.enabled) continue;
    const spec: GymLoadSpec = { equipment: e };
    if (f.mode === "list") {
      const { values, invalid } = parseNumberList(f.listText);
      if (invalid.length > 0) problems.push({ code: "number_invalid", equipment: e, detail: invalid });
      if (values.length === 0) problems.push({ code: "list_empty", equipment: e });
      else spec.loads = values;
    } else {
      const inc = parseNumber(f.incrementText);
      if (inc === null || !(inc > 0)) problems.push({ code: "increment_bad", equipment: e });
      else spec.increment = inc;
      const min = f.minText.trim() === "" ? undefined : parseNumber(f.minText);
      if (min === null) problems.push({ code: "number_invalid", equipment: e, detail: [f.minText] });
      else if (min !== undefined) spec.min = min;
      else if (e === "barbell") problems.push({ code: "min_required", equipment: e });
      const max = f.maxText.trim() === "" ? undefined : parseNumber(f.maxText);
      if (max === null) problems.push({ code: "number_invalid", equipment: e, detail: [f.maxText] });
      else if (max !== undefined) spec.max = max;
    }
    loads.push(spec);
  }
  const hasFormProblem = problems.length > 0;
  // Engine-level rules (range, duplicates, rung caps) only when every field parsed, so one typo is not reported twice.
  if (!hasFormProblem) problems.push(...validateGym(name, loads));
  else if (name.trim() === "") problems.push({ code: "name_empty" });
  return { loads, problems };
}
