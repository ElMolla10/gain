import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
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
import { buildGoal, emptyGoalForm, keepOriginalKg, parseWeighIn, prefillFromGoal, type GoalForm, type GoalPrefillKg } from "../logic/goalForm";
import { parseNumber } from "../logic/gymInput";
import { MUSCLE_GROUPS } from "../logic/exposure";
import { describePace } from "../logic/paceText";
import { unitToKg } from "../logic/units";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, Field, InlineStatus, Screen } from "../ui";
import { HealthNote } from "../components/HealthNote";
import { diagnostics } from "../diagnostics";

/** Goals and pace: the one goal, how it stands, and weigh-ins. Pace is an estimate from the lifter's logs and says so. */
export function GoalsScreen() {
  const { goals, programmes, weekly } = useServices();
  const { t, lang, fmt, unit, unitText } = useI18n();
  const p = usePalette();
  const [pace, setPace] = useState<PaceResult | null>(null);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [weighIns, setWeighIns] = useState<WeighIn[]>([]);
  const [form, setForm] = useState<GoalForm>(emptyGoalForm());
  const [kept, setKept] = useState<GoalPrefillKg>({});
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [weighText, setWeighText] = useState("");
  const [weighBad, setWeighBad] = useState(false);
  const [saved, setSaved] = useState(false);
  const [decided, setDecided] = useState<StoredReview[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"goal" | "weigh" | null>(null);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    setPace(await goals.getPace(Date.now()));
    setWeighIns(await goals.listWeighIns(10));
    setLibrary(await programmes.listExercises());
    setDecided(await weekly.listDecided(10));
  }, [goals, programmes, weekly]);
  useFocusEffect(
    useCallback(() => {
      void refresh().catch((e) => diagnostics.record("warn", "goals refresh", e));
    }, [refresh]),
  );

  // Start the form from the current goal so a small change is one edit, not a retype.
  useEffect(() => {
    void goals.getGoal().then((g) => {
      if (!g) return;
      const pre = prefillFromGoal(g, unit);
      setKept(pre.kept);
      setForm(pre.form);
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

  /** One Goals write at a time (a double tap does nothing); a failure is recorded and shown next to its card, never an unhandled rejection. */
  async function run(action: "save" | "weigh" | "clear" | "delete", fn: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(null);
    try {
      await fn();
    } catch (e) {
      diagnostics.record("error", `goals ${action}`, e);
      setFailed(action === "save" || action === "clear" ? "goal" : "weigh");
      return;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    await refresh().catch((e) => diagnostics.record("warn", "goals refresh", e));
  }
  async function save() {
    const r = buildGoal(form, unit, Date.now());
    setProblems(r.problems);
    if (!r.goal) return;
    const goal = keepOriginalKg(r.goal, form, kept); // an untouched field saves the stored kg exactly
    await run("save", async () => {
      await goals.setGoal(goal);
      setSaved(true);
      setEditing(false);
    });
  }
  async function weigh() {
    const kg = parseWeighIn(weighText, unit, unitToKg, parseNumber);
    setWeighBad(kg === null);
    if (kg === null) return;
    await run("weigh", async () => {
      await goals.addWeighIn(kg);
      setWeighText("");
    });
  }
  // Destructive actions ask first (no undo).
  const askClear = () => {
    Alert.alert(t("goals.clear.confirmTitle"), t("goals.clear.confirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("goals.clear"), style: "destructive", onPress: () => void run("clear", () => goals.clearGoal()) },
    ]);
  };
  const askDelete = (w: WeighIn) => {
    Alert.alert(t("goals.weighIn.deleteTitle"), t("goals.weighIn.deleteBody", { weight: fmt(w.kg), date: new Date(w.at).toISOString().slice(0, 10) }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("goals.weighIn.delete"), style: "destructive", onPress: () => void run("delete", () => goals.deleteWeighIn(w.id)) },
    ]);
  };

  return (
    <Screen>
      <Card>
        <AppText style={{ fontWeight: "600" }}>{t("goals.current")}</AppText>
        {text ? (
          <>
            <AppText style={{ fontSize: 20, fontWeight: "600" }}>{pace?.kind === "none" ? t("goals.none") : text.headline}</AppText>
            {text.details.map((d, i) => (
              <AppText key={i}>{d}</AppText>
            ))}
          </>
        ) : null}
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("goals.estimate")}</AppText>
        {saved ? <InlineStatus kind="success" text={t("goals.saved")} /> : null}
      </Card>

      <Card>
        <BigButton variant="secondary" icon="edit" label={t("goals.edit")} onPress={() => setEditing((v) => !v)} />
        {editing ? (
          <View style={{ gap: space.sm }}>
            {row((["lift", "bodyweight", "muscle"] as const).map((k) => <Chip key={k} label={t(`ob.goal.${k}` as StringKey)} selected={form.kind === k} onPress={() => set({ kind: k })} />))}
            {form.kind === "lift" ? (
              <>
                <BigButton label={nameOf(form.exerciseId) || t("goals.chooseExercise")} variant="secondary" onPress={() => setPicker(true)} />
                <Field label={t("ob.goal.load", { unit: unitText })} value={form.loadText} onChangeText={(s) => set({ loadText: s })} numeric />
                <Field label={t("ob.goal.reps")} value={form.repsText} onChangeText={(s) => set({ repsText: s })} numeric />
              </>
            ) : null}
            {form.kind === "bodyweight" ? <Field label={t("ob.goal.weight", { unit: unitText })} value={form.weightText} onChangeText={(s) => set({ weightText: s })} numeric /> : null}
            {form.kind === "muscle" ? row(MUSCLE_GROUPS.filter((m) => m !== "other").map((m) => <Chip key={m} label={t(`muscle.${m}` as StringKey)} selected={form.muscle === m} onPress={() => set({ muscle: m })} />)) : null}
            {form.kind === "lift" || form.kind === "bodyweight" ? <DateSelect label={t("ob.goal.date")} value={form.dateText} onChange={(s) => set({ dateText: s })} years="future" span={10} /> : null}
            {problems.map((c, i) => (
              <InlineStatus key={i} kind="error" text={t(`ob.problem.${c}` as StringKey, { min: fmt(30), max: fmt(300) })} />
            ))}
            <BigButton label={t("goals.save")} disabled={busy} onPress={() => void save()} />
          </View>
        ) : null}
        {pace && pace.kind !== "none" ? <BigButton label={t("goals.clear")} variant="quiet" disabled={busy} onPress={askClear} /> : null}
        {failed === "goal" ? <InlineStatus kind="error" text={t("goals.saveFailed")} /> : null}
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
        {weighBad ? <InlineStatus kind="error" text={t("goals.weighIn.bad", { min: fmt(30), max: fmt(300) })} /> : null}
        <BigButton label={t("goals.weighIn.save")} disabled={busy} onPress={() => void weigh()} />
        {failed === "weigh" ? <InlineStatus kind="error" text={t("goals.saveFailed")} /> : null}
        <AppText style={{ fontWeight: "600" }}>{t("goals.weighIn.recent")}</AppText>
        {weighIns.length === 0 ? <AppText style={{ color: p.muted }}>{t("goals.weighIn.none")}</AppText> : null}
        {weighIns.map((w) => (
          <View key={w.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md }}>
            <AppText ltr>{new Date(w.at).toISOString().slice(0, 10)}</AppText>
            <AppText ltr style={{ fontWeight: "600" }}>{fmt(w.kg)}</AppText>
            <Chip label={t("goals.weighIn.delete")} disabled={busy} onPress={() => askDelete(w)} />
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
            <AppText style={{ color: p.muted }}>{d.applied?.kind === "move_date" ? changeText({ kind: "move_date", newDate: d.applied.newDate }, t) : changeText(d.review.change, t)}</AppText>
          </View>
        ))}
      </Card>
      <HealthNote />
    </Screen>
  );
}
