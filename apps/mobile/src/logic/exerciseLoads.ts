import { InvalidGymLoadSpec, validateGymLoadSpec, type EquipmentType, type GymLoadSpec } from "@gain/engine";
import { MAX_LOAD_RUNGS, cleanSpec, parseNumber, parseNumberList, validateGym } from "./gymInput";
import { kgToUnit, unitToKgKnown, weightText, type Unit } from "./units";

/**
 * Weights the lifter sets for ONE exercise (dumbbell jumps, a machine's stack step, the plates on a barbell). Stored in kilograms like
 * every weight, in `exercise.load_spec_json` as `{loads?, increment?, min?, max?}` (no equipment: it is the exercise's own). NULL = the gym's
 * grid for the exercise's equipment, exactly as before. Pure functions, no I/O.
 */
export type LoadsMode = "default" | "step" | "list";

export interface LoadsForm {
  mode: LoadsMode;
  /** Step mode: the jump between two neighbouring weights, in the lifter's unit. */
  stepText: string;
  /** Step mode: the lightest weight (a barbell's bar), optional. */
  minText: string;
  /** Step mode: the heaviest weight, optional. */
  maxText: string;
  /** List mode: every weight that exists, separated by commas or spaces. */
  listText: string;
}

export const emptyLoadsForm = (): LoadsForm => ({ mode: "default", stepText: "", minText: "", maxText: "", listText: "" });

export type LoadsProblemCode = "step_missing" | "step_bad" | "min_bad" | "max_bad" | "range_bad" | "list_empty" | "list_invalid" | "list_zero" | "too_many_rungs";
export interface LoadsProblem {
  code: LoadsProblemCode;
  /** Pieces of typed text that were not numbers. */
  detail?: string[];
}

/** The stored text for a spec (kilograms, no equipment). */
export function serializeLoads(spec: GymLoadSpec): string {
  const { equipment: _equipment, ...rest } = cleanSpec(spec);
  return JSON.stringify(rest);
}

/**
 * Stored text -> the spec the engine reads, or null. Never throws: empty, damaged or invalid text (an edited backup, a future version)
 * is ignored and the exercise falls back to the gym's grid, so a bad value can never stop a workout from loading.
 */
export function parseStoredLoads(json: string | null | undefined, equipment: EquipmentType): GymLoadSpec | null {
  if (json === null || json === undefined || json === "") return null;
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    const spec: GymLoadSpec = { equipment };
    if (Array.isArray(raw.loads)) {
      if (!raw.loads.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0)) return null;
      spec.loads = raw.loads as number[];
    }
    const inc = num(raw.increment), min = num(raw.min), max = num(raw.max);
    if (raw.increment !== undefined && inc === undefined) return null;
    if (inc !== undefined) spec.increment = inc;
    if (min !== undefined) spec.min = min;
    if (max !== undefined) spec.max = max;
    if (validateGym("x", [spec]).length > 0) return null;
    validateGymLoadSpec(spec);
    return cleanSpec(spec);
  } catch (e) {
    if (e instanceof InvalidGymLoadSpec || e instanceof SyntaxError) return null;
    throw e;
  }
}

/** The form that shows a stored spec (numbers in the lifter's unit). */
export function formFromSpec(spec: GymLoadSpec | null, unit: Unit): LoadsForm {
  if (!spec) return emptyLoadsForm();
  if (spec.loads && spec.loads.length > 0) return { ...emptyLoadsForm(), mode: "list", listText: spec.loads.map((x) => weightText(x, unit)).join(", ") };
  return {
    ...emptyLoadsForm(),
    mode: "step",
    stepText: spec.increment !== undefined ? weightText(spec.increment, unit) : "",
    minText: spec.min !== undefined ? weightText(spec.min, unit) : "",
    maxText: spec.max !== undefined ? weightText(spec.max, unit) : "",
  };
}

/**
 * The form -> a spec (kilograms) or the problems. `known` = the kilogram values already stored, so reopening and saving unchanged in lb
 * does not move any weight by a few grams. mode "default" -> `spec: null` (clear the setting). Never guesses: unreadable text is a problem.
 */
export function buildLoads(form: LoadsForm, equipment: EquipmentType, unit: Unit, known: readonly number[] = []): { spec: GymLoadSpec | null; problems: LoadsProblem[] } {
  if (form.mode === "default") return { spec: null, problems: [] };
  const problems: LoadsProblem[] = [];
  const kg = (n: number) => unitToKgKnown(n, unit, known);
  if (form.mode === "list") {
    const parsed = parseNumberList(form.listText);
    if (parsed.invalid.length > 0) problems.push({ code: "list_invalid", detail: parsed.invalid });
    if (parsed.values.length === 0 && parsed.invalid.length === 0) problems.push({ code: "list_empty" });
    const loads = parsed.values.map(kg);
    if (equipment !== "assisted" && loads.some((x) => !(x > 0))) problems.push({ code: "list_zero" });
    if (loads.length > MAX_LOAD_RUNGS) problems.push({ code: "too_many_rungs" });
    if (problems.length > 0) return { spec: null, problems };
    return { spec: cleanSpec({ equipment, loads }), problems };
  }
  const spec: GymLoadSpec = { equipment };
  const stepN = form.stepText.trim() === "" ? undefined : parseNumber(form.stepText);
  if (form.stepText.trim() === "") problems.push({ code: "step_missing" });
  else if (stepN === null || stepN === undefined || !(stepN > 0)) problems.push({ code: "step_bad" });
  else spec.increment = kg(stepN);
  if (form.minText.trim() !== "") {
    const n = parseNumber(form.minText);
    if (n === null) problems.push({ code: "min_bad" });
    else spec.min = kg(n);
  }
  if (form.maxText.trim() !== "") {
    const n = parseNumber(form.maxText);
    if (n === null || !(n > 0)) problems.push({ code: "max_bad" });
    else spec.max = kg(n);
  }
  if (problems.length > 0) return { spec: null, problems };
  for (const g of validateGym("x", [spec])) {
    if (g.code === "too_many_rungs") problems.push({ code: "too_many_rungs" });
    else if (g.code === "range_bad") problems.push({ code: "range_bad" });
    else if (g.code === "increment_bad") problems.push({ code: "step_bad" });
    else if (g.code !== "name_empty") problems.push({ code: "range_bad" });
  }
  if (spec.min !== undefined && spec.max !== undefined && spec.max < spec.min && !problems.some((p) => p.code === "range_bad")) problems.push({ code: "range_bad" });
  return problems.length > 0 ? { spec: null, problems } : { spec: cleanSpec(spec), problems: [] };
}

/** Every kilogram value a spec holds (for `known` in `buildLoads`). */
export const specValues = (spec: GymLoadSpec | null): number[] => (spec ? [...(spec.loads ?? []), ...[spec.increment, spec.min, spec.max].filter((x): x is number => x !== undefined)] : []);

/** A short summary of what is set, numbers in the lifter's unit: "5 steps from 20 to 200" / "10, 12, 14, 16". */
export function summarizeLoads(spec: GymLoadSpec, unit: Unit): { kind: "list"; list: string } | { kind: "step"; step: string; min: string | null; max: string | null } {
  if (spec.loads && spec.loads.length > 0) return { kind: "list", list: spec.loads.map((x) => String(kgToUnit(x, unit))).join(", ") };
  return { kind: "step", step: String(kgToUnit(spec.increment ?? 0, unit)), min: spec.min !== undefined ? String(kgToUnit(spec.min, unit)) : null, max: spec.max !== undefined ? String(kgToUnit(spec.max, unit)) : null };
}

/** "steps of 2.5 kg, from 20 up to 200" / "10, 12, 14, 16 kg" in the lifter's unit, in words (`L` = the translate function). */
export function loadsSummaryText(spec: GymLoadSpec, unit: Unit, unitName: string, L: (k: string, params?: Record<string, string | number>) => string): string {
  const s = summarizeLoads(spec, unit);
  if (s.kind === "list") return L("loads.sum.list", { list: s.list, unit: unitName });
  let out = L("loads.sum.step", { step: s.step, unit: unitName });
  if (s.min !== null && s.max !== null) out += L("loads.sum.from", { min: s.min }) + L("loads.sum.to", { max: s.max });
  else if (s.min !== null) out += L("loads.sum.from", { min: s.min });
  else if (s.max !== null) out += L("loads.sum.upTo", { max: s.max });
  return out;
}
