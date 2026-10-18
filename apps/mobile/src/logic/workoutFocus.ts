import { currentRowKey, type SetRowDraft } from "./workoutRows";

/** An edited saved set remains work to finish even though its row still has a database ID. */
export const focusedRowKey = (rows: SetRowDraft[]): string | null => rows.find(row => row.saved && row.dirty)?.key ?? currentRowKey(rows);

/** Each completed set's next-set answer stays beside its own exercise. */
export const livePromptVisible = (_action: string, _active: boolean): boolean => true;

const workDone = (rows: readonly SetRowDraft[]) => rows.filter((r) => r.saved && !r.warmup).length;
const typing = (rows: readonly SetRowDraft[]) => rows.some((r) => !r.saved && (r.load !== null || r.reps !== null));

/**
 * Superset turn-taking (logger spec PR A): after A1 set n, A2 set n; after the last member, back to A1 for set n+1. Only once the
 * touched exercise has a logged work set and nothing half-typed, so tapping into A2 first never yanks focus away.
 */
function supersetNext(ids: readonly string[], rows: Record<string, SetRowDraft[]>, preferred: string, groups: Readonly<Record<string, string | null | undefined>>): string | null {
  const g = groups[preferred];
  if (!g) return null;
  const members = ids.filter((id) => groups[id] === g);
  const at = members.indexOf(preferred);
  if (members.length < 2 || at < 0) return null;
  const mine = rows[preferred] ?? [];
  const n = workDone(mine);
  if (n < 1 || typing(mine)) return null;
  for (let k = 1; k < members.length; k++) {
    const id = members[(at + k) % members.length]!;
    const list = rows[id] ?? [];
    if (focusedRowKey(list) === null) continue;
    const wrapped = at + k >= members.length;
    if (wrapped ? workDone(list) <= n : workDone(list) < n) return id;
  }
  return null;
}

/** Follow the exercise the lifter touched (superset-aware when `groups` maps exercise id → superset group); advance only when all its rows are saved. */
export function focusedExercise(ids: readonly string[], rows: Record<string, SetRowDraft[]>, preferred: string | null, groups?: Readonly<Record<string, string | null | undefined>>): string | null {
  const unfinished = (id: string) => focusedRowKey(rows[id] ?? []) !== null;
  if (preferred && groups && ids.includes(preferred)) {
    const next = supersetNext(ids, rows, preferred, groups);
    if (next) return next;
  }
  return preferred && ids.includes(preferred) && unfinished(preferred)
    ? preferred : ids.find(unfinished) ?? null;
}

/** exerciseId → superset group for the shown list (exercise state is keyed by slot). */
export const supersetGroups = (shown: readonly { slot: string; exerciseId: string }[], exState: Readonly<Record<string, { superset?: string | null } | undefined>>): Record<string, string | null> =>
  Object.fromEntries(shown.map((ex) => [ex.exerciseId, exState[ex.slot]?.superset ?? null]));
