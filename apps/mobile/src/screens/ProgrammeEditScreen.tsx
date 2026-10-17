import { useFocusEffect, useNavigation, usePreventRemove, useRoute, type NavigationAction } from "@react-navigation/native";
import type { EquipmentType, Measure } from "@gain/engine";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useServices } from "../AppContext";
import { ProgrammeEditorView } from "../components/ProgrammeEditorView";
import { DraftInvalid, MeasureLocked, SessionInProgress, type LibraryExercise } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { isDraftDirty, resetRangeFor, validateDraft, type ProgrammeDraft } from "../logic/programmeDraft";
import type { MachineLoadKind, PinMachineStep } from "../logic/machineLoadKind";
import { ArDraftNote, BigButton, LoadingState, Notice, Screen } from "../ui";

export function ProgrammeEditScreen() {
  const { programmes, repos, gyms } = useServices();
  const { t } = useI18n();
  const nav = useNavigation<{ goBack: () => void; navigate: (name: string, params?: object) => void; dispatch: (action: NavigationAction) => void }>();
  const params = (useRoute().params ?? {}) as { versionId?: string; programmeId?: string; settingsDay?: number; reorderWorkouts?: boolean };
  const [draft, setDraft] = useState<ProgrammeDraft | null>(null);
  /** The draft as it was loaded: leaving with edits beyond it asks first (data-loss follow-up, plan 1.7). */
  const [initial, setInitial] = useState<ProgrammeDraft | null>(null);
  const saved = useRef(false);
  const [baseline, setBaseline] = useState<ProgrammeDraft | null>(null);
  const [nextVersion, setNextVersion] = useState<number | null>(null);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [dpw, setDpw] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gymEquipment, setGymEquipment] = useState<EquipmentType[]>([]);

  const refreshLibrary = useCallback(() => {
    programmes.listExercises().then(setLibrary);
  }, [programmes]);
  useFocusEffect(useCallback(() => { refreshLibrary(); }, [refreshLibrary]));

  async function setMachineLoadKind(exerciseId: string, kind: MachineLoadKind, pinStep?: PinMachineStep) {
    try {
      await programmes.setMachineLoadKind(exerciseId, kind, pinStep);
      refreshLibrary();
      setMessage(null);
    } catch {
      setMessage(t("loads.preset.failed"));
    }
  }

  useEffect(() => {
    (async () => {
      refreshLibrary();
      const n = Number(await repos.getSetting("days_per_week"));
      setDpw(Number.isFinite(n) && n > 0 ? n : null);
      const gymId = await repos.getActiveGymId();
      if (gymId) {
        const g = await gyms.getGym(gymId);
        if (g) setGymEquipment(g.loads.map((l) => l.equipment));
      }
      if (!params.programmeId) {
        const empty = { name: "", days: [] };
        setDraft(empty);
        setInitial(empty);
        return;
      }
      const active = await programmes.getActive();
      const versions = await programmes.listVersions(params.programmeId);
      const cur = versions[0];
      setNextVersion(cur ? cur.version + 1 : null);
      // Baseline = the version in use now (what the exposure change is measured against); the draft may start from an older one.
      if (active) setBaseline(await programmes.loadDraft(active.versionId));
      const loaded = await programmes.loadDraft(params.versionId ?? active!.versionId);
      setDraft(loaded);
      setInitial(loaded);
    })().catch(() => setDraft({ name: "", days: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmes, repos, gyms, params.programmeId, params.versionId]);

  const dirty = isDraftDirty(initial, draft);
  // Header back, iOS edge-swipe and Android back all go through this. Right after a successful save the guard steps aside.
  usePreventRemove(dirty, ({ data }) => {
    if (saved.current) return nav.dispatch(data.action);
    Alert.alert(t("prog.discard.title"), t("prog.discard.body"), [
      { text: t("prog.discard.keep"), style: "cancel" },
      { text: t("prog.discard.ok"), style: "destructive", onPress: () => nav.dispatch(data.action) },
    ]);
  });

  if (!draft) return <LoadingState />;
  const problems = validateDraft(draft);

  /** Switch how an exercise is counted. Refused once sets are logged for it; the ranges of its slots restart at the usual hold / carry (or reps) range. */
  async function setMeasure(exerciseId: string, measure: Measure) {
    try {
      await programmes.setExerciseMeasure(exerciseId, measure);
      setDraft((d) => (d ? resetRangeFor(d, exerciseId, measure) : d));
      setInitial((d) => (d ? resetRangeFor(d, exerciseId, measure) : d)); // already saved to the library, not a draft edit
      setBaseline((b) => (b ? resetRangeFor(b, exerciseId, measure) : b));
      refreshLibrary();
      setMessage(null);
    } catch (e) {
      if (e instanceof MeasureLocked) setMessage(t("prog.ex.measureLocked"));
      else throw e;
    }
  }

  async function save() {
    setTouched(true);
    if (!draft || problems.length > 0) return;
    try {
      if (params.programmeId) {
        const r = await programmes.saveNewVersion(params.programmeId, draft);
        if (!r.changed) return setMessage(t("prog.noChange"));
      } else {
        await programmes.createProgramme(draft);
      }
      saved.current = true;
      setInitial(draft);
      nav.goBack();
    } catch (e) {
      if (e instanceof SessionInProgress) setMessage(t("prog.openWorkout"));
      else if (!(e instanceof DraftInvalid)) throw e;
    }
  }

  return (
    <Screen
      footer={
        <BigButton label={params.programmeId && nextVersion ? t("prog.save", { v: nextVersion }) : t("prog.saveNew")} onPress={() => void save()} />
      }
    >
      <ProgrammeEditorView initialSettingsDay={params.settingsDay} initialReorderWorkouts={params.reorderWorkouts} draft={draft} onChange={setDraft} baseline={baseline} library={library} daysPerWeek={dpw} onCreateExercise={programmes.createExercise} onLibraryChanged={refreshLibrary} onSetMeasure={setMeasure} onSetMachineLoadKind={setMachineLoadKind} onOpenLoads={(exerciseId) => nav.navigate("ExerciseLoads", { exerciseId })} gymEquipment={gymEquipment} />
      {touched ? problems.map((pr, i) => <Notice key={i} kind="error">{t(`prog.problem.${pr.code}` as StringKey, { day: (pr.day ?? 0) + 1 })}</Notice>) : null}
      {message ? <Notice kind="warn">{message}</Notice> : null}
      <ArDraftNote />
    </Screen>
  );
}
