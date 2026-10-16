import { weekStartOf } from "@gain/engine";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { SessionInProgress } from "../db/programmeRepo";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { countProgressWeeks, parsePeriodization, periodizationDue, serializePeriodization, weekStartsOf } from "../logic/periodization";
import { type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";

/** End-of-block reminder. Off until the lifter enables it. Reuses the existing lighter-week actions. */
export function PeriodizationCard() {
  const { repos, history, deload, weekly, achievements } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [due, setDue] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    let alive = true;
    void (async () => {
      const tz = -new Date().getTimezoneOffset() * 60_000;
      const [raw, startsOn, deloadState, sessions, pins] = await Promise.all([
        repos.getSetting("periodization"),
        weekly.weekStartsOn(),
        deload.getState(Date.now(), tz),
        history.listSessions(200),
        achievements.listPins(),
      ]);
      const state = parsePeriodization(raw);
      const nowWeek = weekStartOf(Date.now() + tz, startsOn);
      const sessionWeeks = weekStartsOf(
        sessions.map((s) => s.finishedAt),
        startsOn,
        tz,
      );
      const focus = [...pins]
        .filter((p) => p.startedWeek && (p.weeks === 4 || p.weeks === 5 || p.weeks === 6))
        .sort((a, b) => a.startedWeek!.localeCompare(b.startedWeek!))[0];
      const block = focus ? { ...state, weeks: focus.weeks!, startedWeek: focus.startedWeek! } : state;
      const progress = countProgressWeeks(sessionWeeks, block.startedWeek);
      const busyDeload = deloadState.status !== "none" && deloadState.status !== "dismissed";
      if (alive) {
        setWeeks(block.weeks);
        setDue(periodizationDue(block, nowWeek, progress, busyDeload));
      }
    })();
    return () => {
      alive = false;
    };
  }, [repos, history, deload, weekly, achievements]);

  useFocusEffect(refresh);

  async function decide(lighter: boolean) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const tz = -new Date().getTimezoneOffset() * 60_000;
      const startsOn = await weekly.weekStartsOn();
      const nowWeek = weekStartOf(Date.now() + tz, startsOn);
      const state = parsePeriodization(await repos.getSetting("periodization"));
      await repos.setSetting("periodization", serializePeriodization({ ...state, startedWeek: nowWeek, lastPromptWeek: nowWeek }));
      if (lighter) await deload.applyLoad(Date.now(), tz);
      setDue(false);
    } catch (e) {
      setNote(e instanceof SessionInProgress ? t("short.openWorkout") : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!due) return note ? <AppText style={{ color: p.muted }}>{note}</AppText> : null;
  return (
    <Card>
      <AppText style={{ fontWeight: "600", fontSize: ty.section }}>{t("coach.period.title")}</AppText>
      <AppText>{t("coach.period.due", { n: weeks })}</AppText>
      <BigButton label={t("coach.period.lighter")} disabled={busy} onPress={() => void decide(true)} />
      <BigButton variant="secondary" label={t("coach.period.continue")} disabled={busy} onPress={() => void decide(false)} />
      {note ? <AppText style={{ color: p.muted }}>{note}</AppText> : null}
    </Card>
  );
}
