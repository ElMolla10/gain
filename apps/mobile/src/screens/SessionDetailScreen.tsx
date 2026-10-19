import type { SessionSummary } from "../db/finishRepo";
import { AchievementCard } from "../components/AchievementCard";
import { SessionPostMortemHero } from "../components/history/SessionPostMortemHero";
import { ExerciseChronicleCard } from "../components/history/ExerciseChronicleCard";
import type { Measure } from "@gain/engine";
import { isTimed, parseQuantityInput, setQuantity } from "../logic/quantity";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useLayoutEffect, useState } from "react";
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
  const navigation = useNavigation<{ goBack: () => void; setOptions: (o: { title: string }) => void }>();
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

  // One title (N-2): the day name goes in the native header, not as a second title in the body.
  const headerTitle = detail && detail !== "none" ? (detail.imported ? t("history.imported") : detail.dayName) : null;
  useLayoutEffect(() => { if (headerTitle) navigation.setOptions({ title: headerTitle }); }, [navigation, headerTitle]);

  if (detail === null) return <LoadingState />;
  if (detail === "none") return <EmptyState icon="progress" title={t("empty.workoutMissing")} />;

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
    <Screen>
      <SessionPostMortemHero detail={detail} summary={summary} unit={unit} />

      {/* Action Toolbar */}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <BigButton
            variant="secondary"
            icon={editing ? "check" : "edit"}
            label={editing ? t("common.done") : t("history.editWorkout")}
            onPress={() => { setEditing((v) => !v); setEdit(null); setAsking(null); setErr(null); }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <BigButton
            variant="secondary"
            icon="export"
            label={t("recap.shareText")}
            loading={sharingText}
            disabled={sharingText}
            onPress={() => void shareWorkout()}
          />
        </View>
      </View>

      {shareFailed ? <InlineStatus kind="error" text={t("recap.shareFailed")} /> : null}
      {editing ? <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("history.editNote")}</AppText> : null}

      {summary ? <AchievementCard detail={detail} summary={summary} /> : null}

      {detail.exercises.map((ex) => {
        const exSummary = summary?.exercises.find((s) => s.exerciseId === ex.exerciseId);
        return (
          <ExerciseChronicleCard
            key={ex.exerciseId}
            exercise={ex}
            summary={exSummary}
            unit={unit}
            editing={editing}
            editState={edit}
            askingId={asking}
            errorMessage={err}
            onStartEdit={startEdit}
            onSaveEdit={(measure) => void save(measure)}
            onCancelEdit={() => { setEdit(null); setErr(null); }}
            onChangeEdit={(s) => setEdit(s)}
            onAskDelete={(setId) => { setEdit(null); setAsking(setId); }}
            onConfirmDelete={async (setId) => {
              try {
                await history.removeSet(setId);
              } catch {
                setErr("history.err.missing");
              }
              setAsking(null);
              await refresh();
            }}
            onCancelDelete={() => setAsking(null)}
          />
        );
      })}
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <BigButton variant="danger" label={t("history.deleteWorkout")} loading={deletingWorkout} disabled={deletingWorkout || sharingText} onPress={confirmDeleteWorkout} />
        {deleteFailed ? <InlineStatus kind="error" text={t("history.deleteWorkoutFailed")} /> : null}
      </View>
    </Screen>
  );
}
