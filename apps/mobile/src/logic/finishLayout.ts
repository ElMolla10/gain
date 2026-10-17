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
  if (v.volume !== null) cells.push({ key: "volume", value: `${iso(v.volume)}\u00A0${l.unit}`, label: l.volume });
  if (v.minutes !== null) cells.push({ key: "duration", value: `${iso(v.minutes)}\u00A0${l.min}`, label: l.duration });
  return cells;
}

/**
 * Which forecast exercises have a REAL saved decision behind them: a target in the day's planned session with a decision_log row.
 * Those open the Why screen (same destination as Today and the decision log); the rest fall back to the in-place reasoning.
 * Read-only; any failure just means "no record".
 */
export async function resolveWhyTargets(
  dayId: string,
  exerciseIds: readonly string[],
  repo: {
    getPlannedSession: (dayId: string) => Promise<{ id: string } | null>;
    getTargetForExercise: (sessionId: string, exerciseId: string) => Promise<{ id: string } | null>;
    getDecision: (targetId: string) => Promise<unknown | null>;
  },
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const planned = await repo.getPlannedSession(dayId);
    if (!planned) return out;
    for (const id of exerciseIds) {
      const target = await repo.getTargetForExercise(planned.id, id);
      if (target && (await repo.getDecision(target.id))) out[id] = target.id;
    }
  } catch {
    return {};
  }
  return out;
}

/** Wait for a closing sheet (its Modal dismiss) before opening a system share sheet; the notes item uses the same pattern (D-R3). */
export const SHEET_CLOSE_MS = 350;
