import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { AchievementEvidenceSheet, prestigeNote } from "../components/AchievementEvidenceSheet";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { evidenceLine } from "../logic/achievementEvidence";
import { filterCabinet, type CabinetFamilyFilter, type CabinetStatusFilter, type SurfaceBadge } from "../logic/achievementSurface";
import { space } from "../theme";
import { Card, Chip, EmptyState, ErrorState, ListRow, LoadingState, Screen } from "../ui";

const FAMILIES: CabinetFamilyFilter[] = [
  "all",
  "first_session",
  "qualified_weeks",
  "strength_pr",
  "comeback",
  "dedicated",
  "block_builder",
  "full_spectrum",
  "iron_hold",
  "iron_carry",
  "workhorse",
  "hundred_club",
  "multi_year",
  "pin_target",
  "quest",
];

/** Trophy Cabinet: Phase 1 badges with craft prestige, filters, and an evidence sheet. */
export function AchievementsScreen() {
  const { achievements } = useServices();
  const { t, lang, unit } = useI18n();
  const nav = useNavigation<{ navigate: (name: string, params: object) => void }>();
  const [items, setItems] = useState<SurfaceBadge[] | null>(null);
  const [lifetime, setLifetime] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<CabinetStatusFilter>("all");
  const [family, setFamily] = useState<CabinetFamilyFilter>("all");
  const [detail, setDetail] = useState<SurfaceBadge | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setFailed(false);
      void Promise.all([achievements.listCabinet(), achievements.getHome()])
        .then(([cabinet, home]) => {
          if (!alive) return;
          setItems(cabinet);
          setLifetime(home.stats.qualifiedWeeksLifetime);
        })
        .catch((error) => {
          diagnostics.record("warn", "cabinet", error);
          if (alive) setFailed(true);
        });
      return () => {
        alive = false;
      };
    }, [achievements, attempt]),
  );

  const visible = useMemo(() => (items ? filterCabinet(items, status, family) : []), [items, status, family]);
  const weeks12Earned = items?.some((r) => r.badgeId === "qualified_weeks_12" && r.status === "earned") === true;

  if (failed) {
    return (
      <ErrorState title={t("achievements.error")} body={t("progress.loadingFailed")} retryLabel={t("history.error.retry")} onRetry={() => setAttempt((n) => n + 1)} />
    );
  }
  if (!items) return <LoadingState />;

  const noteFor = (row: SurfaceBadge): string => {
    if (row.status === "earned") return evidenceLine(row.evidence, t, lang, unit, { nameEn: row.exerciseNameEn, nameAr: row.exerciseNameAr });
    if (row.status === "in_progress") return t("achv.nextup.progress", { done: row.progressCurrent ?? 0, goal: row.progressTarget ?? 0 });
    return t("achievements.locked");
  };

  return (
    <Screen title={t("achv.cabinet.title")}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Chip label={t("achv.cabinet.filter.all")} selected={status === "all"} onPress={() => setStatus("all")} />
        <Chip label={t("achv.cabinet.filter.earned")} selected={status === "earned"} onPress={() => setStatus("earned")} />
        <Chip label={t("achv.cabinet.filter.inProgress")} selected={status === "in_progress"} onPress={() => setStatus("in_progress")} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {FAMILIES.map((f) => (
          <Chip key={f} label={t(`achv.family.${f}` as StringKey)} selected={family === f} onPress={() => setFamily(f)} />
        ))}
      </View>
      {visible.length === 0 ? (
        <EmptyState icon="progress" title={t("empty.filter")} />
      ) : (
        <Card style={{ paddingVertical: space.xs }}>
          {visible.map((row, i) => (
            <ListRow
              key={row.id}
              title={t(row.i18nKey as StringKey)}
              note={`${prestigeNote(row.badgeId, t)} · ${noteFor(row)}`}
              last={i === visible.length - 1}
              onPress={() => setDetail(row)}
              accessibilityLabel={t("achv.badge.a11y", {
                name: t(row.i18nKey as StringKey),
                state: row.status === "earned" ? t("achv.badge.earned") : t("achv.badge.inProgress"),
              })}
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
