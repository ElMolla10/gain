import { generateWarmups, type GymLoadSpec, type SetupType, type WarmupSet } from "@gain/engine";

export type WarmupNone = "no_target" | "already_started" | "assisted" | "too_light" | "no_loads";
export type WarmupOffer = { kind: "offer"; sets: WarmupSet[]; workingLoad: number } | { kind: "none"; reason: WarmupNone };

/**
 * Warm-ups for one exercise, from the working load decided for today, on the standard steps for this equipment.
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

/** Movement patterns of single-joint (isolation) work. A big lift earlier in the session has already warmed the muscle. */
const ISOLATION = new Set(["shoulder_isolation", "rear_delt", "elbow_extension", "elbow_flexion", "knee_extension", "knee_flexion", "calf"]);

/**
 * A later isolation exercise (third or later in the session) usually needs no warm-up sets. The offer is not removed: it is shown as
 * "add anyway" instead of a prompt, and the session-length estimate does not count warm-ups for it (see `duration.ts`).
 * `position` is 0-based in the order shown today.
 */
export function warmupsUsuallySkipped(position: number, pattern: string | undefined): boolean {
  return position >= 2 && pattern !== undefined && ISOLATION.has(pattern);
}
