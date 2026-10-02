import { generateWarmups, type GymLoadSpec, type SetupType, type WarmupSet } from "@gain/engine";

export type WarmupNone = "no_target" | "already_started" | "assisted" | "too_light" | "no_loads";
export type WarmupOffer = { kind: "offer"; sets: WarmupSet[]; workingLoad: number } | { kind: "none"; reason: WarmupNone };

/**
 * Warm-ups for one exercise, from the working load decided for today, on loads that exist in this gym.
 * Offered only before anything is logged for the exercise today (a second tap or a restart never doubles them),
 * and never for assisted lines. They are logged as warm-ups: the engine ignores them for the next target.
 */
export function warmupOffer(p: { workingLoad: number | null; spec: GymLoadSpec | null; setup: SetupType; loggedToday: number }): WarmupOffer {
  if (p.workingLoad === null || !(p.workingLoad > 0)) return { kind: "none", reason: "no_target" };
  if (p.loggedToday > 0) return { kind: "none", reason: "already_started" };
  const plan = generateWarmups(p.workingLoad, p.spec, { setup: p.setup });
  if (plan.sets.length > 0) return { kind: "offer", sets: plan.sets, workingLoad: p.workingLoad };
  return { kind: "none", reason: plan.skipped === "assisted_line" ? "assisted" : plan.skipped === "no_gym_loads" ? "no_loads" : "too_light" };
}
