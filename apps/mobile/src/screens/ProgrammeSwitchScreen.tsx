import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ScrollView } from "react-native";
import { useServices } from "../AppContext";
import { DraftInvalid, SessionInProgress, type ProgrammeInfo } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { ceilingForName } from "../logic/ceilings";
import { GYM_EQUIPMENT } from "../logic/gymInput";
import { markGoalLift } from "../logic/onboarding";
import { TemplateBrowser } from "../components/TemplateBrowser";
import { instantiateTemplate, TEMPLATES, type Template } from "../logic/templates";
import { space, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card } from "../ui";

/**
 * Choose a different programme: switch back to one of your own (all its versions and history stay) or start a template as a NEW programme.
 * Nothing is deleted or overwritten: the programme you leave is still in this list.
 */
export function ProgrammeSwitchScreen() {
  const { programmes, repos, onboarding } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ goBack: () => void; navigate: (n: "ProgrammeEdit") => void }>();
  const [list, setList] = useState<ProgrammeInfo[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    programmes.listProgrammes().then(setList).catch(() => setList([]));
  }, [programmes]);
  useFocusEffect(refresh);

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      nav.goBack();
    } catch (e) {
      setBusy(false);
      if (e instanceof SessionInProgress) setMessage(t("prog.openWorkout"));
      else if (e instanceof DraftInvalid) setMessage(t("ob.error"));
      else setMessage(t("prog.switch.error"));
    }
  }

  async function startTemplate(tpl: Template) {
    const [seedKeys, ceilings, library, goal] = await Promise.all([programmes.seedKeyMap(), repos.getRepCeilingDefaults(), programmes.listExercises(), onboarding.getGoal()]);
    const goalExerciseId = goal?.kind === "lift" ? goal.exerciseId : null;
    const goalKey = goalExerciseId ? (library.find((e) => e.id === goalExerciseId)?.seedKey ?? null) : null;
    const { draft } = instantiateTemplate(tpl, { byKey: seedKeys }, {
      lang,
      equipment: [...GYM_EQUIPMENT],
      goalLiftKey: goalKey,
      ceilingFor: (key) => ceilingForName(library.find((e) => e.seedKey === key)?.nameEn ?? key, ceilings),
    });
    await programmes.createProgramme(goalExerciseId ? markGoalLift(draft, goalExerciseId) : draft, { activate: true });
  }

  if (list === null) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      <AppText style={{ color: p.muted }}>{t("prog.switch.note")}</AppText>
      {message ? <AppText style={{ fontWeight: "700" }}>⚠ {message}</AppText> : null}
      <AppText style={{ fontSize: 20, fontWeight: "800" }}>{t("prog.switch.mine")}</AppText>
      {list.map((g) => (
        <Card key={g.programmeId}>
          <AppText style={{ fontSize: 18, fontWeight: "700" }}>{g.name}</AppText>
          <AppText style={{ color: p.muted }}>{t("prog.switch.line", { v: g.version, days: g.days, sessions: g.finishedSessions })}</AppText>
          {g.isActive ? <AppText style={{ color: p.accent, fontWeight: "700" }}>✓ {t("prog.current")}</AppText> : <BigButton label={t("prog.switch.use")} disabled={busy} onPress={() => void run(() => programmes.setActiveProgramme(g.programmeId))} />}
        </Card>
      ))}
      <AppText style={{ fontSize: 20, fontWeight: "800" }}>{t("prog.switch.templates")}</AppText>
      <AppText style={{ color: p.muted, fontSize: 13 }}>{t("ob.programme.unreviewed")}</AppText>
      <TemplateBrowser templates={TEMPLATES} showDaysFilter actionLabel={() => t("prog.switch.startTemplate")} disabled={busy} onPick={(tpl) => void run(() => startTemplate(tpl))} />
      <BigButton label={t("prog.new")} selected={false} onPress={() => nav.navigate("ProgrammeEdit")} />
      <ArDraftNote />
    </ScrollView>
  );
}
