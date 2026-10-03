import { useNavigation, useRoute } from "@react-navigation/native";
import type { Measure } from "@gain/engine";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { useServices } from "../AppContext";
import { ProgrammeEditorView } from "../components/ProgrammeEditorView";
import { DraftInvalid, MeasureLocked, SessionInProgress, type LibraryExercise } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { resetRangeFor, validateDraft, type ProgrammeDraft } from "../logic/programmeDraft";
import { space } from "../theme";
import { AppText, ArDraftNote, BigButton } from "../ui";

export function ProgrammeEditScreen() {
  const { programmes, repos } = useServices();
  const { t } = useI18n();
  const nav = useNavigation<{ goBack: () => void }>();
  const params = (useRoute().params ?? {}) as { versionId?: string; programmeId?: string };
  const [draft, setDraft] = useState<ProgrammeDraft | null>(null);
  const [baseline, setBaseline] = useState<ProgrammeDraft | null>(null);
  const [nextVersion, setNextVersion] = useState<number | null>(null);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [dpw, setDpw] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshLibrary = useCallback(() => {
    programmes.listExercises().then(setLibrary);
  }, [programmes]);

  useEffect(() => {
    (async () => {
      refreshLibrary();
      const n = Number(await repos.getSetting("days_per_week"));
      setDpw(Number.isFinite(n) && n > 0 ? n : null);
      if (!params.programmeId) {
        setDraft({ name: "", days: [] });
        return;
      }
      const active = await programmes.getActive();
      const versions = await programmes.listVersions(params.programmeId);
      const cur = versions[0];
      setNextVersion(cur ? cur.version + 1 : null);
      // Baseline = the version in use now (what the exposure change is measured against); the draft may start from an older one.
      if (active) setBaseline(await programmes.loadDraft(active.versionId));
      setDraft(await programmes.loadDraft(params.versionId ?? active!.versionId));
    })().catch(() => setDraft({ name: "", days: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmes, repos, params.programmeId, params.versionId]);

  if (!draft) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  const problems = validateDraft(draft);

  /** Switch how an exercise is counted. Refused once sets are logged for it; the ranges of its slots restart at the usual hold / carry (or reps) range. */
  async function setMeasure(exerciseId: string, measure: Measure) {
    try {
      await programmes.setExerciseMeasure(exerciseId, measure);
      setDraft((d) => (d ? resetRangeFor(d, exerciseId, measure) : d));
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
      nav.goBack();
    } catch (e) {
      if (e instanceof SessionInProgress) setMessage(t("prog.openWorkout"));
      else if (!(e instanceof DraftInvalid)) throw e;
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 3 }} keyboardShouldPersistTaps="handled">
      <ProgrammeEditorView draft={draft} onChange={setDraft} baseline={baseline} library={library} daysPerWeek={dpw} onCreateExercise={programmes.createExercise} onLibraryChanged={refreshLibrary} onSetMeasure={setMeasure} />
      {touched
        ? problems.map((pr, i) => (
            <AppText key={i} style={{ fontWeight: "600" }}>
              ⚠ {t(`prog.problem.${pr.code}` as StringKey, { day: (pr.day ?? 0) + 1 })}
            </AppText>
          ))
        : null}
      {message ? <AppText style={{ fontWeight: "700" }}>{message}</AppText> : null}
      <BigButton label={params.programmeId && nextVersion ? t("prog.save", { v: nextVersion }) : t("prog.saveNew")} onPress={() => void save()} />
      <ArDraftNote />
    </ScrollView>
  );
}
