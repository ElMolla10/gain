import { parseNumber, parseNumberList } from "./gymInput";
import type { LoadsForm } from "./exerciseLoads";

/** How many rungs the step preview shows before "+N" (design audit P-5). */
export const PREVIEW_CAP = 12;

/**
 * The rack the lifter is about to save, for the pills under the inputs: list mode reuses the save parser (sorted, unique, invalid
 * pieces kept as typed); step mode generates min..max by step (min defaults to one step), capped to the first 12 plus "+N".
 * Preview only: saving still goes through buildLoads, unchanged.
 */
export function previewTokens(form: LoadsForm): { values: number[]; invalid: string[]; more: number } {
  if (form.mode === "list") {
    const parsed = parseNumberList(form.listText);
    return { values: parsed.values, invalid: parsed.invalid, more: 0 };
  }
  if (form.mode === "step") {
    const step = parseNumber(form.stepText);
    const max = parseNumber(form.maxText);
    const minRaw = form.minText.trim() === "" ? step : parseNumber(form.minText);
    if (!step || !(step > 0) || max === null || minRaw === null || max < minRaw) return { values: [], invalid: [], more: 0 };
    const count = Math.floor((max - minRaw) / step + 1e-9) + 1;
    const shown = Math.min(count, PREVIEW_CAP);
    const values = Array.from({ length: shown }, (_, i) => Math.round((minRaw + i * step) * 1000) / 1000);
    return { values, invalid: [], more: count - shown };
  }
  return { values: [], invalid: [], more: 0 };
}
