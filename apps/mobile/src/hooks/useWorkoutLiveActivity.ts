import { useEffect, useRef } from "react";
import type { WorkoutActivityProps } from "../logic/workoutActivityModel";
import { workoutLiveActivity } from "../native/workoutLiveActivity";

export const LIVE_ACTIVITY_DEBOUNCE_MS = 400;

/** Changes that must reach the card at once (not debounced): a new exercise or set, rest start/stop, pause/resume, first show. */
export function flushNow(prev: WorkoutActivityProps | null, next: WorkoutActivityProps | null): boolean {
  if (!prev || !next) return prev !== next;
  return prev.exercise !== next.exercise || prev.setLine !== next.setLine || (prev.rest?.endsAt ?? null) !== (next.rest?.endsAt ?? null) || prev.pausedAt !== next.pausedAt;
}

/**
 * Keeps the workout Live Activity in step with the logger. Typing changes `detail` on every keystroke, so those syncs are debounced
 * (400 ms trailing); structural changes flush right away. On unmount (collapse, swipe back, Finish) the card is never ended blindly:
 * reconcile ends it only when no workout is open. The rest block stays, because the rest itself persists (useWorkoutRest).
 */
export function useWorkoutLiveActivity(props: WorkoutActivityProps | null, sessionOpen: () => Promise<boolean>) {
  const sent = useRef<WorkoutActivityProps | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const open = useRef(sessionOpen);
  open.current = sessionOpen;
  const content = props ? JSON.stringify(props) : null;
  useEffect(() => {
    if (!props) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const send = () => {
      timer.current = null;
      sent.current = props;
      void workoutLiveActivity.sync(props);
    };
    if (flushNow(sent.current, props)) send();
    else timer.current = setTimeout(send, LIVE_ACTIVITY_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);
  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      if (latest.current) void workoutLiveActivity.sync(latest.current); // don't drop a debounced edit
    }
    void workoutLiveActivity.reconcile(() => open.current());
  }, []);
}
