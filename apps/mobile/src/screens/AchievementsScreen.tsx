import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { useI18n } from "../i18n";
import type { SurfaceBadge } from "../logic/achievementSurface";
import { medalsValue } from "../logic/achievementCopy";
import { almostThere, isPartialCabinet, latestPr, medalCount, shelves, slotRow, trainingDays, verifiedPrs, type ShelfItem } from "../logic/achievementShowcase";
import type { AchievementHome } from "../db/achievementRepo";
import { AlmostThere } from "../components/achievements/AlmostThere";
import { CabinetShelf } from "../components/achievements/CabinetShelf";
import { CabinetUnveil } from "../components/achievements/CabinetUnveil";
import { unveilOrder } from "../logic/earnMoment";
import { LedgerTeaser } from "../components/achievements/LedgerTeaser";
import { LifetimePlate } from "../components/achievements/LifetimePlate";
import { MedalDetailSheet } from "../components/achievements/MedalDetailSheet";
import { MonthSeal } from "../components/achievements/MonthSeal";
import { PrPlaques, PrSpotlight } from "../components/achievements/PrSpotlight";
import { StatTileRow } from "../components/achievements/StatTiles";
import { WeekSleeve } from "../components/achievements/WeekSleeve";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, ErrorState, LoadingState, Screen } from "../ui";

/**
 * The Achievements screen, round 2: Trophy Cabinet (four shelves) first, then Lifetime Plate · this week's sleeve · stat row · PR spotlight ·
 * Almost there · month seal · Lifter's Ledger teaser. Presentation only: everything is read from listCabinet() and getHome().
 */
export function AchievementsScreen() {
  const { achievements, history } = useServices();
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
  const prY = useRef(0);
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
  const partial = isPartialCabinet(groups);
  const nothingYet = groups.every((g) => g.earned === 0);
  const firstMedal = nothingYet ? items.find((r) => r.badgeId === "first_session") ?? null : null;
  const openSlot = (item: ShelfItem) => setDetail(slotRow(item));
  const pr = latestPr(items);
  // The lift trend is keyed by line (exercise + gym + setup); open the most recent line for this PR's exercise and setup.
  const openTrend = (row: NonNullable<typeof pr>) =>
    void history
      .listLifts()
      .then((lifts) => {
        const id = row.evidence.identity;
        const line = lifts.filter((l) => l.exerciseId === id.exerciseId && l.setup === id.setup).sort((a, b) => b.lastAt - a.lastAt)[0];
        if (line) nav.navigate("LiftTrend", { lineId: line.lineId });
        else setDetail(row);
      })
      .catch((e) => diagnostics.record("warn", "cabinet", e));
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
    <Screen tab scrollRef={scroll}>
      {/* The Trophy Cabinet first: this screen is the cabinet, so its shelves are not buried under the plate, stats and spotlight. */}
      <View
        style={{ gap: space.md }}
        onLayout={(e) => {
          cabinetY.current = e.nativeEvent.layout.y;
        }}
      >
        <AppText accessibilityRole="header" style={{ fontSize: ty.title, lineHeight: 34, fontWeight: "600" }}>{t("achv.cabinet.title")}</AppText>
        <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("achv.r2.cabinet.count", { earned: medals.earned, total: medals.total })}</AppText>
        <CabinetUnveil active={unveil} count={home.bannerCount ?? 0} order={unveilOrder(groups)} onDone={endUnveil}>
          {groups.map((g) => (
            <CabinetShelf key={g.shelf} shelf={g.shelf} items={g.items} partial={partial} onOpen={openSlot} />
          ))}
        </CabinetUnveil>
      </View>
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
            { value: String(verifiedPrs(items).length), label: t("achv.r2.stat.prs"), onPress: () => scroll.current?.scrollTo({ y: prY.current, animated: true }), hint: t("achv.r2.pr.eyebrow") },
            {
              value: medalsValue(medals.earned, medals.total, t),
              label: t("achv.r2.stat.medals"),
              onPress: () => scroll.current?.scrollTo({ y: cabinetY.current, animated: true }),
              hint: t("achv.r2.cabinet.title"),
            },
          ]}
        />
      )}
      <View
        style={{ gap: space.xl }}
        onLayout={(e) => {
          prY.current = e.nativeEvent.layout.y;
        }}
      >
        <PrSpotlight pr={pr} cabinet={items} onOpenTrend={openTrend} onOpen={setDetail} />
        <PrPlaques cabinet={items} onOpen={setDetail} />
      </View>
      <AlmostThere rows={almostThere(items)} first={firstMedal} onOpen={setDetail} />
      <MonthSeal quest={home.quest} onChanged={refreshHome} />
      <LedgerTeaser earned={home.earned} onOpenLedger={() => nav.navigate("Ledger", {})} onOpen={setDetail} />
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
