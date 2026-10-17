// Pure presentation rules of one set row (no React Native import, so tests can check them). Design audit L-2 / L-4.
import type { SetRowDraft } from "./workoutRows";
import { isTimed } from "./quantity";

/**
 * The tick's four states, told apart by more than hue:
 * - notReady: nothing typed and no ghost target. Hollow box (transparent, 1.5 dp edge), no glyph; disabled.
 * - ready: a ghost target or typed values, not ticked. Field fill, 1.5 dp edge (2 dp accent on the current row), muted check.
 * - done: ticked and saved. SOLID `doneSolid` fill, no border, inverted 22 dp check in `onDoneSolid`.
 * - edited: saved, then typed over. Field fill, 2 dp accent border, accent pencil.
 */
export type TickState = "notReady" | "ready" | "done" | "edited";

export function tickState(row: Pick<SetRowDraft, "saved" | "dirty">, canTick: boolean): TickState {
  if (row.saved && !row.dirty) return "done";
  if (row.saved && row.dirty) return "edited";
  return canTick ? "ready" : "notReady";
}

/**
 * Inputs whose TYPED value is not saved yet: they get a 2 dp warn underline until the row is ticked, because an unticked row is
 * dropped at Finish. Ghost targets alone are not "typed"; an edited saved row has its own pencil state instead.
 */
export function pendingInputs(row: Pick<SetRowDraft, "saved" | "dirty" | "load" | "reps">): { load: boolean; reps: boolean } {
  const open = !row.saved;
  return { load: open && row.load !== null, reps: open && row.reps !== null };
}

/** Whether an exercise offers the "Available weights" control (now in its ⋮ menu): loaded, counted in reps, not assisted. */
export function canEditLoadsFor(ex: { measure: Parameters<typeof isTimed>[0]; setup: string; equipment: string }): boolean {
  return !isTimed(ex.measure) && ex.setup !== "assisted" && ex.equipment !== "assisted";
}
