import { InvalidGymLoadSpec, validateGymLoadSpec, type EquipmentType, type GymLoadSpec } from "@gain/engine";

/** Equipment kinds a gym can describe, in the order the editor shows them. */
export const GYM_EQUIPMENT: EquipmentType[] = ["dumbbell", "barbell", "plate", "cable", "machine", "assisted"];

/** Hard cap so a typo (step 0.001) cannot create a giant list. */
export const MAX_LOAD_RUNGS = 300;

const ARABIC_INDIC = /[\u0660-\u0669]/g;
const EXT_ARABIC_INDIC = /[\u06F0-\u06F9]/g;

/** "٢٢٫٥" -> "22.5". Arabic-Indic digits and the Arabic decimal separator are accepted everywhere a number is typed. */
export function normalizeDigits(s: string): string {
  return s
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXT_ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, ".");
}

/** One number from user text, or null. Never guesses: "12abc" and "" are null. */
export function parseNumber(text: string): number | null {
  const s = normalizeDigits(text).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface ParsedList {
  values: number[];
  /** Pieces that were not numbers (shown to the lifter, never dropped silently). */
  invalid: string[];
}

/**
 * "5, 7.5 10 12.5" -> sorted unique numbers. Separators: comma, Arabic comma, semicolon, whitespace.
 * The decimal separator is "." (or the Arabic decimal mark), so a comma is always a separator.
 */
export function parseNumberList(text: string): ParsedList {
  const pieces = normalizeDigits(text).split(/[\s,;\u060C]+/).filter((p) => p !== "");
  const values: number[] = [];
  const invalid: string[] = [];
  for (const p of pieces) {
    const n = parseNumber(p);
    if (n === null) invalid.push(p);
    else values.push(Math.round(n * 1000) / 1000);
  }
  return { values: [...new Set(values)].sort((a, b) => a - b), invalid };
}

/** Rung list from min to max by step (e.g. fill a rack 5..30 by 2.5), as a starting point the lifter then edits. */
export function rangeLoads(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !(max >= min) || !(min >= 0)) return [];
  const out: number[] = [];
  for (let i = 0; min + i * step <= max + 1e-9 && out.length < MAX_LOAD_RUNGS; i++) out.push(Math.round((min + i * step) * 1000) / 1000);
  return out;
}

export const formatList = (xs: number[]): string => xs.join(", ");

export type GymProblemCode = "name_empty" | "no_equipment" | "list_empty" | "increment_bad" | "range_bad" | "duplicate_equipment" | "too_many_rungs" | "negative_load" | "invalid";
export interface GymProblem {
  code: GymProblemCode;
  equipment?: EquipmentType;
}

/**
 * Checks a gym before it is saved. Pure. Mirrors the engine's own validation (so a saved gym can never make the engine throw)
 * and adds the editor-level rules: a name, at least one equipment type, one spec per type.
 */
export function validateGym(name: string, loads: GymLoadSpec[]): GymProblem[] {
  const problems: GymProblem[] = [];
  if (name.trim() === "") problems.push({ code: "name_empty" });
  if (loads.length === 0) problems.push({ code: "no_equipment" });
  const seen = new Set<EquipmentType>();
  for (const l of loads) {
    if (seen.has(l.equipment)) problems.push({ code: "duplicate_equipment", equipment: l.equipment });
    seen.add(l.equipment);
    if (l.loads !== undefined && l.loads.length === 0 && l.increment === undefined) {
      problems.push({ code: "list_empty", equipment: l.equipment });
      continue;
    }
    if (l.loads && l.loads.length > MAX_LOAD_RUNGS) problems.push({ code: "too_many_rungs", equipment: l.equipment });
    if (l.loads && l.loads.some((x) => x < 0)) problems.push({ code: "negative_load", equipment: l.equipment });
    if (l.increment !== undefined && !(l.increment > 0)) {
      problems.push({ code: "increment_bad", equipment: l.equipment });
      continue;
    }
    if (l.increment !== undefined && l.max !== undefined && (l.max - (l.min ?? l.increment)) / l.increment > MAX_LOAD_RUNGS) problems.push({ code: "too_many_rungs", equipment: l.equipment });
    try {
      validateGymLoadSpec(l);
    } catch (e) {
      if (!(e instanceof InvalidGymLoadSpec)) throw e;
      problems.push({ code: /max < min/.test(e.message) ? "range_bad" : "invalid", equipment: l.equipment });
    }
  }
  return problems;
}

/** Normalised spec for storage: sorted unique list, no empty list next to an increment. */
export function cleanSpec(spec: GymLoadSpec): GymLoadSpec {
  const out: GymLoadSpec = { equipment: spec.equipment };
  if (spec.loads && spec.loads.length > 0) out.loads = [...new Set(spec.loads.map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
  if (spec.increment !== undefined) out.increment = spec.increment;
  if (spec.min !== undefined) out.min = spec.min;
  if (spec.max !== undefined) out.max = spec.max;
  return out;
}

/** The smallest steps between neighbouring rungs of a list (for the "dumbbells go 20, then 22.5" line). */
export function listJumps(loads: number[]): number[] {
  const s = [...loads].sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < s.length; i++) out.push(Math.round((s[i]! - s[i - 1]!) * 1000) / 1000);
  return out;
}
