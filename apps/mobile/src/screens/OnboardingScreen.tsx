import type { EquipmentType } from "@gain/engine";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import { ExercisePicker } from "../components/ExercisePicker";
import { DateSelect } from "../components/DateSelect";
import { ExposureView } from "../components/ExposureView";
import { ProgrammeEditorView } from "../components/ProgrammeEditorView";
import { ProfileInvalid } from "../db/onboardingRepo";
import { DraftInvalid, SessionInProgress, type LibraryExercise } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { ceilingForName } from "../logic/ceilings";
import { GYM_EQUIPMENT } from "../logic/gymInput";
import { MUSCLE_GROUPS, type ExposureRow } from "../logic/exposure";
import { dayTitles, draftHasExercise, markGoalLift, DAYS_OPTIONS, MINUTES_OPTIONS } from "../logic/onboarding";
import { buildProfile, emptyOnboardingForm, STEPS, stepProblems, type OnboardingForm, type Step } from "../logic/onboardingForm";
import { validateDraft, type ProgrammeDraft } from "../logic/programmeDraft";
import { instantiateTemplate, templatesForDays, type Instantiated, type TemplateOffer } from "../logic/templates";
import { space, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card, Chip, Field } from "../ui";

type ProgrammeMode = "template" | "own" | null;

/**
 * First-run setup: language, units, the minimum needed to write a first session (days, length, equipment, one goal),
 * the programme (a draft template or the lifter's own) and the real gym. Nothing is prefilled with a guess; every
 * gap is shown as a problem. Finishing saves everything in one step and Today then shows the first session.
 */
export function OnboardingScreen(props: { onDone: () => void; rerun?: boolean }) {
  const { repos, programmes, onboarding } = useServices();
  const { t, lang, setLang, unit, setUnit, unitText, fmt } = useI18n();
  const p = usePalette();
  const [step, setStep] = useState<Step>("language");
  const [form, setForm] = useState<OnboardingForm>(() => emptyOnboardingForm(lang, unit));
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [seedKeys, setSeedKeys] = useState<Map<string, { exerciseId: string; equipment: EquipmentType }>>(new Map());
  const [ceilings, setCeilings] = useState<Awaited<ReturnType<typeof repos.getRepCeilingDefaults>> | null>(null);
  const [mode, setMode] = useState<ProgrammeMode>(null);
  const [offer, setOffer] = useState<TemplateOffer | null>(null);
  const [dropped, setDropped] = useState<Instantiated["dropped"]>([]);
  const [draft, setDraft] = useState<ProgrammeDraft | null>(null);
  const [picker, setPicker] = useState(false);
  const [exposure, setExposure] = useState<ExposureRow[]>([]);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();

  const refreshLibrary = useCallback(() => {
    programmes.listExercises().then(setLibrary);
  }, [programmes]);
  useEffect(() => {
    refreshLibrary();
    programmes.seedKeyMap().then(setSeedKeys);
    repos.getRepCeilingDefaults().then(setCeilings);
  }, [programmes, repos, refreshLibrary]);

  // A chosen template shows only its day titles and weekly exposure; the full split is edited later in the Programme tab.
  useEffect(() => {
    let alive = true;
    if (mode === "template" && draft) programmes.exposureOf(draft).then((r) => alive && setExposure(r)).catch(() => alive && setExposure([]));
    return () => {
      alive = false;
    };
  }, [mode, draft, programmes]);

  const byId = useMemo(() => new Map(library.map((e) => [e.id, e])), [library]);
  const keyById = useMemo(() => new Map(library.filter((e) => e.seedKey).map((e) => [e.id, e.seedKey!])), [library]);
  const idx = STEPS.indexOf(step);
  const set = (patch: Partial<OnboardingForm>) => setForm((f) => ({ ...f, ...patch }));
  const problems = stepProblems(step, form, now);

  const goTo = (s: Step) => {
    setTouched(false);
    setError(null);
    setStep(s);
  };
  const next = () => {
    if (problems.length > 0) return setTouched(true);
    if (step === "programme") {
      if (!draft || validateDraft(draft).length > 0) return setTouched(true);
    }
    goTo(STEPS[idx + 1]!);
  };

  function pickTemplate(o: TemplateOffer) {
    if (!ceilings) return;
    const goalKey = form.goalKind === "lift" && form.goalExerciseId ? (keyById.get(form.goalExerciseId) ?? null) : null;
    const r = instantiateTemplate(
      o.template,
      { byKey: seedKeys },
      {
        lang,
        equipment: [...GYM_EQUIPMENT],
        sessionMinutes: form.minutes,
        goalLiftKey: goalKey,
        ceilingFor: (key) => {
          const name = library.find((e) => e.seedKey === key)?.nameEn ?? key;
          return ceilingForName(name, ceilings);
        },
      },
    );
    setOffer(o);
    setDropped(r.dropped);
    setDraft(form.goalKind === "lift" && form.goalExerciseId ? markGoalLift(r.draft, form.goalExerciseId) : r.draft);
  }

  async function finish() {
    setTouched(true);
    const built = buildProfile(form, Date.now());
    if (!built.profile || !draft) return setError(t("ob.error"));
    setSaving(true);
    try {
      // No gym is asked for: a default one (standard loads in the chosen unit) is created silently.
      await onboarding.complete({ profile: built.profile, programme: draft });
      props.onDone();
    } catch (e) {
      setSaving(false);
      if (e instanceof SessionInProgress) setError(t("ob.openWorkout"));
      else if (e instanceof ProfileInvalid || e instanceof DraftInvalid) setError(t("ob.error"));
      else throw e;
    }
  }

  const problemLines = (codes: string[]) => (touched ? codes.map((c, i) => <AppText key={i} style={{ fontWeight: "600" }}>⚠ {t(`ob.problem.${c}` as StringKey, { min: fmt(30), max: fmt(300) })}</AppText>) : null);
  const chipRow = (children: React.ReactNode) => <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{children}</View>;
  const goalName = form.goalExerciseId ? (byId.get(form.goalExerciseId) ? exerciseLabels(byId.get(form.goalExerciseId)!, lang).primary : "") : "";

  const body = (() => {
    switch (step) {
      case "language":
        return (
          <>
            <AppText style={{ fontSize: 28, fontWeight: "800" }}>{t("ob.welcome")}</AppText>
            <AppText style={{ color: p.muted }}>{t("ob.welcomeBody")}</AppText>
            <AppText style={{ color: p.muted }}>{t("ob.importHint")}</AppText>
            <AppText style={{ fontWeight: "700" }}>{t("ob.language")}</AppText>
            <BigButton label={t("settings.language.en")} selected={lang === "en"} onPress={() => { setLang("en"); set({ language: "en" }); }} />
            <BigButton label={t("settings.language.ar")} selected={lang === "ar"} onPress={() => { setLang("ar"); set({ language: "ar" }); }} />
          </>
        );
      case "units":
        return (
          <>
            <AppText style={{ fontSize: 22, fontWeight: "800" }}>{t("ob.units")}</AppText>
            <BigButton label={t("ob.units.kg")} selected={form.units === "kg"} onPress={() => { setUnit("kg"); set({ units: "kg" }); }} />
            <BigButton label={t("ob.units.lb")} selected={form.units === "lb"} onPress={() => { setUnit("lb"); set({ units: "lb" }); }} />
            <AppText style={{ color: p.muted }}>{t("ob.units.note")}</AppText>
          </>
        );
      case "basics":
        return (
          <>
            <AppText style={{ fontSize: 22, fontWeight: "800" }}>{t("ob.basics")}</AppText>
            <AppText style={{ fontWeight: "700" }}>{t("ob.days")}</AppText>
            {chipRow(DAYS_OPTIONS.map((d) => <Chip key={d} label={String(d)} selected={form.days === d} onPress={() => set({ days: d })} />))}
            <AppText style={{ fontWeight: "700" }}>{t("ob.minutes")}</AppText>
            {chipRow(MINUTES_OPTIONS.map((m) => <Chip key={m} label={t("ob.minutesValue", { n: m })} selected={form.minutes === m} onPress={() => set({ minutes: m })} />))}
            {problemLines(problems)}
          </>
        );
      case "goal":
        return (
          <>
            <AppText style={{ fontSize: 22, fontWeight: "800" }}>{t("ob.goal")}</AppText>
            <AppText style={{ color: p.muted }}>{t("ob.goalNote")}</AppText>
            {chipRow((["lift", "bodyweight", "muscle"] as const).map((k) => <Chip key={k} label={t(`ob.goal.${k}` as StringKey)} selected={form.goalKind === k} onPress={() => set({ goalKind: k })} />))}
            {form.goalKind === "lift" ? (
              <>
                <BigButton label={goalName || t("ob.goal.chooseExercise")} selected={false} onPress={() => setPicker(true)} />
                <Field label={t("ob.goal.load", { unit: unitText })} value={form.goalLoadText} onChangeText={(s) => set({ goalLoadText: s })} numeric />
                <Field label={t("ob.goal.reps")} value={form.goalRepsText} onChangeText={(s) => set({ goalRepsText: s })} numeric />
                <DateSelect label={t("ob.goal.date")} value={form.goalDateText} onChange={(s) => set({ goalDateText: s })} years="future" span={10} />
              </>
            ) : null}
            {form.goalKind === "bodyweight" ? (
              <>
                <Field label={t("ob.goal.weight", { unit: unitText })} value={form.goalWeightText} onChangeText={(s) => set({ goalWeightText: s })} numeric />
                <DateSelect label={t("ob.goal.date")} value={form.goalDateText} onChange={(s) => set({ goalDateText: s })} years="future" span={10} />
              </>
            ) : null}
            {form.goalKind === "muscle" ? (
              <>
                <AppText style={{ fontWeight: "700" }}>{t("ob.goal.muscle.pick")}</AppText>
                {chipRow(MUSCLE_GROUPS.filter((m) => m !== "other").map((m) => <Chip key={m} label={t(`muscle.${m}` as StringKey)} selected={form.goalMuscle === m} onPress={() => set({ goalMuscle: m })} />))}
              </>
            ) : null}
            <AppText style={{ fontWeight: "700", marginTop: space.md }}>{t("ob.body")}</AppText>
            <Field label={t("ob.body.height")} value={form.heightText} onChangeText={(s) => set({ heightText: s })} numeric />
            <DateSelect label={t("ob.body.birth")} value={form.birthDateText} onChange={(s) => set({ birthDateText: s })} years="past" span={100} minAge={10} />
            <Field label={t("ob.body.weight", { unit: unitText })} hint={form.goalKind === "bodyweight" ? t("ob.body.weightRequired") : undefined} value={form.bodyweightText} onChangeText={(s) => set({ bodyweightText: s })} numeric />
            {problemLines(problems)}
            <ExercisePicker
              visible={picker}
              exercises={library}
              onClose={() => setPicker(false)}
              onCreate={programmes.createExercise}
              onPick={(id) => {
                set({ goalExerciseId: id });
                setPicker(false);
                refreshLibrary();
              }}
            />
          </>
        );
      case "programme": {
        const offers = form.days ? templatesForDays(form.days) : [];
        return (
          <>
            <AppText style={{ fontSize: 22, fontWeight: "800" }}>{t("ob.programme")}</AppText>
            {chipRow(
              <>
                <Chip label={t("ob.programme.template")} selected={mode === "template"} onPress={() => { setMode("template"); setDraft(null); setOffer(null); setDropped([]); }} />
                <Chip label={t("ob.programme.own")} selected={mode === "own"} onPress={() => { setMode("own"); setOffer(null); setDropped([]); setDraft({ name: "", days: [{ name: t("prog.day.default", { n: 1 }).replace(/[\u2066\u2069]/g, ""), exercises: [] }] }); }} />
              </>,
            )}
            {mode === "own" ? <AppText style={{ color: p.muted }}>{t("ob.programme.ownNote")}</AppText> : null}
            {mode === "template" && !draft ? (
              offers.length === 0 ? (
                <AppText>{t("ob.programme.none", { n: form.days ?? 0 })}</AppText>
              ) : (
                offers.map((o) => (
                  <Card key={o.template.id}>
                    <AppText style={{ fontWeight: "800", fontSize: 18 }}>{lang === "ar" ? o.template.ar : o.template.en}</AppText>
                    <AppText style={{ color: p.muted }}>{o.fit === "exact" ? t("ob.programme.exact", { n: o.template.days }) : t("ob.programme.fewer")}</AppText>
                    <AppText style={{ color: p.muted, fontSize: 13 }}>{t("ob.programme.unreviewed")}</AppText>
                    <BigButton label={lang === "ar" ? o.template.ar : o.template.en} onPress={() => pickTemplate(o)} />
                  </Card>
                ))
              )
            ) : null}
            {mode === "template" && draft && offer ? (
              <>
                <AppText style={{ color: p.muted, fontSize: 13 }}>{t("ob.programme.unreviewed")}</AppText>
                <BigButton label={t("ob.programme.change")} selected={false} onPress={() => { setDraft(null); setOffer(null); setDropped([]); }} />
              </>
            ) : null}
            {dropped.length > 0 ? (
              <Card>
                <AppText style={{ fontWeight: "700" }}>{t("ob.programme.dropped")}</AppText>
                {dropped.map((d, i) => {
                  const nm = library.find((e) => e.seedKey === d.key);
                  const lift = nm ? exerciseLabels(nm, lang).primary : d.key;
                  return <AppText key={i}>{d.reason === "equipment" ? t("ob.programme.droppedEquipment", { day: d.day, lift }) : t("ob.programme.droppedTime", { day: d.day, lift, n: form.minutes ?? 0 })}</AppText>;
                })}
              </Card>
            ) : null}
            {draft ? (
              <>
                {form.goalKind === "lift" && form.goalExerciseId && !draftHasExercise(draft, form.goalExerciseId) ? <AppText style={{ fontWeight: "600" }}>ℹ {t("ob.programme.goalMissing")}</AppText> : null}
                {mode === "template" ? (
                  <>
                    <Card>
                      <AppText style={{ fontWeight: "700" }}>{t("ob.programme.days", { n: draft.days.length })}</AppText>
                      {dayTitles(draft).map((title, i) => (
                        <AppText key={i} style={{ fontSize: 18 }}>
                          {i + 1}. {title}
                        </AppText>
                      ))}
                    </Card>
                    <ExposureView rows={exposure} />
                    <AppText style={{ color: p.muted }}>{t("ob.programme.later")}</AppText>
                  </>
                ) : (
                  <>
                    <AppText style={{ color: p.muted }}>{t("ob.programme.edit")}</AppText>
                    <ProgrammeEditorView draft={draft} onChange={setDraft} baseline={null} library={library} daysPerWeek={form.days} onCreateExercise={programmes.createExercise} onLibraryChanged={refreshLibrary} />
                  </>
                )}
                {touched ? validateDraft(draft).map((pr, i) => <AppText key={i} style={{ fontWeight: "600" }}>⚠ {t(`prog.problem.${pr.code}` as StringKey, { day: (pr.day ?? 0) + 1 })}</AppText>) : null}
              </>
            ) : null}
          </>
        );
      }
      case "review": {
        const built = buildProfile(form, now);
        const g = form.goalKind === "lift" ? t("ob.review.goal.lift", { name: goalName, load: `${form.goalLoadText} ${unitText}`, reps: form.goalRepsText }) : form.goalKind === "bodyweight" ? t("ob.review.goal.bodyweight", { weight: `${form.goalWeightText} ${unitText}` }) : form.goalMuscle ? t("ob.review.goal.muscle", { muscle: t(`muscle.${form.goalMuscle}` as StringKey) }) : "";
        return (
          <>
            <AppText style={{ fontSize: 22, fontWeight: "800" }}>{t("ob.review")}</AppText>
            <Card>
              <AppText>{t("ob.review.line.days", { n: form.days ?? 0, min: form.minutes ?? 0 })}</AppText>
              <AppText>{t("ob.review.line.programme", { name: draft?.name ?? "" })}</AppText>
              <AppText>{t("ob.review.line.goal", { goal: isolateLtr(g) })}</AppText>
            </Card>
            <AppText style={{ color: p.muted }}>{t("ob.review.note")}</AppText>
            {error ? <AppText style={{ fontWeight: "700" }}>⚠ {error}</AppText> : null}
            {built.problems.length > 0 ? problemLines(built.problems) : null}
            <BigButton label={saving ? t("ob.saving") : t("ob.finish")} disabled={saving} onPress={() => void finish()} />
          </>
        );
      }
    }
  })();

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingTop: space.xl * 2, gap: space.md, paddingBottom: space.xl * 3 }} keyboardShouldPersistTaps="handled">
      <AppText style={{ color: p.muted }}>{t("ob.progress", { i: idx + 1, n: STEPS.length })}</AppText>
      {body}
      <View style={{ gap: space.sm, marginTop: space.md }}>
        {step !== "review" ? <BigButton label={t("common.next")} onPress={next} /> : null}
        {idx > 0 ? <BigButton label={t("common.back")} selected={false} onPress={() => goTo(STEPS[idx - 1]!)} /> : null}
        {step === "language" && !props.rerun ? (
          <>
            <BigButton label={t("ob.skip")} selected={false} onPress={() => void onboarding.skip().then(props.onDone)} />
            <AppText style={{ color: p.muted, fontSize: 13 }}>{t("ob.skipNote")}</AppText>
          </>
        ) : null}
      </View>
      <ArDraftNote />
    </ScrollView>
  );
}
