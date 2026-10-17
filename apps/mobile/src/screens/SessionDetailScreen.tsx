import type { SessionSummary } from "../db/finishRepo";
import { AchievementCard } from "../components/AchievementCard";
import type { Measure } from "@gain/engine";
import { isTimed, parseQuantityInput, setQuantity } from "../logic/quantity";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Alert, Share, View, type TextStyle } from "react-native";
import { useServices } from "../AppContext";
import { HistoryInvalid, type HistorySetRow, type SessionDetail } from "../db/historyRepo";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { parseNumber } from "../logic/gymInput";
import { formatDay } from "../logic/dateText";
import { editedKg, kgToUnit, weightText } from "../logic/units";
import { rowLabels } from "../logic/workoutRows";
import { MIN_TOUCH, space, type as ty, usePalette } from "../theme";
import { formatWorkoutShareText } from "../logic/workoutRecap";
import { diagnostics } from "../diagnostics";
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
  const { history, finish } = useServices();
  const navigation = useNavigation<{ goBack: () => void }>();
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = usePalette();
  const sessionId = (useRoute().params as { sessionId: string }).sessionId;
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null | "none">(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  // Read mode by default (H-6): a compact table. Per-set edit and delete only show in edit mode.
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<StringKey | null>(null);
  const [sharingText, setSharingText] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [deletingWorkout, setDeletingWorkout] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const refresh = useCallback(async () => {
    setSummary(null);
    const fresh = await history.getSession(sessionId);
    setDetail(fresh ?? "none");
    if (fresh) {
      try { setSummary(await finish.summarizeSession(sessionId)); }
      catch (e) { diagnostics.record("warn", "history achievement", e); }
    }
  }, [history, finish, sessionId]);
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

  const shareWorkout = async () => {
    if (sharingText) return;
    setSharingText(true);
    setShareFailed(false);
    try {
      // Re-fetch after edits: never share stale or deleted sets.
      const fresh = await history.getSession(sessionId);
      if (!fresh) throw new Error("Workout no longer exists");
      const summary = await finish.summarizeSession(sessionId);
      await Share.share({ message: formatWorkoutShareText(fresh, summary, lang, unit) });
    } catch (e) {
      diagnostics.record("warn", "history text share", e);
      setShareFailed(true);
    } finally {
      setSharingText(false);
    }
  };

  // A separate destructive action for the WHOLE workout, never confused with deleting one set.
  const deleteWholeWorkout = async () => {
    if (deletingWorkout || sharingText) return;
    setDeletingWorkout(true);
    setDeleteFailed(false);
    try {
      await history.deleteWorkout(sessionId);
      navigation.goBack(); // Progress reloads its session list on focus.
    } catch (e) {
      diagnostics.record("error", "delete finished workout", e);
      setDeleteFailed(true);
    } finally {
      setDeletingWorkout(false);
    }
  };

  const confirmDeleteWorkout = () => {
    if (deletingWorkout || sharingText) return;
    Alert.alert(t("history.deleteWorkoutTitle"), t("history.deleteWorkoutBody"), [
      { text: t("history.cancel"), style: "cancel" },
      { text: t("history.deleteWorkoutConfirm"), style: "destructive", onPress: () => void deleteWholeWorkout() },
    ]);
  };

  return (
    <Screen title={detail.imported ? t("history.imported") : detail.dayName}>
      {summary ? <AchievementCard detail={detail} summary={summary} /> : null}
      <BigButton variant="secondary" icon="export" label={t("recap.shareText")} loading={sharingText} disabled={sharingText} onPress={() => void shareWorkout()} />
      {shareFailed ? <InlineStatus kind="error" text={t("recap.shareFailed")} /> : null}
      <AppText style={{ color: p.muted, fontWeight: "600" }}>{formatDay(detail.finishedAt, lang)}</AppText>
      <BigButton variant="secondary" icon={editing ? "check" : "edit"} label={editing ? t("common.done") : t("history.editWorkout")} onPress={() => { setEditing((v) => !v); setEdit(null); setAsking(null); setErr(null); }} />
      {editing ? <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("history.editNote")}</AppText> : null}
      {detail.exercises.map((ex) => {
        const labels = rowLabels(ex.sets);
        const timed = isTimed(ex.measure);
        const head: TextStyle = { fontSize: ty.caption, fontWeight: "600", color: p.muted };
        const cell: TextStyle = { fontSize: ty.body, fontWeight: "600", fontVariant: ["tabular-nums"] };
        return (
        <Card key={ex.exerciseId}>
          <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{exerciseLabels(ex, lang).primary}</AppText>
          {/* Same column heads as the logger: set | kg/lb | reps (sec / metres) | RIR. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={{ width: 40 }}><AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={head}>{t("workout.col.set").toUpperCase()}</AppText></View>
            <View style={{ flex: 1 }}><AppText style={head}>{unitText.toUpperCase()}</AppText></View>
            <View style={{ flex: 1 }}><AppText style={head}>{(timed ? (ex.measure === "time" ? t("workout.col.sec") : t("workout.col.metres")) : t("workout.col.reps")).toUpperCase()}</AppText></View>
            {timed ? null : <View style={{ width: 48 }}><AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={head}>{t("workout.col.rir").toUpperCase()}</AppText></View>}
          </View>
          {ex.sets.map((s, i) => {
            const label = labels[i]!;
            return (
            <View key={s.id} style={{ borderTopWidth: 1, borderColor: p.border }}>
              <View style={{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: space.sm }}>
                {/* Warm-up / drop / failure markers as in the logger's done rows (W, D, F). */}
                <View style={{ width: 40 }}><AppText ltr style={{ ...cell, color: s.warmup ? p.warn : label === "D" || label === "F" ? p.accent : p.text }}>{label}</AppText></View>
                <View style={{ flex: 1 }}><AppText style={cell}>{isolateLtr(weightText(s.load, unit))}</AppText></View>
                <View style={{ flex: 1 }}><AppText style={cell}>{isolateLtr(String(timed ? setQuantity(s, ex.measure) : s.reps))}</AppText></View>
                {timed ? null : <View style={{ width: 48 }}><AppText style={{ ...cell, color: s.rir === null ? p.muted : p.text }}>{s.rir === null ? "–" : isolateLtr(String(s.rir))}</AppText></View>}
              </View>
              {s.warmup ? <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("history.warmup")}</AppText> : null}
              {!s.warmup && s.tags.includes("drop") ? <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("history.drop")}</AppText> : null}
              {!s.warmup && s.tags.includes("failure") ? <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("history.failure")}</AppText> : null}
              {s.outlierStatus === "unconfirmed" ? <InlineStatus kind="warn" text={t("history.unconfirmed")} /> : null}
              {s.outlierStatus === "confirmed" ? <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("history.confirmed")}</AppText> : null}
              {editing && edit?.setId === s.id ? (
                <View style={{ gap: space.sm, paddingBottom: space.sm }}>
                  <Field label={t("history.field.load", { unit: unitText })} value={edit.load} onChangeText={(v) => setEdit({ ...edit, load: v })} numeric keyboardType="decimal-pad" />
                  <Field label={ex.measure === "time" ? t("history.field.seconds") : ex.measure === "distance" ? t("history.field.metres") : t("history.field.reps")} value={edit.reps} onChangeText={(v) => setEdit({ ...edit, reps: v })} numeric keyboardType="number-pad" />
                  {isTimed(ex.measure) ? null : <Field label={t("history.field.rir")} value={edit.rir} onChangeText={(v) => setEdit({ ...edit, rir: v })} numeric keyboardType="decimal-pad" />}
                  {err ? <InlineStatus kind="error" text={t(err)} /> : null}
                  <BigButton label={t("history.save")} onPress={() => void save(ex.measure)} />
                  <BigButton variant="secondary" label={t("history.cancel")} onPress={() => { setEdit(null); setErr(null); }} />
                </View>
              ) : editing && asking === s.id ? (
                <View style={{ gap: space.lg, paddingBottom: space.sm }}>
                  <AppText>{t("history.deleteAsk")}</AppText>
                  <BigButton
                    variant="dangerSolid"
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
              ) : editing ? (
                // Edit mode only: the existing per-set actions (destructive style unchanged, plan 1.6).
                <View style={{ flexDirection: "row", gap: space.sm, paddingBottom: space.sm }}>
                  <View style={{ flex: 1 }}><BigButton variant="secondary" icon="edit" label={t("history.edit")} onPress={() => startEdit(s)} /></View>
                  <View style={{ flex: 1 }}><BigButton variant="danger" icon="trash" label={t("history.delete")} onPress={() => { setEdit(null); setAsking(s.id); }} /></View>
                </View>
              ) : null}
            </View>
            );
          })}
        </Card>
        );
      })}
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <BigButton variant="danger" label={t("history.deleteWorkout")} loading={deletingWorkout} disabled={deletingWorkout || sharingText} onPress={confirmDeleteWorkout} />
        {deleteFailed ? <InlineStatus kind="error" text={t("history.deleteWorkoutFailed")} /> : null}
      </View>
    </Screen>
  );
}
