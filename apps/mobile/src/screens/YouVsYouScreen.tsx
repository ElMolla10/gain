import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import type { LiftItem } from "../db/historyRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { space, usePalette } from "../theme";
import { AppText, Card, EmptyState, ErrorState, ListRow, LoadingState, Screen } from "../ui";

export function YouVsYouScreen() {
  const { history } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (name: string, params: object) => void }>();
  const [rows, setRows] = useState<{ lift: LiftItem; score: number; tier: string }[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    setFailed(false);
    void Promise.all([history.getExercisePaths(), history.listLifts()]).then(([paths, lifts]) => {
      if (!alive) return;
      setRows(paths.flatMap(path => {
        const lift = lifts.find(l => l.lineId === path.lineId);
        return lift ? [{ lift, score: path.score, tier: path.tier }] : [];
      }).sort((a, b) => b.score - a.score));
    }).catch(e => { diagnostics.record("warn", "you vs you", e); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [history, attempt]));
  if (failed) return <ErrorState title={t("progress.loadingFailed")} body={t("progress.loadingFailed")} retryLabel={t("history.error.retry")} onRetry={() => setAttempt(n => n + 1)} />;
  if (!rows) return <LoadingState />;
  return <Screen title={t("world.personalTitle")}>
    <Card><AppText style={{ color: p.muted }}>{t("path.listRule")}</AppText></Card>
    {rows.length ? <Card style={{ paddingVertical: space.xs }}>{rows.map((r, i) => <ListRow key={r.lift.lineId}
      title={exerciseLabels(r.lift, lang).primary}
      note={`${t(`path.tier.${r.tier}` as never)} · ${r.score} · ${t(`setup.${r.lift.setup}` as never)}`}
      last={i === rows.length - 1} onPress={() => nav.navigate("LiftTrend", { lineId: r.lift.lineId })} />)}</Card>
      : <EmptyState icon="progress" title={t("path.empty")} />}
  </Screen>;
}
