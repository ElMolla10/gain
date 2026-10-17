/**
 * What pressing Finish should do (pure, so it is tested without a phone).
 * - `confirm-unlogged`: some rows have numbers that are not in the database yet (typed but never ticked, or a ticked row typed over).
 *   Checked FIRST, even with no set logged: typed numbers are never routed into "Discard empty workout". The dialog offers
 *   "Log N and finish" / "Don't log them" / Cancel.
 * - `discard-empty`: no set was logged and nothing is typed. The primary action is "Discard empty workout"; "Finish anyway" is secondary
 *   (an empty finished session is still kept out of History and the weekly numbers).
 * - `finish`: just finish.
 */
export type FinishChoice = "discard-empty" | "confirm-unlogged" | "finish";

/** `loggableUnlogged`: rows Finish can save as they appear; `leftOut`: typed rows that cannot be saved (missing or invalid numbers). */
export function finishChoice(loggedSets: number, loggableUnlogged: number, leftOut: number): FinishChoice {
  if (loggableUnlogged + leftOut > 0) return "confirm-unlogged";
  return loggedSets === 0 ? "discard-empty" : "finish";
}
