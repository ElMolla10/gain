import type { Measure } from "@gain/engine";
import { focusedExercise, focusedRowKey } from "./workoutFocus";
import type { SetRowDraft } from "./workoutRows";

export interface SetCursor { exId: string; key: string | null }
/** Explicit navigation wins, including clean completed rows. Automatic advancement keeps superset turn-taking. */
export function resolveCurrentSet(ids: readonly string[], rows: Record<string, SetRowDraft[]>, selected: SetCursor | null, preferred: string | null, groups?: Record<string, string | null | undefined>): SetCursor | null {
  if (selected && ids.includes(selected.exId) && selected.key && rows[selected.exId]?.some(r => r.key === selected.key)) return selected;
  const unfinished = focusedExercise([...ids], rows, preferred, groups);
  const exId = unfinished ?? (preferred && ids.includes(preferred) ? preferred : ids[0]);
  return exId ? { exId, key: unfinished ? focusedRowKey(rows[exId] ?? []) : null } : null;
}
export function loadInputMode(ex: { setup: string; equipment: string }, load: number | null): "bodyweight" | "added" | "assistance" | "weight" {
  if (ex.setup === "assisted" || ex.equipment === "assisted") return "assistance";
  if (ex.setup === "bodyweight_plus_added") return load != null && load > 0 ? "added" : "bodyweight";
  return "weight";
}
type PreviousSet = { load: number; reps: number; warmup?: boolean; tags?: string[]; outlierStatus?: string; durationS?: number | null; distanceM?: number | null };
/** Same-numbered trusted working set only; missing quantities never become an invented previous set. */
export function previousForRow(sets: readonly PreviousSet[] | null | undefined, index: number | null, measure: Measure): { load: number; reps: number } | null {
  const set = index == null ? null : sets?.[index];
  if (!set || set.warmup || set.tags?.includes("drop") || ["rejected", "unconfirmed"].includes(set.outlierStatus ?? "")) return null;
  const q = measure === "time" ? set.durationS : measure === "distance" ? set.distanceM : set.reps;
  return Number.isFinite(set.load) && set.load >= 0 && q != null && Number.isFinite(q) && q > 0 ? { load: set.load, reps: q } : null;
}
