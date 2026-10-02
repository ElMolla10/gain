import { unitLabel, weightText, type Unit } from "../logic/units";
import { ar, en, type StringKey } from "./strings";

export type Lang = "en" | "ar";
export type Direction = "ltr" | "rtl";
export type RtlOverride = "auto" | "on" | "off";

export const LRI = "\u2066"; // left-to-right isolate
export const PDI = "\u2069"; // pop directional isolate

/**
 * Wrap text that must keep left-to-right order (numbers, "32.5 kg", Latin exercise names) so it reads correctly
 * inside right-to-left Arabic text. The isolate also stops neighbouring Arabic from reordering the number.
 */
export const isolateLtr = (s: string): string => `${LRI}${s}${PDI}`;

export function directionFor(lang: Lang, override: RtlOverride): Direction {
  if (override === "on") return "rtl";
  if (override === "off") return "ltr";
  return lang === "ar" ? "rtl" : "ltr";
}

export function translate(lang: Lang, key: StringKey, params: Record<string, string | number> = {}): string {
  const tpl = (lang === "ar" ? ar : en)[key] ?? en[key];
  return tpl.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name];
    return v === undefined ? m : isolateLtr(String(v)); // numbers stay readable in RTL
  });
}

export interface NamedExercise {
  nameEn: string;
  nameAr: string;
}

/** Primary + secondary label: in Arabic the Arabic name leads and the English name is the (isolated) subtitle, and vice versa. */
export function exerciseLabels(ex: NamedExercise, lang: Lang): { primary: string; secondary: string } {
  return lang === "ar"
    ? { primary: ex.nameAr, secondary: isolateLtr(ex.nameEn) }
    : { primary: ex.nameEn, secondary: ex.nameAr };
}

/** Normalise Arabic for search: strip diacritics/tatweel, unify alef/yaa/taa-marbuta forms, lower-case Latin. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .trim();
}

export function matchesExercise(query: string, ex: NamedExercise & { aliasesAr: string[] }): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return [ex.nameEn, ex.nameAr, ...ex.aliasesAr].some((n) => normalizeSearch(n).includes(q));
}

/** Rough session length. An ESTIMATE (3 min per set, rest included), shown as such in the UI. */
export const estimateMinutes = (totalSets: number): number => Math.round(totalSets * 3);

/** "32.5 kg" / "71.6 lb" (a kilogram weight shown in the lifter's unit) with the number isolated so it reads correctly in RTL. */
export const formatLoad = (load: number, lang: Lang, unit: Unit = "kg"): string => `${isolateLtr(weightText(load, unit))} ${unitLabel(unit, lang)}`;
