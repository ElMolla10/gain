import { useFocusEffect, useRoute } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import { HistoryInvalid, type HistorySetRow, type SessionDetail } from "../db/historyRepo";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { parseNumber } from "../logic/gymInput";
import { localDateText } from "../logic/trendChart";
import { editedKg, kgToUnit } from "../logic/units";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Field } from "../ui";

interface EditState {
  setId: string;
  origKg: number;
  load: string;
  reps: string;
  rir: string;
}

/** A finished workout, set by set. A set can be corrected or deleted; planned targets are re-worked from the fixed history. */
export function SessionDetailScreen() {
  const { history } = useServices();
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = usePalette();
  const sessionId = (useRoute().params as { sessionId: string }).sessionId;
  const [detail, setDetail] = useState<SessionDetail | null | "none">(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [err, setErr] = useState<StringKey | null>(null);

  const refresh = useCallback(async () => setDetail((await history.getSession(sessionId)) ?? "none"), [history, sessionId]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (detail === null) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  if (detail === "none") return <AppText style={{ padding: space.lg }}>{t("history.err.missing")}</AppText>;

  const startEdit = (s: HistorySetRow) => {
    setErr(null);
    setAsking(null);
    setEdit({ setId: s.id, origKg: s.load, load: String(Math.round(kgToUnit(s.load, unit) * 100) / 100), reps: String(s.reps), rir: s.rir === null ? "" : String(s.rir) });
  };
  const save = async () => {
    if (!edit) return;
    const load = parseNumber(edit.load);
    const reps = parseNumber(edit.reps);
    const rir = edit.rir.trim() === "" ? null : parseNumber(edit.rir);
    if (load === null) return setErr("history.err.load");
    if (reps === null) return setErr("history.err.reps");
    if (edit.rir.trim() !== "" && rir === null) return setErr("history.err.rir");
    try {
      // An unchanged load must not drift by a few grams through the lb display.
      const kg = editedKg(load, edit.origKg, unit);
      await history.updateSet(edit.setId, { load: kg, reps, rir });
      setEdit(null);
      setErr(null);
      await refresh();
    } catch (e) {
      setErr(e instanceof HistoryInvalid ? (`history.err.${e.code}` as StringKey) : "history.err.missing");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      <AppText ltr style={{ fontWeight: "700" }}>{localDateText(detail.finishedAt)}</AppText>
      <AppText style={{ fontSize: 22, fontWeight: "800" }}>{detail.imported ? t("history.imported") : detail.dayName}</AppText>
      <AppText style={{ color: p.muted }}>{detail.gymName}</AppText>
      <AppText style={{ color: p.muted, fontSize: 13 }}>{t("history.editNote")}</AppText>
      {detail.exercises.map((ex) => (
        <Card key={ex.exerciseId}>
          <AppText style={{ fontSize: 18, fontWeight: "800" }}>{exerciseLabels(ex, lang).primary}</AppText>
          {ex.sets.map((s) => (
            <View key={s.id} style={{ gap: space.xs, paddingVertical: space.xs }}>
              <AppText style={{ fontSize: 18 }}>
                {fmt(s.load)} × {isolateLtr(String(s.reps))}
                {s.rir !== null ? `  ·  ${t("history.rir", { n: s.rir })}` : ""}
              </AppText>
              {s.warmup ? <AppText style={{ color: p.muted }}>{t("history.warmup")}</AppText> : null}
              {s.outlierStatus === "unconfirmed" ? <AppText style={{ color: "#b00020" }}>{t("history.unconfirmed")}</AppText> : null}
              {s.outlierStatus === "confirmed" ? <AppText style={{ color: p.muted }}>{t("history.confirmed")}</AppText> : null}
              {edit?.setId === s.id ? (
                <View style={{ gap: space.sm }}>
                  <Field label={t("history.field.load", { unit: unitText })} value={edit.load} onChangeText={(v) => setEdit({ ...edit, load: v })} numeric keyboardType="decimal-pad" />
                  <Field label={t("history.field.reps")} value={edit.reps} onChangeText={(v) => setEdit({ ...edit, reps: v })} numeric keyboardType="number-pad" />
                  <Field label={t("history.field.rir")} value={edit.rir} onChangeText={(v) => setEdit({ ...edit, rir: v })} numeric keyboardType="decimal-pad" />
                  {err ? <AppText style={{ color: "#b00020" }}>{t(err)}</AppText> : null}
                  <BigButton label={t("history.save")} onPress={save} />
                  <BigButton label={t("history.cancel")} selected={false} onPress={() => { setEdit(null); setErr(null); }} />
                </View>
              ) : asking === s.id ? (
                <View style={{ gap: space.sm }}>
                  <AppText>{t("history.deleteAsk")}</AppText>
                  <BigButton
                    label={t("history.deleteYes")}
                    onPress={async () => {
                      try {
                        await history.removeSet(s.id);
                      } catch {
                        setErr("history.err.missing");
                      }
                      setAsking(null);
                      await refresh();
                    }}
                  />
                  <BigButton label={t("history.cancel")} selected={false} onPress={() => setAsking(null)} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <View style={{ flex: 1 }}><BigButton label={t("history.edit")} selected={false} onPress={() => startEdit(s)} /></View>
                  <View style={{ flex: 1 }}><BigButton label={t("history.delete")} selected={false} onPress={() => { setEdit(null); setAsking(s.id); }} /></View>
                </View>
              )}
            </View>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}
