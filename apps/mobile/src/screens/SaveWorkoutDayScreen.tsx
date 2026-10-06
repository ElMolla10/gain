import type { Measure } from "@gain/engine";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { DraftInvalid, NoActiveProgramme, ProgrammeDayLimit, SessionInProgress, type WorkoutDayExercisePreview } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { MAX_DAYS, MAX_SETS } from "../logic/programmeDraft";
import { draftExerciseFromPreview } from "../logic/workoutDay";
import { space, type as ty, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card, Chip, EmptyState, Field, LoadingState, Notice, Screen, Stepper } from "../ui";

/** Letters that still mark two exercises. Removing one of a pair hides the letter; the group is never saved. */
function liveSuperset(rows: readonly WorkoutDayExercisePreview[], letter: string | null): string | null {
  if (!letter) return null;
  return rows.filter((r) => r.superset === letter).length >= 2 ? letter : null;
}

/**
 * Review one finished workout as a new program day, then save it on purpose.
 * Edits here change only this day. Nothing is written until Save.
 */
export function SaveWorkoutDayScreen() {
  const { programmes } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ goBack: () => void }>();
  const sessionId = (useRoute().params as { sessionId: string }).sessionId;
  const [state, setState] = useState<"loading" | "none" | "ready">("loading");
  const [name, setName] = useState("");
  const [rows, setRows] = useState<WorkoutDayExercisePreview[]>([]);
  const [nextVersion, setNextVersion] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<DraftInvalid["problems"]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const [preview, active] = await Promise.all([programmes.previewWorkoutDay(sessionId), programmes.getActive()]);
      if (!live) return;
      if (!preview) {
        setState("none");
        return;
      }
      setName(preview.dayName);
      setRows(preview.exercises);
      if (active) {
        setNextVersion(active.version + 1);
        const draft = await programmes.loadDraft(active.versionId);
        if (!live) return;
        if (draft.days.length >= MAX_DAYS) setMessage(t("history.saveAsDay.dayLimit"));
      }
      setState("ready");
    })().catch(() => {
      if (live) setState("none");
    });
    return () => {
      live = false;
    };
  }, [programmes, sessionId, t]);

  if (state === "loading") return <LoadingState />;
  if (state === "none") return <EmptyState icon="progress" title={t("history.saveAsDay.missing")} />;

  const patch = (index: number, partial: Partial<WorkoutDayExercisePreview>) => {
    setRows((curr) => curr.map((r, i) => (i === index ? { ...r, ...partial } : r)));
  };
  const move = (from: number, to: number) => {
    setRows((curr) => {
      if (to < 0 || to >= curr.length || from === to) return curr;
      const next = [...curr];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row!);
      return next;
    });
  };
  const range = (measure: Measure): { from: StringKey; to: StringKey; step: number; max: number } =>
    measure === "time"
      ? { from: "prog.ex.secFrom", to: "prog.ex.secTo", step: 5, max: 3600 }
      : measure === "distance"
        ? { from: "prog.ex.metresFrom", to: "prog.ex.metresTo", step: 5, max: 5000 }
        : { from: "prog.ex.repsFrom", to: "prog.ex.repsTo", step: 1, max: 100 };

  async function save() {
    setSaving(true);
    setProblems([]);
    setMessage(null);
    try {
      const result = await programmes.saveWorkoutAsDay({ name, exercises: rows.map((r) => draftExerciseFromPreview(r)) });
      if (!result.changed) {
        setMessage(t("prog.noChange"));
        return;
      }
      nav.goBack();
    } catch (e) {
      if (e instanceof ProgrammeDayLimit) setMessage(t("history.saveAsDay.dayLimit"));
      else if (e instanceof SessionInProgress) setMessage(t("prog.openWorkout"));
      else if (e instanceof NoActiveProgramme) setMessage(t("history.saveAsDay.noProgram"));
      else if (e instanceof DraftInvalid) setProblems(e.problems);
      else throw e;
    } finally {
      setSaving(false);
    }
  }

  const anySuperset = rows.some((r) => liveSuperset(rows, r.superset));

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("history.saveAsDay.keeps")}</AppText>
          <BigButton label={nextVersion ? t("prog.save", { v: nextVersion }) : t("history.saveAsDay")} loading={saving} onPress={() => void save()} />
        </View>
      }
    >
      <Notice kind="info">{t("history.saveAsDay.straight")}</Notice>
      {anySuperset ? <AppText style={{ color: p.muted }}>{t("history.saveAsDay.supersetNote")}</AppText> : null}
      <Field label={t("prog.day.name")} value={name} onChangeText={setName} />
      {rows.length === 0 ? <Notice kind="warn">{t("history.saveAsDay.empty")}</Notice> : null}
      {rows.map((r, i) => {
        const spec = range(r.measure);
        const letter = liveSuperset(rows, r.superset);
        return (
          <Card key={r.exerciseId}>
            <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{exerciseLabels(r, lang).primary}</AppText>
            {letter ? <AppText style={{ color: p.muted }}>{t("history.saveAsDay.superset", { letter })}</AppText> : null}
            {r.combined ? <AppText style={{ color: p.muted }}>{t("history.saveAsDay.combined")}</AppText> : null}
            {r.sets > MAX_SETS ? <Notice kind="warn">{t("history.saveAsDay.setsOver", { n: r.sets })}</Notice> : null}
            <Stepper label={t("prog.ex.sets")} value={r.sets} min={1} max={Math.max(MAX_SETS, r.sets)} onChange={(n) => patch(i, { sets: n })} />
            <Stepper label={t(spec.from)} value={r.repMin} min={1} max={spec.max} step={spec.step} onChange={(n) => patch(i, { repMin: n, repMax: Math.max(r.repMax, n) })} />
            <Stepper label={t(spec.to)} value={r.repMax} min={r.repMin} max={spec.max} step={spec.step} onChange={(n) => patch(i, { repMax: n })} />
            <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
              <Chip label={t("prog.up")} onPress={() => move(i, i - 1)} />
              <Chip label={t("prog.down")} onPress={() => move(i, i + 1)} />
              <Chip label={t("prog.ex.remove")} tone="danger" onPress={() => setRows((curr) => curr.filter((_, j) => j !== i))} />
            </View>
          </Card>
        );
      })}
      {problems.map((pr, i) => (
        <Notice key={`${pr.code}-${i}`} kind="error">{t(`prog.problem.${pr.code}` as StringKey, { day: (pr.day ?? 0) + 1 })}</Notice>
      ))}
      {message ? <Notice kind="warn">{message}</Notice> : null}
      <ArDraftNote />
    </Screen>
  );
}
