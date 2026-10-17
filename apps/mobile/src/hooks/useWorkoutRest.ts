import { useEffect, useRef, useState } from "react";
import { haptics } from "../haptics";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { defaultRestSettings, loadRestSettings, syncRestAlert, type RestSettings } from "../logic/restAlert";
import { newTimer, stopTimer, type RestTimer } from "../logic/restTimer";
import { diagnostics } from "../diagnostics";
import { parseRunningRest, REST_RUNNING_KEY, restoreDecision, serializeRunningRest } from "../logic/restPersist";

/**
 * Timer lifecycle uses deadlines, never a ticking state update in the logger.
 * The running rest is persisted per session (logic/restPersist.ts), so leaving the logger without finishing keeps the alert and the
 * Live Activity's rest block, and reopening restores the countdown. `endRest` (finish / discard) is the only path that tears them down.
 */
export function useWorkoutRest(sessionId: string | null = null) {
  const { repos, restAlerts } = useServices();
  const { t } = useI18n();
  const [timer, setTimer] = useState<RestTimer>(() => newTimer());
  const [timerOpen, setTimerOpen] = useState(false);
  /** The exercise the running (or just finished) rest belongs to, shown in the rest dock. */
  const [restFor, setRestFor] = useState<string | null>(null);
  const [rest, setRest] = useState<RestSettings>(defaultRestSettings());
  const [restOver, setRestOver] = useState(false);
  /** Until the persisted rest was read for this session, don't sync the alert or Live Activity (an idle timer would cancel them). */
  const [restored, setRestored] = useState(false);
  const ended = useRef(false);

  // Restore a rest that was running when the logger was last left (or the app was terminated).
  useEffect(() => {
    if (!sessionId) return;
    let live = true;
    void repos.getSetting(REST_RUNNING_KEY).then(async (raw) => {
      if (!live) return;
      const saved = parseRunningRest(raw);
      const d = restoreDecision(saved, sessionId, Date.now());
      if (d === "restore" && saved) {
        setTimer({ endsAt: saved.endsAt, durationMs: saved.durationMs });
        setRestFor(saved.label);
      } else if (d === "over") setRestOver(true);
      if (d === "over" || d === "clear") await repos.setSetting(REST_RUNNING_KEY, "");
    }).catch((e) => diagnostics.record("warn", "restore rest", e)).finally(() => { if (live) setRestored(true); });
    return () => { live = false; };
  }, [repos, sessionId]);

  // Persist the running rest (start, +/-, stop, end) once restored.
  useEffect(() => {
    if (!restored || !sessionId || ended.current) return;
    const value = timer.endsAt !== null && timer.endsAt > Date.now() ? serializeRunningRest({ sessionId, endsAt: timer.endsAt, durationMs: timer.durationMs, label: restFor }) : "";
    void repos.setSetting(REST_RUNNING_KEY, value).catch((e) => diagnostics.record("warn", "save rest", e));
  }, [timer, restFor, restored, sessionId, repos]);

  // Rest settings: the default length (unless a rest is already running) and whether to vibrate / notify.
  useEffect(() => {
    void loadRestSettings(repos).then((s) => {
      setRest(s);
      setTimer((tm) => (tm.endsAt === null ? newTimer(s.seconds) : tm));
    });
  }, [repos]);

  // Keep the end-of-rest notification in step with the timer, so the alert arrives with the screen off.
  useEffect(() => {
    if (!restored || ended.current) return;
    void syncRestAlert(restAlerts, timer, rest, { title: t("rest.alert.title"), body: t("rest.alert.body") }, Date.now());
  }, [timer, rest, restAlerts, t, restored]);

  // When the rest timer reaches zero: buzz once, remember it, stop. One timeout at the end time, not a per-tick check on the screen.
  useEffect(() => {
    if (timer.endsAt === null) return;
    const fire = () => {
      if (rest.vibrate) haptics.restOver();
      setRestOver(true);
      setTimer((tm) => stopTimer(tm));
    };
    const wait = timer.endsAt - Date.now();
    if (wait <= 0) {
      fire();
      return;
    }
    const h = setTimeout(fire, wait);
    return () => clearTimeout(h);
  }, [timer, rest.vibrate]);


  // No cleanup on unmount: collapsing the logger or swiping back keeps the scheduled alert (the workout is still open).
  // The Live Activity (rest included) is driven by useWorkoutLiveActivity from the session.

  /** The workout was finished or discarded: cancel the alert and forget the running rest. Never throws. */
  async function endRest() {
    ended.current = true;
    setTimer((tm) => stopTimer(tm));
    await Promise.all([
      restAlerts.cancel().catch(() => undefined),
      repos.setSetting(REST_RUNNING_KEY, "").catch((e) => diagnostics.record("warn", "clear rest", e)),
    ]);
  }
  return { timer, setTimer, timerOpen, setTimerOpen, restFor, setRestFor, rest, setRest, restOver, setRestOver, endRest, restored };
}
