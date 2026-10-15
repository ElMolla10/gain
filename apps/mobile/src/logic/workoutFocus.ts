import { currentRowKey, type SetRowDraft } from "./workoutRows";

/** An edited saved set remains work to finish even though its row still has a database ID. */
export const focusedRowKey = (rows: SetRowDraft[]): string | null => rows.find(row => row.saved && row.dirty)?.key ?? currentRowKey(rows);

/** Each completed set's next-set answer stays beside its own exercise. */
export const livePromptVisible = (_action: string, _active: boolean): boolean => true;

/** Follow the exercise the lifter touched; advance only when all its rows are saved. */
export function focusedExercise(ids: readonly string[], rows: Record<string, SetRowDraft[]>, preferred: string | null): string | null {
  const unfinished = (id: string) => focusedRowKey(rows[id] ?? []) !== null;
  return preferred && ids.includes(preferred) && unfinished(preferred)
    ? preferred : ids.find(unfinished) ?? null;
}
