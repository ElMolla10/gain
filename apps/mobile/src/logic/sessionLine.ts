/**
 * The logger's one session line (logger spec §5), pure: "23:41 ⏸ · 4 of 18 sets · Saved 06:31 · Details ▾".
 */
import type { SaveStatusKind } from "./saveStatus";
import { kindOf, type SetRowDraft } from "./workoutRows";

/** Planned work rows across the shown exercises: warm-up and drop rows don't count. */
export const plannedWorkRows = (rows: Readonly<Record<string, readonly SetRowDraft[]>>, ids: readonly string[]): number =>
  ids.reduce((n, id) => n + (rows[id] ?? []).filter((r) => { const k = kindOf(r); return k !== "warmup" && k !== "drop"; }).length, 0);

/** A failure or unsaved work takes over the middle of the line in `warn` (Pause never hides). */
export const sessionLineWarns = (kind: SaveStatusKind): boolean => kind === "failed" || kind === "unsaved";
