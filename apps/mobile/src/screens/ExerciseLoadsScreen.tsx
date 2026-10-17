import { useFocusEffect, useRoute } from "@react-navigation/native";
import type { GymLoadSpec, SetupType } from "@gain/engine";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { buildLoads, emptyLoadsForm, formFromSpec, loadsSummaryText, specValues, type LoadsForm, type LoadsMode, type LoadsProblem } from "../logic/exerciseLoads";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, EmptyState, Field, InlineStatus, LoadingState, QuietAction, Screen } from "../ui";
import { SelectRow } from "../components/SettingsRows";
import { previewTokens } from "../logic/loadsPreview";
import { weightText } from "../logic/units";

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
  const params = useRoute().params as { exerciseId: string; gymId?: string; setup?: SetupType };
  const exerciseId = params.exerciseId;
  const gymId = params.gymId;
  const setup = params.setup;
  const [data, setData] = useState<Loaded | null | "none">(null);
  const [form, setForm] = useState<LoadsForm>(emptyLoadsForm());
  const [problems, setProblems] = useState<LoadsProblem[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const cur = await repos.getExerciseLoads(exerciseId);
    const row = await db.get<{ name_en: string; name_ar: string }>("SELECT name_en, name_ar FROM exercise WHERE id = ? AND deleted_at IS NULL", [exerciseId]);
    if (!cur || !row) return setData("none");
    const spec = gymId && setup ? await repos.getLineLoads(exerciseId, gymId, setup) : cur.spec;
    setData({ nameEn: row.name_en, nameAr: row.name_ar, equipment: cur.equipment, spec });
    setForm(formFromSpec(spec, unit));
  }, [repos, db, exerciseId, gymId, setup, unit]);
  useFocusEffect(useCallback(() => void load(), [load]));

  if (data === null) return <LoadingState />;
  if (data === "none") return <EmptyState icon="progress" title={t("empty.noSets")} body={t("trend.noPoints")} />;

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
      if (gymId && setup) await programmes.setLineLoads(exerciseId, gymId, setup, built.spec);
      else await programmes.setExerciseLoads(exerciseId, built.spec);
      setSaved(true);
      await load();
    } finally {
      setBusy(false);
    }
  };
  const modes: LoadsMode[] = ["default", "step", "list"];
  const preview = previewTokens(form);
  const names = exerciseLabels({ nameEn: data.nameEn, nameAr: data.nameAr }, lang);
  const equipment = t(`equipment.${data.equipment}` as never);
  const state = data.spec ? t("loads.state.own", { what: loadsSummaryText(data.spec, unit, unitText, t as never) }) : t("loads.state.default", { equipment });

  return (
    <Screen title={`${t("loads.title")}: ${names.primary}`}>
      <Card>
        <AppText style={{ fontWeight: "600" }}>{state}</AppText>
        <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("loads.intro")}</AppText>
        <AppText style={{ color: p.muted, fontSize: ty.label }}>{t(gymId ? "loads.scope.line" : "loads.scope")}</AppText>
      </Card>
      <Card>
        {/* One choice of three: a segmented control, not chips (P-5 / S-9). */}
        <SelectRow label={t("loads.mode")} value={form.mode} options={modes.map((m) => ({ value: m, label: t(`loads.mode.${m}` as never) }))} onChange={(m) => set({ mode: m })} />
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
        {preview.values.length > 0 || preview.invalid.length > 0 ? (
          // The rack before saving: ascending pills, read left to right in both languages like a real rack.
          <View accessible accessibilityLabel={`${t("loads.preview")}: ${preview.values.map((v) => weightText(v, "kg")).join(", ")}${preview.more ? ` +${preview.more}` : ""}`} style={{ gap: space.xs }}>
            <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("loads.preview")}</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, direction: "ltr" }}>
              {preview.values.map((v) => <LoadPill key={`v${v}`} text={weightText(v, "kg")} />)}
              {preview.invalid.map((bad, i) => <LoadPill key={`x${i}`} text={bad} invalid />)}
              {preview.more > 0 ? <LoadPill text={`+${preview.more}`} /> : null}
            </View>
          </View>
        ) : null}
        {saved ? <InlineStatus kind="success" text={t("loads.saved")} /> : null}
        <BigButton label={t("loads.save")} onPress={() => void save(false)} loading={busy} />
        {data.spec ? <View style={{ alignItems: "center" }}><QuietAction label={t("loads.reset")} onPress={() => { if (!busy) void save(true); }} /></View> : null}
      </Card>
    </Screen>
  );
}

/** One rung of the preview rack: 32 dp, number only (the unit is in the field label); an invalid piece gets a danger outline. */
function LoadPill({ text, invalid }: { text: string; invalid?: boolean }) {
  const p = usePalette();
  return (
    <View style={{ minHeight: 32, minWidth: 32, paddingHorizontal: space.sm, borderRadius: 16, justifyContent: "center", alignItems: "center", backgroundColor: invalid ? "transparent" : p.raised, borderWidth: invalid ? 1.5 : 1, borderColor: invalid ? p.danger : p.border }}>
      <AppText ltr={!/[\u0600-\u06FF]/.test(text)} style={{ fontSize: ty.label, fontWeight: "600", fontVariant: ["tabular-nums"], color: invalid ? p.danger : p.text, textDecorationLine: invalid ? "line-through" : "none" }}>{text}</AppText>
    </View>
  );
}
