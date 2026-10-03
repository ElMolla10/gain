import type { Measure } from "@gain/engine";
import { isTimed, parseQuantityInput, setQuantity, targetPhrase } from "../logic/quantity";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { HistoryInvalid, type HistorySetRow, type SessionDetail } from "../db/historyRepo";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { parseNumber } from "../logic/gymInput";
import { localDateText } from "../logic/trendChart";
import { editedKg, kgToUnit } from "../logic/units";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, EmptyState, Field, InlineStatus, LoadingState, Screen } from "../ui";

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

  if (detail === null) return <LoadingState />;
  if (detail === "none") return <EmptyState icon="progress" title={t("history.err.missing")} />;

  const startEdit = (s: HistorySetRow) => {
    setErr(null);
    setAsking(null);
    setEdit({ setId: s.id, origKg: s.load, load: String(Math.round(kgToUnit(s.load, unit) * 100) / 100), reps: String(s.durationS ?? s.distanceM ?? s.reps), rir: s.rir === null ? "" : String(s.rir) });
  };
  const save = async (measure: Measure) => {
    if (!edit) return;
    const load = parseNumber(edit.load);
    const timedQ = isTimed(measure) ? parseQuantityInput(edit.reps, measure) : null;
    const reps = isTimed(measure) ? timedQ : parseNumber(edit.reps);
    const rir = edit.rir.trim() === "" ? null : parseNumber(edit.rir);
    if (load === null) return setErr("history.err.load");
    if (reps === null) return setErr(measure === "time" ? "history.err.duration" : measure === "distance" ? "history.err.distance" : "history.err.reps");
    if (edit.rir.trim() !== "" && rir === null) return setErr("history.err.rir");
    try {
      // An unchanged load must not drift by a few grams through the lb display.
      const kg = editedKg(load, edit.origKg, unit);
      await history.updateSet(edit.setId, isTimed(measure) ? { load: kg, reps: 1, rir: null, ...(measure === "time" ? { durationS: reps } : { distanceM: reps }) } : { load: kg, reps, rir });
      setEdit(null);
      setErr(null);
      await refresh();
    } catch (e) {
      setErr(e instanceof HistoryInvalid ? (`history.err.${e.code}` as StringKey) : "history.err.missing");
    }
  };

  return (
    <Screen title={detail.imported ? t("history.imported") : detail.dayName}>
      <AppText ltr style={{ color: p.muted, fontWeight: "600" }}>{localDateText(detail.finishedAt)}</AppText>
      <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("history.editNote")}</AppText>
      {detail.exercises.map((ex) => (
        <Card key={ex.exerciseId}>
          <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{exerciseLabels(ex, lang).primary}</AppText>
          {ex.sets.map((s) => (
            <View key={s.id} style={{ gap: space.xs, paddingVertical: space.sm, borderTopWidth: 1, borderColor: p.border }}>
              <AppText ltr style={{ fontSize: ty.section, fontWeight: "600" }}>
                {isTimed(ex.measure) ? isolateLtr(targetPhrase(s.load, setQuantity(s, ex.measure), ex.measure, fmt, { s: t("qty.s"), m: t("qty.m") })) : <>{fmt(s.load)} × {isolateLtr(String(s.reps))}</>}
                {s.rir !== null ? `  ·  ${t("history.rir", { n: s.rir })}` : ""}
              </AppText>
              {s.warmup ? <AppText style={{ color: p.muted }}>{t("history.warmup")}</AppText> : null}
              {!s.warmup && s.tags.includes("drop") ? <AppText style={{ color: p.muted }}>{t("history.drop")}</AppText> : null}
              {!s.warmup && s.tags.includes("failure") ? <AppText style={{ color: p.muted }}>{t("history.failure")}</AppText> : null}
              {s.outlierStatus === "unconfirmed" ? <InlineStatus kind="warn" text={t("history.unconfirmed")} /> : null}
              {s.outlierStatus === "confirmed" ? <AppText style={{ color: p.muted }}>{t("history.confirmed")}</AppText> : null}
              {edit?.setId === s.id ? (
                <View style={{ gap: space.sm }}>
                  <Field label={t("history.field.load", { unit: unitText })} value={edit.load} onChangeText={(v) => setEdit({ ...edit, load: v })} numeric keyboardType="decimal-pad" />
                  <Field label={ex.measure === "time" ? t("history.field.seconds") : ex.measure === "distance" ? t("history.field.metres") : t("history.field.reps")} value={edit.reps} onChangeText={(v) => setEdit({ ...edit, reps: v })} numeric keyboardType="number-pad" />
                  {isTimed(ex.measure) ? null : <Field label={t("history.field.rir")} value={edit.rir} onChangeText={(v) => setEdit({ ...edit, rir: v })} numeric keyboardType="decimal-pad" />}
                  {err ? <InlineStatus kind="error" text={t(err)} /> : null}
                  <BigButton label={t("history.save")} onPress={() => void save(ex.measure)} />
                  <BigButton variant="secondary" label={t("history.cancel")} onPress={() => { setEdit(null); setErr(null); }} />
                </View>
              ) : asking === s.id ? (
                <View style={{ gap: space.sm }}>
                  <AppText>{t("history.deleteAsk")}</AppText>
                  <BigButton
                    variant="danger"
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
                  <BigButton variant="secondary" label={t("history.cancel")} onPress={() => setAsking(null)} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <View style={{ flex: 1 }}><BigButton variant="secondary" icon="edit" label={t("history.edit")} onPress={() => startEdit(s)} /></View>
                  <View style={{ flex: 1 }}><BigButton variant="quiet" label={t("history.delete")} onPress={() => { setEdit(null); setAsking(s.id); }} /></View>
                </View>
              )}
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
