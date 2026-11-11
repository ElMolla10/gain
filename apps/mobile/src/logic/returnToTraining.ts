import { ceilLoad, floorLoad, type GymLoadSpec, type SetupType } from "@gain/engine";
import type { Prefill } from "./workoutRows";

export const RETURN_PLAN_KEY = "return_plan_v1";
export const returnSessionKey = (id: string) => `return_session_v1:${id}`;
export type ReturnStage = 1 | 2;
export interface ReturnPlan { versionId: string; startedAt: number; stage: ReturnStage; active: boolean }

export function parseReturnPlan(raw: string | null): ReturnPlan | null {
  try {
    const p: unknown = JSON.parse(raw ?? "null");
    if (!p || typeof p !== "object") return null;
    const v = p as Partial<ReturnPlan>;
    return typeof v.versionId === "string" && Number.isFinite(v.startedAt) && (v.stage === 1 || v.stage === 2) && typeof v.active === "boolean"
      ? v as ReturnPlan : null;
  } catch { return null; }
}

export function returnStage(raw: string | null): ReturnStage | null { return raw === "1" ? 1 : raw === "2" ? 2 : null; }

/** Keep every exercise and its order. Round to whole sets; never drop below one. */
export function comebackSets(normalSets: number, stage: ReturnStage): number {
  if (!Number.isFinite(normalSets) || normalSets < 1) return 1;
  return Math.max(1, Math.min(Math.round(normalSets), Math.round(normalSets * (stage === 1 ? 0.67 : 0.85))));
}

/** Never fabricate an equipment increment. An unknown grid leaves the load blank. */
export function comebackLoad(load: number | null, spec: GymLoadSpec | null, setup: SetupType, stage: ReturnStage): number | null {
  if (load === null || !Number.isFinite(load) || load < 0) return null;
  if (setup === "bodyweight_plus_added") return 0; // No added weight is the conservative starting point.
  if (setup === "assisted") return spec ? ceilLoad(spec, load * (stage === 1 ? 1.15 : 1.05), true)
    ?? (spec.max !== undefined ? floorLoad(spec, spec.max, true) : spec.loads?.length ? Math.max(...spec.loads) : null) : null;
  if (!spec || load === 0) return null;
  // Floor to a real rung. If none exists below the target, use the lightest available rung.
  const target = load * (stage === 1 ? 0.85 : 0.95);
  return floorLoad(spec, target) ?? ceilLoad(spec, target);
}

/** A lighter load alone does not establish RIR. Keep reps conservative when effort history is missing. */
export function comebackPrefill(prefill: Prefill, spec: GymLoadSpec | null, setup: SetupType, measure: string, stage: ReturnStage): Prefill {
  if (measure !== "reps") return prefill;
  return { ...prefill, load: comebackLoad(prefill.load, spec, setup, stage) };
}

export function canProgressReturn(plan: ReturnPlan, now: number, finished: readonly { feel: string | null }[]): boolean {
  return plan.active && plan.stage === 1 && now - plan.startedAt >= 7 * 86_400_000 && finished.length > 0
    && finished.at(-1)?.feel !== "heavy";
}
