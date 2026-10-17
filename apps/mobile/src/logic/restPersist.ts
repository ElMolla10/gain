/**
 * The running rest, kept in the `setting` table so it survives collapsing the logger, an edge-swipe back and iOS terminating the app.
 * Pure parse/serialize and decisions here; the hook (hooks/useWorkoutRest.ts) does the reads and writes.
 */
export const REST_RUNNING_KEY = "rest_running";

export interface RunningRest {
  sessionId: string;
  endsAt: number;
  durationMs: number;
  /** The exercise the rest belongs to (shown in the rest dock), or null. */
  label: string | null;
}

export const serializeRunningRest = (r: RunningRest | null): string => (r ? JSON.stringify(r) : "");

export function parseRunningRest(raw: string | null): RunningRest | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<RunningRest>;
    if (typeof v?.sessionId !== "string" || typeof v.endsAt !== "number" || typeof v.durationMs !== "number") return null;
    return { sessionId: v.sessionId, endsAt: v.endsAt, durationMs: v.durationMs, label: typeof v.label === "string" ? v.label : null };
  } catch {
    return null;
  }
}

/** On opening the logger: restore a rest of this session that is still running, show "rest over" if it ended meanwhile, else drop it. */
export function restoreDecision(saved: RunningRest | null, sessionId: string, now: number): "restore" | "over" | "clear" | "none" {
  if (!saved) return "none";
  if (saved.sessionId !== sessionId) return "clear";
  return saved.endsAt > now ? "restore" : "over";
}

/** Whether leaving the logger cancels the rest alert (and its Live Activity): only when the workout ended, not on a plain collapse or swipe. */
export const cancelRestOnLeave = (workoutEnded: boolean): boolean => workoutEnded;
