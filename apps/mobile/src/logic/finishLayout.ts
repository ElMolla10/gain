// Pure layout rules of the Finish screen (no React Native import, so tests can check them). Design audit F-1 / F-3.

/** The lead of the next-workout block: the goal lift when it has a concrete target, else the first exercise with one, else the first. */
export function forecastOrder<T extends { exerciseId: string }>(exercises: readonly T[], goalId: string | null, hasTarget: (ex: T) => boolean): { lead: T | null; rest: T[] } {
  if (exercises.length === 0) return { lead: null, rest: [] };
  const lead = exercises.find((e) => goalId !== null && e.exerciseId === goalId && hasTarget(e)) ?? exercises.find(hasTarget) ?? exercises[0]!;
  return { lead, rest: exercises.filter((e) => e !== lead) };
}

/** What "Why" adds beyond the sentence already shown; empty when there is nothing more (then the action is hidden, not disabled). */
export function whyDetail(full: string, shown: string): string {
  const rest = full.trim().slice(shown.trim().length).trim();
  return rest;
}

/**
 * The one-row stats strip (F-5): sets · exercises · volume · duration. Numbers are isolated; unit words stay in the language, so
 * "1240 كجم" and "48 د" read correctly in Arabic. Volume and duration are left out when unknown.
 */
export function finishStatCells(
  v: { sets: number; exercises: number; volume: string | null; minutes: number | null },
  l: { sets: string; exercises: string; volume: string; duration: string; unit: string; min: string },
): { key: string; value: string; label: string }[] {
  const LRI = "\u2066", PDI = "\u2069";
  const iso = (x: string | number) => `${LRI}${x}${PDI}`;
  const cells = [
    { key: "sets", value: iso(v.sets), label: l.sets },
    { key: "exercises", value: iso(v.exercises), label: l.exercises },
  ];
  if (v.volume !== null) cells.push({ key: "volume", value: `${iso(v.volume)} ${l.unit}`, label: l.volume });
  if (v.minutes !== null) cells.push({ key: "duration", value: `${iso(v.minutes)} ${l.min}`, label: l.duration });
  return cells;
}
