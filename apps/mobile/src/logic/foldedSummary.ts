/**
 * A finished exercise folded to one line (logger spec PR C): "57.5 kg × 8, 9, 10" / "57.5 كجم × 8، 9، 10". Pure. Work sets grouped by
 * load in the order first seen, reps listed; warm-up and drop rows left out. Numbers LTR-isolated, NBSP around the unit and the ×.
 */
import { formatLoad, isolateLtr, NBSP, type Lang } from "../i18n/format";
import type { Unit } from "./units";

export interface FoldSet {
  load: number;
  reps: number;
  warmup?: boolean;
  tags?: readonly string[];
}

export function foldedSummary(sets: readonly FoldSet[], lang: Lang, unit: Unit): string {
  const groups: { load: number; reps: number[] }[] = [];
  for (const s of sets) {
    if (s.warmup || s.tags?.includes("drop")) continue;
    const g = groups.find((x) => Math.abs(x.load - s.load) < 1e-6);
    if (g) g.reps.push(s.reps);
    else groups.push({ load: s.load, reps: [s.reps] });
  }
  const sep = lang === "ar" ? "، " : ", ";
  const group = lang === "ar" ? "؛ " : "; ";
  return groups.map((g) => `${formatLoad(g.load, lang, unit)}${NBSP}×${NBSP}${g.reps.map((r) => isolateLtr(String(r))).join(sep)}`).join(group);
}
