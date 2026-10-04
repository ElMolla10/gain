/**
 * Library rows that are the SAME movement on the SAME equipment under two seed keys (an older GAIN name and a Hevy-style name).
 *
 * Nothing is merged, renamed or deleted. A phone may already hold both rows with history on either, and that history stays exactly where
 * it is. The groups are used only to steer import title matching: when a title matches one row of a group but the lifter's own history or
 * programs already sit on another row of the same group, the import suggests the row in use, so one lift does not split into two lines.
 * The lifter can still change the suggestion on the import screen.
 *
 * Only identical movements are listed. Variants (single-arm, incline, rope, straight-bar, lying vs seated) are different lifts and stay apart.
 */
export const EQUIVALENT_KEYS: readonly (readonly string[])[] = [
  ["deadlift", "deadlift_barbell"],
  ["db_row", "dumbbell_row"],
  ["shoulder_press_db", "shoulder_press_dumbbell"],
  ["assisted_pullup", "pull_up_assisted"],
  ["machine_row", "seated_row_machine"],
  ["machine_shoulder_press", "seated_shoulder_press_machine"],
  ["skullcrusher", "skullcrusher_barbell"],
  ["rear_delt_fly_db", "rear_delt_reverse_fly_dumbbell"],
  ["seated_shoulder_press_machine_plates", "shoulder_press_machine_plates"],
];

const GROUP_OF = new Map<string, readonly string[]>();
for (const g of EQUIVALENT_KEYS) for (const k of g) GROUP_OF.set(k, g);

/** The other keys that name the same movement (empty when the row has no twin). */
export function equivalentsOf(seedKey: string | null | undefined): string[] {
  if (!seedKey) return [];
  return (GROUP_OF.get(seedKey) ?? []).filter((k) => k !== seedKey);
}

/**
 * Which key an import should land on. `usage` is how many logged sets and program lines each key already has on this phone.
 * Keeps `matched` unless it is unused and a twin is used; with several used twins the busiest wins (the earlier key breaks a tie).
 */
export function preferUsedTwin(matched: string, usage: ReadonlyMap<string, number>): string {
  if ((usage.get(matched) ?? 0) > 0) return matched;
  let best = matched;
  let bestN = 0;
  for (const k of equivalentsOf(matched)) {
    const n = usage.get(k) ?? 0;
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}
