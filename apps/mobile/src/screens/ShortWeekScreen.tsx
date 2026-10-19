import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { SessionInProgress, type LibraryExercise } from "../db/programmeRepo";
import { ShortWeekActive, type ActiveShortWeek, type ShortWeekPreview } from "../db/shortWeekRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { space, usePalette } from "../theme";
import { AppText, Card, Chip, Notice, Screen } from "../ui";
import { ShortWeekImpactCard } from "../components/coach/ShortWeekImpactCard";

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
      <AppText style={{ color: p.muted }}>{t("short.intro")}</AppText>
      <Card>
        <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("short.days")}</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {dayChips.map((d) => <Chip key={d} label={String(d)} selected={days === d} onPress={() => setDays(d)} />)}
        </View>
        <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("short.minutes")}</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Chip label={t("short.minutes.none")} selected={minutes === null} onPress={() => setMinutes(null)} />
          {MINUTES.map((m) => <Chip key={m} label={t("short.minutesValue", { n: m })} selected={minutes === m} onPress={() => setMinutes(m)} />)}
        </View>
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("short.estimate")}</AppText>
      </Card>
      <ShortWeekImpactCard
        preview={preview}
        minutes={minutes}
        active={active}
        nameOf={nameOf}
        onApply={() => void apply()}
        onUndo={() => void undo()}
      />
      {msg ? <Notice kind="info">{t(msg)}</Notice> : null}
    </Screen>
  );
}
