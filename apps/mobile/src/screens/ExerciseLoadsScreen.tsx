import { useFocusEffect, useRoute } from "@react-navigation/native";
import type { GymLoadSpec } from "@gain/engine";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { buildLoads, emptyLoadsForm, formFromSpec, loadsSummaryText, specValues, type LoadsForm, type LoadsMode, type LoadsProblem } from "../logic/exerciseLoads";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, EmptyState, Field, InlineStatus, LoadingState, Screen } from "../ui";

interface Loaded {
  nameEn: string;
  nameAr: string;
  equipment: GymLoadSpec["equipment"];
  spec: GymLoadSpec | null;
}

/**
 * Per-exercise loadable weights: a step grid (machine stack, barbell plates) or a list (dumbbells). Numbers are typed in the lifter's unit
 * (kg or lb) and stored in kilograms. "Standard steps" = nothing set: the gym's grid for the equipment applies, as before.
 */
export function ExerciseLoadsScreen() {
  const { repos, programmes, db } = useServices();
  const { t, lang, unit, unitText } = useI18n();
  const p = usePalette();
  const exerciseId = (useRoute().params as { exerciseId: string }).exerciseId;
  const [data, setData] = useState<Loaded | null | "none">(null);
  const [form, setForm] = useState<LoadsForm>(emptyLoadsForm());
  const [problems, setProblems] = useState<LoadsProblem[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const cur = await repos.getExerciseLoads(exerciseId);
    const row = await db.get<{ name_en: string; name_ar: string }>("SELECT name_en, name_ar FROM exercise WHERE id = ? AND deleted_at IS NULL", [exerciseId]);
    if (!cur || !row) return setData("none");
    setData({ nameEn: row.name_en, nameAr: row.name_ar, equipment: cur.equipment, spec: cur.spec });
    setForm(formFromSpec(cur.spec, unit));
  }, [repos, db, exerciseId, unit]);
  useFocusEffect(useCallback(() => void load(), [load]));

  if (data === null) return <LoadingState />;
  if (data === "none") return <EmptyState icon="progress" title={t("trend.noPoints")} />;

  const set = (patch: Partial<LoadsForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
    setProblems([]);
  };
  const problemText = (code: LoadsProblem["code"]): string | undefined => {
    const pr = problems.find((x) => x.code === code);
    return pr ? t(`loads.problem.${code}` as never, { bad: (pr.detail ?? []).join(" ") }) : undefined;
  };
  const save = async (clear: boolean) => {
    const f = clear ? emptyLoadsForm() : form;
    const built = buildLoads(f, data.equipment, unit, specValues(data.spec));
    if (built.problems.length > 0) return setProblems(built.problems);
    setBusy(true);
    try {
      await programmes.setExerciseLoads(exerciseId, built.spec);
      setSaved(true);
      await load();
    } finally {
      setBusy(false);
    }
  };
  const modes: LoadsMode[] = ["default", "step", "list"];
  const names = exerciseLabels({ nameEn: data.nameEn, nameAr: data.nameAr }, lang);
  const equipment = t(`equipment.${data.equipment}` as never);
  const state = data.spec ? t("loads.state.own", { what: loadsSummaryText(data.spec, unit, unitText, t as never) }) : t("loads.state.default", { equipment });

  return (
    <Screen title={`${t("loads.title")}: ${names.primary}`}>
      <Card>
        <AppText style={{ fontWeight: "600" }}>{state}</AppText>
        <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("loads.intro")}</AppText>
        <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("loads.scope")}</AppText>
      </Card>
      <Card>
        <AppText accessibilityRole="header" style={{ fontWeight: "600" }}>{t("loads.mode")}</AppText>
        <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
          {modes.map((m) => (
            <Chip key={m} label={t(`loads.mode.${m}` as never)} selected={form.mode === m} onPress={() => set({ mode: m })} />
          ))}
        </View>
        {form.mode === "step" ? (
          <View style={{ gap: space.md }}>
            <Field label={t("loads.step", { unit: unitText })} hint={t("loads.step.hint")} value={form.stepText} onChangeText={(s) => set({ stepText: s })} numeric error={problemText("step_missing") ?? problemText("step_bad")} />
            <Field label={t("loads.min", { unit: unitText })} hint={t("loads.min.hint")} value={form.minText} onChangeText={(s) => set({ minText: s })} numeric error={problemText("min_bad")} />
            <Field label={t("loads.max", { unit: unitText })} value={form.maxText} onChangeText={(s) => set({ maxText: s })} numeric error={problemText("max_bad") ?? problemText("range_bad") ?? problemText("too_many_rungs")} />
          </View>
        ) : null}
        {form.mode === "list" ? (
          <Field label={t("loads.list", { unit: unitText })} hint={t("loads.list.hint")} value={form.listText} onChangeText={(s) => set({ listText: s })} keyboardType="numbers-and-punctuation" error={problemText("list_empty") ?? problemText("list_invalid") ?? problemText("list_zero") ?? problemText("too_many_rungs")} />
        ) : null}
        {saved ? <InlineStatus kind="success" text={t("loads.saved")} /> : null}
        <BigButton label={t("loads.save")} onPress={() => void save(false)} loading={busy} />
        {data.spec ? <BigButton variant="secondary" label={t("loads.reset")} onPress={() => void save(true)} disabled={busy} /> : null}
      </Card>
    </Screen>
  );
}
