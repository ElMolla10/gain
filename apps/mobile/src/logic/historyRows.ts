/** Longest plausible workout; a longer gap means the workout was left open and finished later, so no duration is shown. */
const MAX_MINUTES = 6 * 60;

/** Whole minutes between start and finish, or null when unknown or implausible (imported, never started, left open for hours). */
export function sessionMinutes(startedAt: number | null, finishedAt: number, imported: boolean): number | null {
  if (imported || startedAt === null) return null;
  const min = Math.round((finishedAt - startedAt) / 60_000);
  return min >= 1 && min <= MAX_MINUTES ? min : null;
}
