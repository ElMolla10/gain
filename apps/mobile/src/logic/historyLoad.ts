import type { HistoryRepo, LiftItem, SessionListItem } from "../db/historyRepo";
export interface HistoryLoadState {
  data: { sessions: SessionListItem[]; total: number; lifts: LiftItem[] } | null;
  loading: boolean;
  failed: boolean;
}
export const EMPTY_HISTORY_LOAD: HistoryLoadState = { data: null, loading: true, failed: false };
/** Publish complete reads only. A failed page keeps the last good list; latest request wins. */
export function createHistoryLoader(source: Pick<HistoryRepo, "listSessions" | "countSessions" | "listLifts">, onChange: (state: HistoryLoadState) => void, onError?: (error: unknown) => void) {
  let generation = 0, limit = 30;
  let data: HistoryLoadState["data"] = null;
  async function load(requested = limit): Promise<void> {
    limit = Math.max(30, requested);
    const current = ++generation;
    onChange({ data, loading: true, failed: false });
    try {
      const [sessions, total, lifts] = await Promise.all([source.listSessions(limit, 0), source.countSessions(), source.listLifts()]);
      if (current !== generation) return;
      data = { sessions, total, lifts };
      onChange({ data, loading: false, failed: false });
    } catch (error) {
      if (current !== generation) return;
      onError?.(error);
      onChange({ data, loading: false, failed: true });
    }
  }
  return { load, cancel: () => { generation++; } };
}
