import { formatLoad, isolateLtr, type Lang } from "../i18n/format";
import { kgToUnit, type Unit } from "./units";

/**
 * Load text for the 10x cards. Loads are stored in kilograms; everything shown or spoken goes through formatLoad
 * (the number LTR-isolated, the unit word outside it, so Arabic keeps "كجم" / "باوند" in its own direction).
 */

/** An estimated 1RM (or a value derived from one): kg shown to 0.1 like the lb conversion, never "116.667". */
export const e1rmText = (kg: number, lang: Lang, unit: Unit): string => formatLoad(Math.round(kg * 10) / 10, lang, unit);

/** "100 kg × 5" / "220.5 lb × 5". */
export const setText = (kg: number, reps: number, lang: Lang, unit: Unit): string => `${formatLoad(kg, lang, unit)} × ${isolateLtr(String(reps))}`;

/** Total moved, as a whole number in the lifter's unit. */
export const tonnageInUnit = (totalKg: number, unit: Unit): number => Math.round(kgToUnit(totalKg, unit));
