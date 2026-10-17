import { useEffect, useState } from "react";
import { Vibration } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { defaultRestSettings, loadRestSettings, syncRestAlert, type RestSettings } from "../logic/restAlert";
import { newTimer, stopTimer, type RestTimer } from "../logic/restTimer";
import { restLiveActivity } from "../native/restLiveActivity";

/** Timer lifecycle uses deadlines, never a ticking state update in the logger. */
export function useWorkoutRest() {
  const { repos, restAlerts } = useServices();
  const { t } = useI18n();
  const [timer, setTimer] = useState<RestTimer>(() => newTimer());
  const [timerOpen, setTimerOpen] = useState(false);
  /** The exercise the running (or just finished) rest belongs to, shown in the rest dock. */
  const [restFor, setRestFor] = useState<string | null>(null);
  const [rest, setRest] = useState<RestSettings>(defaultRestSettings());
  const [restOver, setRestOver] = useState(false);

  // Rest settings: the default length (unless a rest is already running) and whether to vibrate / notify.
  useEffect(() => {
    void loadRestSettings(repos).then((s) => {
      setRest(s);
      setTimer((tm) => (tm.endsAt === null ? newTimer(s.seconds) : tm));
    });
  }, [repos]);

  // Keep the end-of-rest notification in step with the timer, so the alert arrives with the screen off.
  useEffect(() => {
    void syncRestAlert(restAlerts, timer, rest, { title: t("rest.alert.title"), body: t("rest.alert.body") }, Date.now());
  }, [timer, rest, restAlerts, t]);

  // When the rest timer reaches zero: buzz once, remember it, stop. One timeout at the end time, not a per-tick check on the screen.
  useEffect(() => {
    if (timer.endsAt === null) return;
    const fire = () => {
      if (rest.vibrate) Vibration.vibrate(400);
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


  useEffect(() => {
    void restLiveActivity.sync({ endsAt: timer.endsAt, durationMs: timer.durationMs, label: restFor ?? t("workout.restTimerBtn"), restLabel: t("workout.restTimerBtn") });
  }, [timer, restFor, t]);
  useEffect(() => () => {
    void restAlerts.cancel().catch(() => undefined);
    void restLiveActivity.stop();
  }, [restAlerts]);
  return { timer, setTimer, timerOpen, setTimerOpen, restFor, setRestFor, rest, setRest, restOver, setRestOver };
}
