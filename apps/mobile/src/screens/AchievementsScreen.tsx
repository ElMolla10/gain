import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { AchievementEvidenceSheet } from "../components/AchievementEvidenceSheet";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { useI18n } from "../i18n";
import type { SurfaceBadge } from "../logic/achievementSurface";
import { medalsValue } from "../logic/achievementCopy";
import { almostThere, isPartialCabinet, medalCount, shelves, slotRow, trainingDays, verifiedPrs, type ShelfItem } from "../logic/achievementShowcase";
import type { AchievementHome } from "../db/achievementRepo";
import { AlmostThere } from "../components/achievements/AlmostThere";
import { CabinetShelf } from "../components/achievements/CabinetShelf";
import { LedgerTeaser } from "../components/achievements/LedgerTeaser";
import { LifetimePlate } from "../components/achievements/LifetimePlate";
import { MonthSeal } from "../components/achievements/MonthSeal";
import { StatTileRow } from "../components/achievements/StatTiles";
import { WeekSleeve } from "../components/achievements/WeekSleeve";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, ErrorState, LoadingState, Screen, SectionTitle } from "../ui";

/**
 * The Achievements tab, round 2 (spec §1): Lifetime Plate · this week's sleeve · stat row · Almost there · month seal · Trophy Cabinet
 * (four shelves) · Lifter's Ledger teaser. Presentation only: everything is read from listCabinet() and getHome().
 */
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
  const scroll = useRef<ScrollView>(null);
  const cabinetY = useRef(0);

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
  const partial = isPartialCabinet(groups);
  const nothingYet = groups.every((g) => g.earned === 0);
  const firstMedal = nothingYet ? items.find((r) => r.badgeId === "first_session") ?? null : null;
  const openSlot = (item: ShelfItem) => setDetail(slotRow(item));
  const refreshHome = () => void achievements.getHome().then(setHome).catch((e) => diagnostics.record("warn", "cabinet", e));

  return (
    <Screen scrollRef={scroll}>
      <View style={{ gap: space.md }}>
        <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, textAlign: "center" }}>{t("achv.r2.plate.eyebrow")}</AppText>
        <LifetimePlate days={days.days} daysIsFloor={days.floor} />
        {(days.days ?? 0) <= 0 ? <BigButton variant="primary" icon="play" label={t("achv.r2.plate.start")} onPress={() => nav.navigate("Tabs", { screen: "Today" })} /> : null}
      </View>
      <WeekSleeve qualifiedDays={home.pulse.qualifiedDays} dayTarget={home.pulse.dayTarget} />
      {nothingYet ? null : (
        <StatTileRow
          tiles={[
            { value: String(lifetime), label: t("achv.r2.stat.weeks"), onPress: () => nav.navigate("Ledger", {}), hint: t("achv.ledger.open") },
            { value: String(verifiedPrs(items).length), label: t("achv.r2.stat.prs") },
            {
              value: medalsValue(medals.earned, medals.total, t),
              label: t("achv.r2.stat.medals"),
              onPress: () => scroll.current?.scrollTo({ y: cabinetY.current, animated: true }),
              hint: t("achv.r2.cabinet.title"),
            },
          ]}
        />
      )}
      <AlmostThere rows={almostThere(items)} first={firstMedal} onOpen={setDetail} />
      <MonthSeal quest={home.quest} onChanged={refreshHome} />
      <View
        style={{ gap: space.md }}
        onLayout={(e) => {
          cabinetY.current = e.nativeEvent.layout.y;
        }}
      >
        <SectionTitle action={<AppText style={{ fontSize: ty.label, color: p.muted }}>{t("achv.r2.cabinet.count", { earned: medals.earned, total: medals.total })}</AppText>}>
          {t("achv.r2.cabinet.title")}
        </SectionTitle>
        {groups.map((g) => (
          <CabinetShelf key={g.shelf} shelf={g.shelf} items={g.items} partial={partial} onOpen={openSlot} />
        ))}
      </View>
      <LedgerTeaser earned={home.earned} onOpenLedger={() => nav.navigate("Ledger", {})} onOpen={setDetail} />
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
