/**
 * The one-line save status in the logger header. Priority is deliberate: a failure and unsaved work are never covered by a friendlier
 * message, and the "resumed" note (which is temporary) only shows when there is nothing more important to say.
 */
export type SaveStatusKind = "failed" | "saving" | "unsaved" | "resumed" | "saved" | "empty";

export function saveStatusKind(i: { failed: boolean; saving: boolean; pending: number; resumedNote: boolean; savedSets: number }): SaveStatusKind {
  if (i.failed) return "failed";
  if (i.saving) return "saving";
  if (i.pending > 0) return "unsaved";
  if (i.resumedNote) return "resumed";
  return i.savedSets > 0 ? "saved" : "empty";
}

/** How long the "resumed your workout" confirmation stays, in ms. */
export const RESUMED_NOTE_MS = 6000;
