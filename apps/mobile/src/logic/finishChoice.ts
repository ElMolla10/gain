/**
 * What pressing Finish should do (pure, so it is tested without a phone).
 * - `discard-empty`: no set was logged at all. The primary action is "Discard empty workout"; "Finish anyway" is secondary
 *   (an empty finished session is still kept out of History and the weekly numbers).
 * - `confirm-unlogged`: some rows have numbers but were never ticked.
 * - `finish`: just finish.
 */
export type FinishChoice = "discard-empty" | "confirm-unlogged" | "finish";

export function finishChoice(loggedSets: number, unloggedFilledRows: number): FinishChoice {
  if (loggedSets === 0) return "discard-empty";
  return unloggedFilledRows > 0 ? "confirm-unlogged" : "finish";
}
