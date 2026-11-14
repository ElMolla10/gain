import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { useI18n } from "../i18n";
import type { SurfaceBadge } from "../logic/achievementSurface";
import { latestPr, medalCount, shelves, slotRow, trainingDays, type ShelfItem } from "../logic/achievementShowcase";
import type { AchievementHome } from "../db/achievementRepo";
import { CompactShelves, LatestPrCard, NextMedals } from "../components/achievements/CompactCabinet";
import { CabinetUnveil } from "../components/achievements/CabinetUnveil";
import { unveilOrder } from "../logic/earnMoment";
import { PlateBadge } from "../components/achievements/PlateBadge";
import { MedalDetailSheet } from "../components/achievements/MedalDetailSheet";
import { space, type as ty, usePalette } from "../theme";
import { AppText, ErrorState, LoadingState, Screen } from "../ui";

/** A concise overview; all medal evidence remains in the detail sheet and Ledger. */
export function AchievementsScreen() {
  const { achievements } = useServices();
  const { t } = useI18n();
  const nav = useNavigation<{ navigate: (name: string, params: object) => void }>();
  const [items, setItems] = useState<SurfaceBadge[] | null>(null);
  const [home, setHome] = useState<AchievementHome | null>(null);
  const p = usePalette();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<SurfaceBadge | null>(null);
  const unveiled = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setFailed(false);
      void Promise.all([achievements.listCabinet(), achievements.getHome()])
        .then(([cabinet, home]) => {
          if (!alive) return;
          setItems(cabinet);
          setHome(home);
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

  const weeks12Earned = items?.some((r) => r.badgeId === "qualified_weeks_12" && r.status === "earned") === true;

  if (failed) {
    return (
      <ErrorState title={t("achievements.error")} body={t("progress.loadingFailed")} retryLabel={t("history.error.retry")} onRetry={() => setAttempt((n) => n + 1)} />
    );
  }
  if (!items || !home) return <LoadingState />;
  const lifetime = home.stats.qualifiedWeeksLifetime;
  const days = trainingDays(items, home.stats);
  const medals = medalCount(items);
  const groups = shelves(items);
  const openSlot = (item: ShelfItem) => setDetail(slotRow(item));
  const pr = latestPr(items);
  const unveil = (home.bannerCount ?? 0) > 0 && !unveiled.current;
  const endUnveil = () => {
    unveiled.current = true;
    void achievements
      .dismissBanner()
      .then(() => setHome((h) => (h ? { ...h, bannerCount: null } : h)))
      .catch((e) => diagnostics.record("warn", "cabinet", e));
  };
  const refreshHome = () => void achievements.getHome().then(setHome).catch((e) => diagnostics.record("warn", "cabinet", e));

  return (
    <Screen tab>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <PlateBadge days={days.days} />
        <AppText accessibilityRole="header" style={{ flex: 1, fontSize: ty.title, fontWeight: "600" }}>{t("achv.cabinet.title")}</AppText>
      </View>
      <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("achv.compact.summary", { earned: medals.earned, total: medals.total, days: days.days ?? 0 })}</AppText>
      <CabinetUnveil active={unveil} count={home.bannerCount ?? 0} order={unveilOrder(groups)} onDone={endUnveil}>
        <NextMedals cabinet={items} onOpen={setDetail} />
      </CabinetUnveil>
      <LatestPrCard pr={pr} cabinet={items} onOpenLedger={() => nav.navigate("Ledger", {})} />
      <CompactShelves groups={groups} quest={home.quest} onOpen={openSlot} onQuestChanged={refreshHome} />
      <Pressable accessibilityRole="button" accessibilityLabel={t("achv.r2.ledger.open")} onPress={() => nav.navigate("Ledger", {})} style={{ minHeight: 48, justifyContent: "center" }}>
        <AppText style={{ color: p.accent, fontWeight: "600" }}>{t("achv.r2.ledger.open")}</AppText>
      </Pressable>
      <MedalDetailSheet
        row={detail}
        cabinet={items}
        qualifiedWeeksLifetime={lifetime}
        weeks12Earned={weeks12Earned}
        trainingDays={days}
        onClose={() => setDetail(null)}
        onViewWorkout={(sessionId) => nav.navigate("SessionDetail", { sessionId })}
      />
    </Screen>
  );
}
