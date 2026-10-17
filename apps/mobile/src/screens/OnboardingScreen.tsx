import type { EquipmentType } from "@gain/engine";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { BrandLogo } from "../BrandLogo";
import { useServices } from "../AppContext";
import { ExercisePicker } from "../components/ExercisePicker";
import { DateSelect } from "../components/DateSelect";
import { ExposureView } from "../components/ExposureView";
import { ProgrammeEditorView } from "../components/ProgrammeEditorView";
import { createOnboardingSaver } from "../logic/onboardingSave";
import { diagnostics } from "../diagnostics";
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
import { serializeMusclePriorities } from "../logic/musclePriority";
import { generateProgramme } from "../logic/programGenerator";
import { progressColors } from "../logic/stateColors";
import { space, type as ty, useIsDark, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card, Chip, Field, InlineStatus, Notice, QuietAction, RadioGroup, RadioRow, Screen } from "../ui";
import { firstInvalidGroup, footerMode, problemsFor, type ProblemGroup } from "../logic/onboardingLayout";
import { HealthNote } from "../components/HealthNote";
import { activeTemplates } from "../buildConfig";
import { TemplateBrowser } from "../components/TemplateBrowser";

type ProgrammeMode = "template" | "own" | "generate" | null;

/**
 * First-run setup: language, units, the minimum needed to write a first session (days, length, equipment, one goal),
 * the program (a draft template or the lifter's own) and the real gym. Nothing is prefilled with a guess; every
 * gap is shown as a problem. Finishing saves everything in one step and Today then shows the first session.
 */
export function OnboardingScreen(props: { onDone: (openImport?: boolean) => void; rerun?: boolean }) {
  const { repos, programmes, onboarding } = useServices();
  const { t, lang, setLang, unit, setUnit, unitText, fmt } = useI18n();
  const p = usePalette();
  const bar = progressColors(p, !useIsDark());
  const { fontScale } = useWindowDimensions();
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
  const saveError = useRef<(error: unknown) => void>(() => undefined);
  saveError.current = e => {
    diagnostics.record("warn", "save onboarding", e);
    if (e instanceof SessionInProgress) setError(t("ob.openWorkout"));
    else if (e instanceof ProfileInvalid || e instanceof DraftInvalid) setError(t("ob.error"));
    else setError(t("ob.saveFailed"));
  };
  const saver = useMemo(() => createOnboardingSaver({ onSaving: setSaving, onError: e => saveError.current(e) }), []);
  const [resources, setResources] = useState<"loading" | "ready" | "error">("loading");
  const resourceRequest = useRef(0);
  const now = Date.now();

  const refreshLibrary = useCallback(async () => {
    const request = ++resourceRequest.current;
    setResources("loading");
    try {
      const [exercises, keys, limits] = await Promise.all([programmes.listExercises(), programmes.seedKeyMap(), repos.getRepCeilingDefaults()]);
      if (request !== resourceRequest.current) return;
      setLibrary(exercises);
      setSeedKeys(keys);
      setCeilings(limits);
      setResources("ready");
    } catch (e) {
      if (request !== resourceRequest.current) return;
      diagnostics.record("warn", "load onboarding", e);
      setResources("error");
    }
  }, [programmes, repos]);
  useEffect(() => {
    void refreshLibrary();
    return () => { resourceRequest.current++; };
  }, [refreshLibrary]);

  // A chosen template shows only its day titles and weekly exposure; the full split is edited later in the Program tab.
  useEffect(() => {
    let alive = true;
    if ((mode === "template" || mode === "generate") && draft) programmes.exposureOf(draft).then((r) => alive && setExposure(r)).catch(() => alive && setExposure([]));
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
  // Where each validation group sits in the scroll content, so a failed Next can bring the first problem into view.
  const scrollRef = useRef<ScrollView>(null);
  const groupY = useRef<Partial<Record<ProblemGroup, number>>>({});
  const at = (g: ProblemGroup) => (e: LayoutChangeEvent) => { groupY.current[g] = e.nativeEvent.layout.y; };
  const next = () => {
    if (problems.length > 0) {
      setTouched(true);
      const g = firstInvalidGroup(problems);
      const y = g ? groupY.current[g] : undefined;
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - space.lg), animated: true });
      return;
    }
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
    setError(null);
    await saver.save(async () => {
      if (mode === "generate" && form.goalKind === "muscle" && form.goalMuscle && form.goalMuscle !== "other") {
        await repos.setSetting("muscle_priorities", serializeMusclePriorities({ [form.goalMuscle]: "priority" }));
      }
      await onboarding.complete({ profile: built.profile!, programme: draft });
    }, () => props.onDone());
  }

  async function quickStart(openImport = false) {
    setError(null);
    await saver.save(() => onboarding.skip(), () => props.onDone(openImport));
  }

  const problemLines = (codes: string[]) => (touched ? codes.map((c, i) => <InlineStatus key={i} kind="error" text={t(`ob.problem.${c}` as StringKey, { min: fmt(30), max: fmt(300) })} />) : null);
  const problemText = (c: string) => t(`ob.problem.${c}` as StringKey, { min: fmt(30), max: fmt(300) });
  /** This group's problems, shown right under it once Next was tried (icon + text, not colour alone). */
  const groupErrors = (g: ProblemGroup) => (touched ? problemsFor(g, problems).map((c) => <InlineStatus key={c} kind="error" text={problemText(c)} />) : null);
  const fieldError = (g: ProblemGroup) => (touched ? problemsFor(g, problems).map(problemText).join(" ") || undefined : undefined);
  /** A group heading; while the group is invalid it gets a 2 dp danger bar at its start edge. */
  const groupLabel = (g: ProblemGroup, text: string, style?: object) => {
    const bad = touched && problemsFor(g, problems).length > 0;
    return <View style={[{ borderStartWidth: bad ? 2 : 0, borderColor: p.danger, paddingStart: bad ? space.sm : 0 }, style]}><AppText style={{ fontWeight: "600" }}>{text}</AppText></View>;
  };
  const goalName = form.goalExerciseId ? (byId.get(form.goalExerciseId) ? exerciseLabels(byId.get(form.goalExerciseId)!, lang).primary : "") : "";

  const body = (() => {
    switch (step) {
      case "language":
        return (
          <>
            <BrandLogo size={64} />
            <AppText accessibilityRole="header" style={{ fontSize: ty.load, fontWeight: "600" }}>{t("ob.welcome")}</AppText>
            <AppText style={{ color: p.muted }}>{t("ob.welcomeBody")}</AppText>
            <HealthNote />
            <AppText style={{ fontWeight: "600" }}>{t("ob.language")}</AppText>
            <RadioGroup label={t("ob.language")}>
              <RadioRow label={t("settings.language.en")} selected={lang === "en"} onPress={() => { setLang("en"); set({ language: "en" }); }} />
              <RadioRow label={t("settings.language.ar")} selected={lang === "ar"} onPress={() => { setLang("ar"); set({ language: "ar" }); }} />
            </RadioGroup>
          </>
        );
      case "units":
        return (
          <>
            <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>{t("ob.units")}</AppText>
            <RadioGroup label={t("ob.units")}>
              <RadioRow label={t("ob.units.kg")} selected={form.units === "kg"} onPress={() => { setUnit("kg"); set({ units: "kg" }); }} />
              <RadioRow label={t("ob.units.lb")} selected={form.units === "lb"} onPress={() => { setUnit("lb"); set({ units: "lb" }); }} />
            </RadioGroup>
            <AppText style={{ color: p.muted }}>{t("ob.units.note")}</AppText>
          </>
        );
      case "basics":
        return (
          <>
            <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>{t("ob.basics")}</AppText>
            <View onLayout={at("days")} style={{ gap: space.sm }}>
              {groupLabel("days", t("ob.days"))}
              <RadioGroup row label={t("ob.days")}>{DAYS_OPTIONS.map((d) => <Chip radio key={d} label={String(d)} selected={form.days === d} onPress={() => set({ days: d })} />)}</RadioGroup>
              {groupErrors("days")}
            </View>
            <View onLayout={at("minutes")} style={{ gap: space.sm }}>
              {groupLabel("minutes", t("ob.minutes"))}
              <RadioGroup row label={t("ob.minutes")}>{MINUTES_OPTIONS.map((m) => <Chip radio key={m} label={t("ob.minutesValue", { n: m })} selected={form.minutes === m} onPress={() => set({ minutes: m })} />)}</RadioGroup>
              {groupErrors("minutes")}
            </View>
          </>
        );
      case "goal":
        return (
          <>
            <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>{t("ob.goal")}</AppText>
            <AppText style={{ color: p.muted }}>{t("ob.goalNote")}</AppText>
            <View onLayout={at("goalKind")} style={{ gap: space.sm }}>
              <RadioGroup row label={t("ob.goal")}>{(["none", "lift", "bodyweight", "muscle"] as const).map((k) => <Chip radio key={k} label={t(`ob.goal.${k}` as StringKey)} selected={form.goalKind === k} onPress={() => set({ goalKind: k })} />)}</RadioGroup>
              {groupErrors("goalKind")}
            </View>
            {form.goalKind === "lift" ? (
              <>
                <View onLayout={at("exercise")} style={{ gap: space.sm }}>
                  <BigButton variant="secondary" icon="dumbbell" label={goalName || t("ob.goal.chooseExercise")} onPress={() => setPicker(true)} />
                  {groupErrors("exercise")}
                </View>
                <View onLayout={at("load")}><Field label={t("ob.goal.load", { unit: unitText })} value={form.goalLoadText} onChangeText={(s) => set({ goalLoadText: s })} numeric error={fieldError("load")} /></View>
                <View onLayout={at("reps")}><Field label={t("ob.goal.reps")} value={form.goalRepsText} onChangeText={(s) => set({ goalRepsText: s })} numeric error={fieldError("reps")} /></View>
                <View onLayout={at("goalDate")} style={{ gap: space.sm }}>
                  <DateSelect label={t("ob.goal.date")} value={form.goalDateText} onChange={(s) => set({ goalDateText: s })} years="future" span={10} />
                  {groupErrors("goalDate")}
                </View>
              </>
            ) : null}
            {form.goalKind === "bodyweight" ? (
              <>
                <View onLayout={at("goalWeight")}><Field label={t("ob.goal.weight", { unit: unitText })} value={form.goalWeightText} onChangeText={(s) => set({ goalWeightText: s })} numeric error={fieldError("goalWeight")} /></View>
                <View onLayout={at("goalDate")} style={{ gap: space.sm }}>
                  <DateSelect label={t("ob.goal.date")} value={form.goalDateText} onChange={(s) => set({ goalDateText: s })} years="future" span={10} />
                  {groupErrors("goalDate")}
                </View>
              </>
            ) : null}
            {form.goalKind === "muscle" ? (
              <>
                <View onLayout={at("muscle")} style={{ gap: space.sm }}>
                  {groupLabel("muscle", t("ob.goal.muscle.pick"))}
                  <RadioGroup row label={t("ob.goal.muscle.pick")}>{MUSCLE_GROUPS.filter((m) => m !== "other").map((m) => <Chip radio key={m} label={t(`muscle.${m}` as StringKey)} selected={form.goalMuscle === m} onPress={() => set({ goalMuscle: m })} />)}</RadioGroup>
                  {groupErrors("muscle")}
                </View>
              </>
            ) : null}
            <AppText style={{ fontWeight: "600", marginTop: space.md }}>{t("ob.body")}</AppText>
            <View onLayout={at("height")}><Field label={t("ob.body.height")} value={form.heightText} onChangeText={(s) => set({ heightText: s })} numeric error={fieldError("height")} /></View>
            <View onLayout={at("birth")} style={{ gap: space.sm }}>
              <DateSelect label={t("ob.body.birth")} value={form.birthDateText} onChange={(s) => set({ birthDateText: s })} years="past" span={100} minAge={10} />
              {groupErrors("birth")}
            </View>
            <View onLayout={at("bodyweight")}><Field label={t("ob.body.weight", { unit: unitText })} hint={form.goalKind === "bodyweight" ? t("ob.body.weightRequired") : undefined} value={form.bodyweightText} onChangeText={(s) => set({ bodyweightText: s })} numeric error={fieldError("bodyweight")} /></View>
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
        const offers = form.days ? templatesForDays(form.days, activeTemplates()) : [];
        return (
          <>
            <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>{t("ob.programme")}</AppText>
            <RadioGroup label={t("ob.programme")}>
              <RadioRow label={t("ob.programme.template")} detail={t("ob.programme.templateDetail")} selected={mode === "template"} onPress={() => { setMode("template"); setDraft(null); setOffer(null); setDropped([]); }} />
              <RadioRow label={t("coach.build")} detail={t("ob.programme.buildDetail")} selected={mode === "generate"} onPress={() => { setMode("generate"); setOffer(null); setDropped([]); setDraft(null); }} />
              <RadioRow label={t("ob.programme.own")} detail={t("ob.programme.ownDetail")} selected={mode === "own"} onPress={() => { setMode("own"); setOffer(null); setDropped([]); setDraft({ name: "", days: [{ name: t("prog.day.default", { n: 1 }).replace(/[\u2066\u2069]/g, ""), exercises: [] }] }); }} />
            </RadioGroup>
            {mode === "own" ? <AppText style={{ color: p.muted }}>{t("ob.programme.ownNote")}</AppText> : null}
            {mode === "generate" && !draft && ceilings ? (
              <BigButton
                label={t("coach.generate")}
                onPress={() => {
                  if (!form.days || !form.minutes) return setTouched(true);
                  const r = generateProgramme(
                    {
                      goal: "hypertrophy",
                      experience: "intermediate",
                      daysPerWeek: form.days,
                      sessionMinutes: form.minutes,
                      equipment: [...GYM_EQUIPMENT],
                      priorities: form.goalKind === "muscle" && form.goalMuscle ? { [form.goalMuscle]: "priority" } : {},
                      avoid: [],
                      lang,
                    },
                    { byKey: seedKeys },
                    (key) => {
                      const name = library.find((e) => e.seedKey === key)?.nameEn ?? key;
                      return ceilingForName(name, ceilings);
                    },
                  );
                  if (!r) return setError(t("ob.programme.none", { n: form.days }));
                  setDropped(r.dropped);
                  setDraft(form.goalKind === "lift" && form.goalExerciseId ? markGoalLift(r.draft, form.goalExerciseId) : r.draft);
                }}
              />
            ) : null}
            {mode === "template" && !draft ? (
              offers.length === 0 ? (
                <AppText>{t("ob.programme.none", { n: form.days ?? 0 })}</AppText>
              ) : (
                <>
                  <AppText style={{ color: p.muted, fontSize: 13 }}>{t("ob.programme.unreviewed")}</AppText>
                  <TemplateBrowser
                    templates={offers.map((o) => o.template)}
                    showDaysFilter={false}
                    actionLabel={(tp) => (lang === "ar" ? tp.ar : tp.en)}
                    noteFor={(tp) => {
                      const o = offers.find((x) => x.template.id === tp.id)!;
                      return o.fit === "exact" ? t("ob.programme.exact", { n: tp.days }) : t("ob.programme.fewer");
                    }}
                    onPick={(tp) => pickTemplate(offers.find((x) => x.template.id === tp.id)!)}
                  />
                </>
              )
            ) : null}
            {(mode === "template" || mode === "generate") && draft ? (
              <>
                <AppText style={{ color: p.muted, fontSize: 13 }}>{t("ob.programme.unreviewed")}</AppText>
                <BigButton variant="secondary" label={t("ob.programme.change")} onPress={() => { setDraft(null); setOffer(null); setDropped([]); }} />
              </>
            ) : null}
            {dropped.length > 0 ? (
              <Card>
                <AppText style={{ fontWeight: "600" }}>{t("ob.programme.dropped")}</AppText>
                {dropped.map((d, i) => {
                  const nm = library.find((e) => e.seedKey === d.key);
                  const lift = nm ? exerciseLabels(nm, lang).primary : d.key;
                  return <AppText key={i}>{d.reason === "equipment" ? t("ob.programme.droppedEquipment", { day: d.day, lift }) : d.reason === "avoid" ? t("coach.dropped.avoid", { day: d.day, lift }) : t("ob.programme.droppedTime", { day: d.day, lift, n: form.minutes ?? 0 })}</AppText>;
                })}
              </Card>
            ) : null}
            {draft ? (
              <>
                {form.goalKind === "lift" && form.goalExerciseId && !draftHasExercise(draft, form.goalExerciseId) ? <InlineStatus kind="info" text={t("ob.programme.goalMissing")} /> : null}
                {mode === "template" || mode === "generate" ? (
                  <>
                    <Card>
                      <AppText style={{ fontWeight: "600" }}>{t("ob.programme.days", { n: draft.days.length })}</AppText>
                      {dayTitles(draft).map((title, i) => (
                        <AppText key={i} style={{ fontSize: ty.body }}>
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
                {touched ? validateDraft(draft).map((pr, i) => <InlineStatus key={i} kind="error" text={t(`prog.problem.${pr.code}` as StringKey, { day: (pr.day ?? 0) + 1 })} />) : null}
              </>
            ) : null}
          </>
        );
      }
      case "review": {
        const built = buildProfile(form, now);
        const g = form.goalKind === "none" ? t("ob.review.goal.none") : form.goalKind === "lift" ? t("ob.review.goal.lift", { name: goalName, load: `${form.goalLoadText} ${unitText}`, reps: form.goalRepsText }) : form.goalKind === "bodyweight" ? t("ob.review.goal.bodyweight", { weight: `${form.goalWeightText} ${unitText}` }) : form.goalMuscle ? t("ob.review.goal.muscle", { muscle: t(`muscle.${form.goalMuscle}` as StringKey) }) : "";
        return (
          <>
            <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>{t("ob.review")}</AppText>
            <Card>
              <AppText>{t("ob.review.line.days", { n: form.days ?? 0, min: form.minutes ?? 0 })}</AppText>
              <AppText>{t("ob.review.line.programme", { name: draft?.name ?? "" })}</AppText>
              <AppText>{t("ob.review.line.goal", { goal: isolateLtr(g) })}</AppText>
            </Card>
            <AppText style={{ color: p.muted }}>{t("ob.review.note")}</AppText>
            {error ? <Notice kind="error">{error}</Notice> : null}
            {built.problems.length > 0 ? problemLines(built.problems) : null}
            <BigButton hero label={t("ob.finish")} loading={saving} onPress={() => void finish()} />
          </>
        );
      }
    }
  })();

  const first = step === "language" && !props.rerun;
  const footer = first ? (
    <>
      <BigButton hero label={t("ob.setup")} disabled={saving || resources !== "ready"} onPress={next} />
      {/* One 48 dp row of two quiet actions instead of two more full-width buttons, so the footer stays short at large text. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm }}>
        <QuietAction label={t("ob.skip")} onPress={() => { if (!saving) void quickStart(); }} />
        <QuietAction label={t("ob.importFirst")} onPress={() => { if (!saving) void quickStart(true); }} />
      </View>
    </>
  ) : (
    <>
      {step !== "review" ? <BigButton hero label={t("common.next")} disabled={resources !== "ready"} onPress={next} /> : null}
      {idx > 0 ? <BigButton variant={step === "review" ? "secondary" : "quiet"} label={t("common.back")} onPress={() => goTo(STEPS[idx - 1]!)} /> : null}
    </>
  );

  return (
    <Screen footer={footer} footerInline={footerMode(fontScale) === "inline"} scrollRef={scrollRef} contentStyle={{ paddingTop: space.xl }}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={t("ob.progress", { i: idx + 1, n: STEPS.length })} accessibilityValue={{ min: 1, max: STEPS.length, now: idx + 1 }} style={{ gap: space.xs }}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {STEPS.map((_, i) => (
            <View key={i} style={{ flex: 1, height: bar.height, borderRadius: bar.height / 2, backgroundColor: i <= idx ? bar.active : bar.inactive, opacity: i <= idx ? 1 : bar.inactiveOpacity }} />
          ))}
        </View>
        <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("ob.progress", { i: idx + 1, n: STEPS.length })}</AppText>
      </View>
      {resources === "error" ? <Notice kind="error" title={t("ob.loadFailed")} actionLabel={t("history.error.retry")} onAction={() => void refreshLibrary()} /> : null}
      {body}
      {first && error ? <InlineStatus kind="error" text={error} /> : null}
      {first ? <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("ob.skipNote")}</AppText> : null}
      <ArDraftNote />
    </Screen>
  );
}
