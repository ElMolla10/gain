import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { useServices } from "../AppContext";
import { ExposureView } from "../components/ExposureView";
import type { VersionInfo } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import type { ExposureRow } from "../logic/exposure";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, EmptyState, InlineStatus, LoadingState, Screen } from "../ui";

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
  if (rows === null) return <LoadingState />;
  return (
    <Screen>
      <ExposureView rows={rows} />
    </Screen>
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
  if (!state) return <LoadingState />;
  return (
    <Screen>
      <AppText style={{ color: p.muted, fontSize: ty.secondary }}>{t("prog.versionsNote")}</AppText>
      {state.versions.map((v) => (
        <Card key={v.versionId} style={{ gap: space.sm }}>
          <AppText style={{ fontSize: ty.body }}>{t("prog.versionLine", { v: v.version, days: v.days, n: v.exercises, sessions: v.sessions })}</AppText>
          {v.isCurrent ? (
            <InlineStatus kind="success" text={t("prog.current")} />
          ) : (
            <BigButton label={t("prog.fromVersion")} variant="secondary" onPress={() => nav.navigate("ProgrammeEdit", { programmeId: state.programmeId, versionId: v.versionId })} />
          )}
        </Card>
      ))}
    </Screen>
  );
}
