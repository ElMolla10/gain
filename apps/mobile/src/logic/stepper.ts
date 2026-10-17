// Pure Stepper rules (design audit P-9): clamping and the long-press repeat schedule.
/** Long-press repeat: the first repeat after 400 ms, then every 120 ms. */
export const REPEAT_DELAY_MS = 400;
export const REPEAT_EVERY_MS = 120;

export function clampStep(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** A typed value: digits (and one decimal point when the step is fractional), clamped; empty or junk keeps the old value. */
export function parseTyped(text: string, prev: number, min: number, max: number, step = 1): number {
  const clean = text.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(",", ".").trim();
  if (clean === "") return prev;
  const n = Number(clean);
  if (!Number.isFinite(n)) return prev;
  const snapped = step >= 1 ? Math.round(n) : Math.round(n / step) * step;
  return clampStep(snapped, min, max);
}

/** How many steps a hold of `heldMs` has applied (the tap itself counts as the first). Used by tests to pin the schedule. */
export function repeatsAfter(heldMs: number): number {
  return heldMs < REPEAT_DELAY_MS ? 0 : 1 + Math.floor((heldMs - REPEAT_DELAY_MS) / REPEAT_EVERY_MS);
}
