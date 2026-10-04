import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { SessionInProgress, type LibraryExercise } from "../db/programmeRepo";
import { ShortWeekActive, type ActiveShortWeek, type ShortWeekPreview } from "../db/shortWeekRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { FLOOR_SESSIONS, FLOOR_SETS, type Cut } from "../logic/shortWeek";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, InlineStatus, Notice, Screen } from "../ui";

const MINUTES = [30, 45, 60, 75, 90];

/** "I can train D days / I have M minutes": preview of the cut list and exposure change, then save as a new program version, or undo. */
export function ShortWeekScreen() {
  const { shortWeek, programmes } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const [maxDays, setMaxDays] = useState(0);
  const [days, setDays] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [preview, setPreview] = useState<ShortWeekPreview | null>(null);
  const [active, setActive] = useState<ActiveShortWeek | null>(null);
  const [library, setLibrary] = useState<Map<string, LibraryExercise>>(new Map());
  const [msg, setMsg] = useState<StringKey | null>(null);

  const refresh = useCallback(async () => {
    const [a, lib, v] = await Promise.all([shortWeek.getActive(), programmes.listExercises(), programmes.getActive()]);
    setActive(a);
    setLibrary(new Map(lib.map((e) => [e.id, e])));
    if (v) {
      const d = await programmes.loadDraft(a ? a.originalVersionId : v.versionId);
      setMaxDays(d.days.length);
      setDays((cur) => cur ?? d.days.length);
    }
  }, [shortWeek, programmes]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (days === null) return;
    let alive = true;
    shortWeek.preview(days, minutes).then((r) => alive && setPreview(r)).catch(() => alive && setPreview(null));
    return () => {
      alive = false;
    };
  }, [shortWeek, days, minutes, active]);

  const nameOf = (id?: string) => (id && library.get(id) ? exerciseLabels(library.get(id)!, lang).primary : "");
  const cutText = (c: Cut) => {
    const base =
      c.kind === "day_dropped" ? t("short.cut.day_dropped", { day: c.day })
      : c.kind === "exercise_removed" ? t("short.cut.exercise_removed", { day: c.day, name: nameOf(c.exerciseId), sets: c.fromSets ?? 0 })
      : c.kind === "sets_reduced" ? t("short.cut.sets_reduced", { day: c.day, name: nameOf(c.exerciseId), from: c.fromSets ?? 0, to: c.toSets ?? 0 })
      : t("short.cut.moved", { day: c.day, name: nameOf(c.exerciseId), toDay: c.toDay ?? "" });
    return `${base} (${t(`short.reason.${c.reason}` as StringKey)})`;
  };
  const dayChips = useMemo(() => Array.from({ length: maxDays }, (_, i) => i + 1), [maxDays]);

  async function apply() {
    if (days === null) return;
    try {
      await shortWeek.apply(days, minutes);
      setMsg("short.applied");
      await refresh();
    } catch (e) {
      if (e instanceof SessionInProgress) setMsg("short.openWorkout");
      else if (e instanceof ShortWeekActive) setMsg("short.alreadyActive");
      else throw e;
    }
  }
  async function undo() {
    try {
      const r = await shortWeek.undo();
      setMsg(r.restored ? "short.undone" : "short.undoneKept");
      await refresh();
    } catch (e) {
      if (e instanceof SessionInProgress) setMsg("short.openWorkout");
      else throw e;
    }
  }

  return (
    <Screen>
      <AppText>{t("short.intro")}</AppText>
      {active ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("short.active", { days: active.days })}</AppText>
          <BigButton label={t("short.undo")} variant="secondary" onPress={() => void undo()} />
        </Card>
      ) : null}
      <Card>
        <AppText style={{ fontWeight: "600" }}>{t("short.days")}</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {dayChips.map((d) => <Chip key={d} label={String(d)} selected={days === d} onPress={() => setDays(d)} />)}
        </View>
        <AppText style={{ fontWeight: "600" }}>{t("short.minutes")}</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Chip label={t("short.minutes.none")} selected={minutes === null} onPress={() => setMinutes(null)} />
          {MINUTES.map((m) => <Chip key={m} label={t("short.minutesValue", { n: m })} selected={minutes === m} onPress={() => setMinutes(m)} />)}
        </View>
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("short.estimate")}</AppText>
      </Card>
      {preview ? (
        <>
          <Card>
            <AppText style={{ fontWeight: "600" }}>{t("short.preview")}: {t("short.keptDays")}</AppText>
            {preview.rebuild.draft.days.map((d, i) => (
              <AppText key={i}>{t("short.dayLine", { name: d.name, sets: d.exercises.reduce((n, e) => n + e.sets, 0), min: preview.rebuild.minutes[i]! })}</AppText>
            ))}
            {preview.rebuild.overBudget && minutes !== null ? <InlineStatus kind="warn" text={t("short.overBudget", { min: minutes })} /> : null}
            {preview.rebuild.floorMissed.length > 0 ? <InlineStatus kind="warn" text={t("short.floorMissed", { muscles: preview.rebuild.floorMissed.map((m) => t(`muscle.${m}` as StringKey)).join(", ") })} /> : null}
            <AppText style={{ color: p.muted, fontSize: 13 }}>{t("short.protected", { sets: FLOOR_SETS, sessions: FLOOR_SESSIONS })}</AppText>
          </Card>
          <Card>
            <AppText style={{ fontWeight: "600" }}>{t("short.cuts")}</AppText>
            {preview.rebuild.cuts.length === 0 ? <AppText>{t("short.cuts.none")}</AppText> : preview.rebuild.cuts.map((c, i) => <AppText key={i}>• {cutText(c)}</AppText>)}
          </Card>
          {preview.exposure.length > 0 ? (
            <Card>
              <AppText style={{ fontWeight: "600" }}>{t("short.exposure")}</AppText>
              {preview.exposure.map((c) => (
                <AppText key={c.group}>
                  {t("short.exposureLine", { muscle: t(`muscle.${c.group}` as StringKey), before: c.before?.setsPerWeek ?? c.before?.setsPerRotation ?? 0, after: c.after?.setsPerWeek ?? c.after?.setsPerRotation ?? 0, sb: c.before?.sessionsPerWeek ?? 0, sa: c.after?.sessionsPerWeek ?? 0 })}
                </AppText>
              ))}
            </Card>
          ) : null}
          {!active ? <BigButton hero label={t("short.apply")} onPress={() => void apply()} /> : null}
        </>
      ) : null}
      {msg ? <Notice kind="info">{t(msg)}</Notice> : null}
    </Screen>
  );
}
