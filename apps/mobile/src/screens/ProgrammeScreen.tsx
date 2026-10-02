import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ScrollView } from "react-native";
import { useServices } from "../AppContext";
import { ExposureView } from "../components/ExposureView";
import type { LibraryExercise, VersionInfo } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import type { ExposureRow } from "../logic/exposure";
import type { ProgrammeDraft } from "../logic/programmeDraft";
import { space, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card } from "../ui";

type Nav = { navigate: (name: "ProgrammeEdit", params?: { versionId?: string; programmeId?: string }) => void };

interface Data {
  programmeId: string;
  name: string;
  version: number;
  isSample: boolean;
  draft: ProgrammeDraft;
  library: Map<string, LibraryExercise>;
  versions: VersionInfo[];
  exposure: ExposureRow[];
}

export function ProgrammeScreen() {
  const { programmes } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const nav = useNavigation<Nav>();
  const [data, setData] = useState<Data | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const a = await programmes.getActive();
        if (!a) return alive && setData(null);
        const [draft, lib, versions] = await Promise.all([programmes.loadDraft(a.versionId), programmes.listExercises(), programmes.listVersions(a.programmeId)]);
        const exposure = await programmes.exposureOf(draft);
        if (alive) setData({ programmeId: a.programmeId, name: a.programmeName, version: a.version, isSample: a.isSample, draft, library: new Map(lib.map((e) => [e.id, e])), versions, exposure });
      })().catch(() => alive && setData(null));
      return () => {
        alive = false;
      };
    }, [programmes]),
  );

  if (data === undefined) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  if (data === null)
    return (
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
        <AppText>{t("prog.none")}</AppText>
        <BigButton label={t("prog.new")} onPress={() => nav.navigate("ProgrammeEdit")} />
      </ScrollView>
    );

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      <Card>
        <AppText style={{ fontSize: 24, fontWeight: "800" }}>{data.name}</AppText>
        <AppText style={{ color: p.muted }}>{t("prog.version", { v: data.version })}</AppText>
        {data.isSample ? <AppText style={{ color: p.muted }}>{t("prog.sampleTag")}</AppText> : null}
      </Card>
      {data.draft.days.map((day, i) => (
        <Card key={i}>
          <AppText style={{ fontSize: 18, fontWeight: "700" }}>{day.name}</AppText>
          <AppText style={{ color: p.muted }}>{t("prog.dayLine", { n: day.exercises.length, sets: day.exercises.reduce((n, e) => n + e.sets, 0) })}</AppText>
          {day.exercises.map((e) => {
            const ex = data.library.get(e.exerciseId);
            return <AppText key={e.exerciseId}>{ex ? exerciseLabels(ex, lang).primary : e.exerciseId}{e.isGoalLift ? ` · ${t("today.goalTag")}` : ""}</AppText>;
          })}
        </Card>
      ))}
      <BigButton label={t("prog.edit")} onPress={() => nav.navigate("ProgrammeEdit", { programmeId: data.programmeId })} />
      <ExposureView rows={data.exposure} />
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("prog.versions")}</AppText>
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("prog.versionsNote")}</AppText>
        {data.versions.map((v) => (
          <Card key={v.versionId} style={{ gap: space.xs }}>
            <AppText>{t("prog.versionLine", { v: v.version, days: v.days, n: v.exercises, sessions: v.sessions })}</AppText>
            {v.isCurrent ? <AppText style={{ color: p.accent, fontWeight: "700" }}>✓ {t("prog.current")}</AppText> : <BigButton label={t("prog.fromVersion")} selected={false} onPress={() => nav.navigate("ProgrammeEdit", { programmeId: data.programmeId, versionId: v.versionId })} />}
          </Card>
        ))}
      </Card>
      <BigButton label={t("prog.new")} selected={false} onPress={() => nav.navigate("ProgrammeEdit")} />
      <ArDraftNote />
    </ScrollView>
  );
}
