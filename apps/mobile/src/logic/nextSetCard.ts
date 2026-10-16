import { nextLoadAbove, type Decision, type GymLoadSpec } from "@gain/engine";

/** Explicit next-set card states. Never blank. */
export type NextSetState = "increase" | "hold" | "decrease" | "no_heavier" | "starting" | "stop";

/** Map a live decision (and optional first-set / rack) onto one card state. */
export function nextSetState(input: { decision: Decision; starting?: boolean; spec?: GymLoadSpec | null }): NextSetState {
  if (input.starting) return "starting";
  const d = input.decision;
  if (d.action === "stop") return "stop";
  if (d.action === "increase") return "increase";
  if (d.action === "decrease") return "decrease";
  if (d.reason === "no_suitable_increase") return "no_heavier";
  if (input.spec && nextLoadAbove(input.spec, d.suggestedWeightKg) === null && d.predictedReps > 0 && d.reason !== "within_range" && d.reason !== "no_lighter_load") {
    return "no_heavier";
  }
  return "hold";
}
