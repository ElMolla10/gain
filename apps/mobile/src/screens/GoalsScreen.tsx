import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useServices } from "../AppContext";
import type { LibraryExercise } from "../db/programmeRepo";
import type { PaceResult, WeighIn } from "../db/goalRepo";
import type { StoredReview } from "../db/weeklyRepo";
import { changeText } from "../components/WeeklyReviewCard";
import { DateSelect } from "../components/DateSelect";
import { ExercisePicker } from "../components/ExercisePicker";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { buildGoal, emptyGoalForm, parseWeighIn, type GoalForm } from "../logic/goalForm";
import { parseNumber } from "../logic/gymInput";
import { MUSCLE_GROUPS } from "../logic/exposure";
import { describePace } from "../logic/paceText";
import { kgToUnit, unitToKg } from "../logic/units";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, Field } from "../ui";
import { HealthNote } from "../components/HealthNote";

/** Goals and pace: the one goal, how it stands, and weigh-ins. Pace is an estimate from the lifter's logs and says so. */
export function GoalsScreen() {
  const { goals, programmes, weekly } = useServices();
  const { t, lang, fmt, unit, unitText } = useI18n();
  const p = usePalette();
  const [pace, setPace] = useState<PaceResult | null>(null);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [weighIns, setWeighIns] = useState<WeighIn[]>([]);
  const [form, setForm] = useState<GoalForm>(emptyGoalForm());
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [weighText, setWeighText] = useState("");
  const [weighBad, setWeighBad] = useState(false);
  const [saved, setSaved] = useState(false);
  const [decided, setDecided] = useState<StoredReview[]>([]);

  const refresh = useCallback(async () => {
    setPace(await goals.getPace(Date.now()));
    setWeighIns(await goals.listWeighIns(10));
    setLibrary(await programmes.listExercises());
    setDecided(await weekly.listDecided(10));
  }, [goals, programmes, weekly]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Start the form from the current goal so a small change is one edit, not a retype.
  useEffect(() => {
    void goals.getGoal().then((g) => {
      if (!g) return;
      const f = emptyGoalForm();
      f.kind = g.kind;
      if (g.kind === "lift") Object.assign(f, { exerciseId: g.exerciseId, loadText: String(kgToUnit(g.targetLoad, unit)), repsText: String(g.targetReps), dateText: g.targetDate ?? "" });
      if (g.kind === "bodyweight") Object.assign(f, { weightText: String(kgToUnit(g.targetWeightKg, unit)), dateText: g.targetDate ?? "" });
      if (g.kind === "muscle") f.muscle = g.muscle;
      setForm(f);
    });
  }, [goals, unit]);

  const byId = useMemo(() => new Map(library.map((e) => [e.id, e])), [library]);
  const nameOf = (id: string | null) => (id && byId.get(id) ? exerciseLabels(byId.get(id)!, lang).primary : "");
  const text = pace ? describePace(pace, { t, fmt, exerciseName: pace.kind === "lift" ? nameOf(pace.goal.exerciseId) : "", muscleName: (m) => t(`muscle.${m}` as StringKey) }) : null;
  const set = (patch: Partial<GoalForm>) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };
  const row = (children: React.ReactNode) => <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{children}</View>;

  async function save() {
    const r = buildGoal(form, unit, Date.now());
    setProblems(r.problems);
    if (!r.goal) return;
    await goals.setGoal(r.goal);
    setSaved(true);
    setEditing(false);
    await refresh();
  }
  async function weigh() {
    const kg = parseWeighIn(weighText, unit, unitToKg, parseNumber);
    setWeighBad(kg === null);
    if (kg === null) return;
    await goals.addWeighIn(kg);
    setWeighText("");
    await refresh();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <AppText style={{ fontWeight: "600" }}>{t("goals.current")}</AppText>
        {text ? (
          <>
            <AppText style={{ fontSize: 16, fontWeight: "600" }}>{pace?.kind === "none" ? t("goals.none") : text.headline}</AppText>
            {text.details.map((d, i) => (
              <AppText key={i}>{d}</AppText>
            ))}
          </>
        ) : null}
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("goals.estimate")}</AppText>
        {saved ? <AppText style={{ fontWeight: "600" }}>✓ {t("goals.saved")}</AppText> : null}
      </Card>

      <Card>
        <BigButton label={t("goals.edit")} selected={editing} onPress={() => setEditing((v) => !v)} />
        {editing ? (
          <View style={{ gap: space.sm }}>
            {row((["lift", "bodyweight", "muscle"] as const).map((k) => <Chip key={k} label={t(`ob.goal.${k}` as StringKey)} selected={form.kind === k} onPress={() => set({ kind: k })} />))}
            {form.kind === "lift" ? (
              <>
                <BigButton label={nameOf(form.exerciseId) || t("goals.chooseExercise")} selected={false} onPress={() => setPicker(true)} />
                <Field label={t("ob.goal.load", { unit: unitText })} value={form.loadText} onChangeText={(s) => set({ loadText: s })} numeric />
                <Field label={t("ob.goal.reps")} value={form.repsText} onChangeText={(s) => set({ repsText: s })} numeric />
              </>
            ) : null}
            {form.kind === "bodyweight" ? <Field label={t("ob.goal.weight", { unit: unitText })} value={form.weightText} onChangeText={(s) => set({ weightText: s })} numeric /> : null}
            {form.kind === "muscle" ? row(MUSCLE_GROUPS.filter((m) => m !== "other").map((m) => <Chip key={m} label={t(`muscle.${m}` as StringKey)} selected={form.muscle === m} onPress={() => set({ muscle: m })} />)) : null}
            {form.kind === "lift" || form.kind === "bodyweight" ? <DateSelect label={t("ob.goal.date")} value={form.dateText} onChange={(s) => set({ dateText: s })} years="future" span={10} /> : null}
            {problems.map((c, i) => (
              <AppText key={i} style={{ fontWeight: "600" }}>
                ⚠ {t(`ob.problem.${c}` as StringKey, { min: fmt(30), max: fmt(300) })}
              </AppText>
            ))}
            <BigButton label={t("goals.save")} onPress={() => void save()} />
          </View>
        ) : null}
        {pace && pace.kind !== "none" ? <BigButton label={t("goals.clear")} selected={false} onPress={() => void goals.clearGoal().then(refresh)} /> : null}
      </Card>

      <ExercisePicker
        visible={picker}
        exercises={library.filter((e) => e.measure === "reps") /* a goal lift is a weight on the bar: holds and carries are not goal lifts */}
        onClose={() => setPicker(false)}
        onCreate={programmes.createExercise}
        onPick={(id) => {
          set({ exerciseId: id });
          setPicker(false);
          void refresh();
        }}
      />

      <Card>
        <AppText style={{ fontWeight: "600" }}>{t("goals.weighIn")}</AppText>
        <Field label={t("goals.weighIn.field", { unit: unitText })} value={weighText} onChangeText={(s) => { setWeighBad(false); setWeighText(s); }} numeric />
        {weighBad ? <AppText style={{ fontWeight: "600" }}>⚠ {t("goals.weighIn.bad", { min: fmt(30), max: fmt(300) })}</AppText> : null}
        <BigButton label={t("goals.weighIn.save")} onPress={() => void weigh()} />
        <AppText style={{ fontWeight: "600" }}>{t("goals.weighIn.recent")}</AppText>
        {weighIns.length === 0 ? <AppText style={{ color: p.muted }}>{t("goals.weighIn.none")}</AppText> : null}
        {weighIns.map((w) => (
          <View key={w.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md }}>
            <AppText ltr>{new Date(w.at).toISOString().slice(0, 10)}</AppText>
            <AppText ltr style={{ fontWeight: "600" }}>{fmt(w.kg)}</AppText>
            <Chip label={t("goals.weighIn.delete")} onPress={() => void goals.deleteWeighIn(w.id).then(refresh)} />
          </View>
        ))}
      </Card>
      <Card>
        <AppText style={{ fontWeight: "600" }}>{t("weekly.history")}</AppText>
        {decided.length === 0 ? <AppText style={{ color: p.muted }}>{t("weekly.history.none")}</AppText> : null}
        {decided.map((d) => (
          <View key={d.id} style={{ gap: 2 }}>
            <AppText style={{ fontWeight: "600" }}>
              {t("weekly.week", { date: d.weekStart })} · {t(`weekly.status.${d.status}` as StringKey)}
            </AppText>
            <AppText style={{ color: p.muted }}>{d.applied ? changeText({ kind: "move_date", newDate: d.applied.newDate }, t) : changeText(d.review.change, t)}</AppText>
          </View>
        ))}
      </Card>
      <HealthNote />
    </ScrollView>
  );
}
