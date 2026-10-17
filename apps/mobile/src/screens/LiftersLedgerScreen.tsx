import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { AchievementEvidenceSheet } from "../components/AchievementEvidenceSheet";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { evidenceLine } from "../logic/achievementEvidence";
import type { SurfaceBadge } from "../logic/achievementSurface";
import { space } from "../theme";
import { Card, EmptyState, ErrorState, ListRow, LoadingState, Screen } from "../ui";

/** Chronological personal story of major earned milestones. */
export function LiftersLedgerScreen() {
  const { achievements } = useServices();
  const { t, lang, unit } = useI18n();
  const nav = useNavigation<{ navigate: (name: string, params: object) => void }>();
  const [items, setItems] = useState<SurfaceBadge[] | null>(null);
  const [lifetime, setLifetime] = useState(0);
  const [weeks12Earned, setWeeks12Earned] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<SurfaceBadge | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setFailed(false);
      void Promise.all([achievements.listLedger(), achievements.getHome()])
        .then(([ledger, home]) => {
          if (!alive) return;
          setItems(ledger);
          setLifetime(home.stats.qualifiedWeeksLifetime);
          setWeeks12Earned(home.earned.some((r) => r.badgeId === "qualified_weeks_12"));
        })
        .catch((error) => {
          diagnostics.record("warn", "ledger", error);
          if (alive) setFailed(true);
        });
      return () => {
        alive = false;
      };
    }, [achievements, attempt]),
  );

  if (failed) {
    return (
      <ErrorState title={t("achievements.error")} body={t("progress.loadingFailed")} retryLabel={t("history.error.retry")} onRetry={() => setAttempt((n) => n + 1)} />
    );
  }
  if (!items) return <LoadingState />;

  return (
    <Screen title={t("achv.ledger.title")}>
      {items.length === 0 ? (
        <EmptyState icon="progress" title={t("empty.noMilestones")} body={t("achv.ledger.empty")} />
      ) : (
        <Card style={{ paddingVertical: space.xs }}>
          {items.map((row, i) => (
            <ListRow
              key={row.id}
              title={t(row.i18nKey as StringKey)}
              note={`${row.earnedLocalDate ?? ""} · ${evidenceLine(row.evidence, t, lang, unit, { nameEn: row.exerciseNameEn, nameAr: row.exerciseNameAr })}`}
              last={i === items.length - 1}
              onPress={() => setDetail(row)}
            />
          ))}
        </Card>
      )}
      <AchievementEvidenceSheet
        row={detail}
        qualifiedWeeksLifetime={lifetime}
        weeks12Earned={weeks12Earned}
        onClose={() => setDetail(null)}
        onViewWorkout={(sessionId) => nav.navigate("SessionDetail", { sessionId })}
      />
    </Screen>
  );
}
