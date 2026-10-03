import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ScrollView } from "react-native";
import { useServices } from "../AppContext";
import { ExposureView } from "../components/ExposureView";
import type { VersionInfo } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import type { ExposureRow } from "../logic/exposure";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";

/** Secondary views of the active programme, one tap from the Plan tab: weekly exposure per muscle, and saved versions. */
export function ProgrammeExposureScreen() {
  const { programmes } = useServices();
  const { t } = useI18n();
  const [rows, setRows] = useState<ExposureRow[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const a = await programmes.getActive();
        if (!a) return alive && setRows([]);
        const draft = await programmes.loadDraft(a.versionId);
        const exposure = await programmes.exposureOf(draft);
        if (alive) setRows(exposure);
      })().catch(() => alive && setRows([]));
      return () => {
        alive = false;
      };
    }, [programmes]),
  );
  if (rows === null) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <ExposureView rows={rows} />
    </ScrollView>
  );
}

export function ProgrammeVersionsScreen() {
  const { programmes } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (name: "ProgrammeEdit", params: { versionId: string; programmeId: string }) => void }>();
  const [state, setState] = useState<{ programmeId: string; versions: VersionInfo[] } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const a = await programmes.getActive();
        if (!a) return alive && setState({ programmeId: "", versions: [] });
        const versions = await programmes.listVersions(a.programmeId);
        if (alive) setState({ programmeId: a.programmeId, versions });
      })().catch(() => alive && setState({ programmeId: "", versions: [] }));
      return () => {
        alive = false;
      };
    }, [programmes]),
  );
  if (!state) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <AppText style={{ color: p.muted, fontSize: ty.secondary }}>{t("prog.versionsNote")}</AppText>
      {state.versions.map((v) => (
        <Card key={v.versionId} style={{ gap: space.sm }}>
          <AppText style={{ fontSize: ty.body }}>{t("prog.versionLine", { v: v.version, days: v.days, n: v.exercises, sessions: v.sessions })}</AppText>
          {v.isCurrent ? (
            <AppText style={{ color: p.accent, fontWeight: "700", fontSize: ty.body }}>✓ {t("prog.current")}</AppText>
          ) : (
            <BigButton label={t("prog.fromVersion")} selected={false} onPress={() => nav.navigate("ProgrammeEdit", { programmeId: state.programmeId, versionId: v.versionId })} />
          )}
        </Card>
      ))}
    </ScrollView>
  );
}
