/**
 * One row per exercise of the day on screen, from the stored targets (planned) or the previews (computed from history), so the hero,
 * the stub and the rack read the same thing. Pure. A stored target always wins over a preview.
 */
import type { Measure, ReasonText, SessionSummary } from "@gain/engine";
import type { DayLoadPreview, TargetRow } from "../db/finishRepo";

export interface TodayRow {
  exerciseId: string;
  /** The stored target (planned day); null for a preview. */
  targetId: string | null;
  preview: boolean;
  status: string;
  currency: string;
  measure: Measure;
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
  effectiveLoad: number | null;
  editedLoad: number | null;
  reason: ReasonText | null;
  /** The un-deloaded load in a lighter week (previews only). */
  normalLoad: number | null;
  /** The newest comparable session (previews carry it; planned rows get it from the decision record). */
  last: SessionSummary | null;
}

export function todayRows(exercises: readonly { exerciseId: string; measure: Measure }[], targets: readonly TargetRow[], previews: readonly DayLoadPreview[]): TodayRow[] {
  const byTarget = new Map(targets.map((t) => [t.exerciseId, t]));
  const byPreview = new Map(previews.map((v) => [v.exerciseId, v.proposal]));
  const out: TodayRow[] = [];
  for (const e of exercises) {
    const tg = byTarget.get(e.exerciseId);
    if (tg) {
      out.push({ exerciseId: e.exerciseId, targetId: tg.id, preview: false, status: tg.status, currency: tg.currency, measure: tg.measure, reps: tg.reps, durationS: tg.durationS, distanceM: tg.distanceM, effectiveLoad: tg.effectiveLoad, editedLoad: tg.status === "edited" ? tg.editedLoad : null, reason: tg.reason, normalLoad: null, last: null });
      continue;
    }
    const pv = byPreview.get(e.exerciseId);
    if (!pv) continue;
    out.push({ exerciseId: e.exerciseId, targetId: null, preview: true, status: "proposed", currency: pv.currency, measure: e.measure, reps: pv.reps, durationS: pv.durationS ?? null, distanceM: pv.distanceM ?? null, effectiveLoad: pv.load, editedLoad: null, reason: pv.reason, normalLoad: pv.normalLoad ?? null, last: pv.inputs?.sessions?.[0] ?? null });
  }
  return out;
}
