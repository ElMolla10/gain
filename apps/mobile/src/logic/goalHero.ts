/**
 * What the Goals hero card can claim. With no usable history for the goal's lift (current = null) it shows only the
 * target and an empty state: never the target dressed up as the lifter's current strength (that read as 100%).
 * Values stay in kilograms; the card formats them.
 */
export type GoalHeroModel =
  | { kind: "empty" }
  | { kind: "progress"; percent: number; deltaKg: number; cp1: number; cp2: number };

export function goalHeroModel(current: number | null, target: number): GoalHeroModel {
  if (current === null || !Number.isFinite(current)) return { kind: "empty" };
  const ratio = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;
  return {
    kind: "progress",
    percent: Math.round(ratio * 100),
    deltaKg: Math.max(0, Math.round((target - current) * 10) / 10),
    // Intermediate checkpoints (40% and 75% of the way), to the nearest half.
    cp1: Math.round((current + (target - current) * 0.4) * 2) / 2,
    cp2: Math.round((current + (target - current) * 0.75) * 2) / 2,
  };
}
