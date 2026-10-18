import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { telemetry } from "../achievementTelemetry";
import { diagnostics } from "../diagnostics";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { evidenceLine } from "../logic/achievementEvidence";
import type { AchievementHome } from "../db/achievementRepo";
import type { SurfaceBadge } from "../logic/achievementSurface";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, ListRow } from "../ui";
import { AchievementEvidenceSheet } from "./AchievementEvidenceSheet";

/** Progress, below the lists: this week's pulse, last two earned badges and next-up. The cabinet and ledger entries are CabinetEntry, at the top. */
export function EvidenceAchievementsCard() {
  const { achievements } = useServices();
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (n: string, params: object) => void }>();
  const [home, setHome] = useState<AchievementHome | null>(null);
  const [detail, setDetail] = useState<SurfaceBadge | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      achievements
        .getHome()
        .then((v) => {
          if (alive) setHome(v);
        })
        .catch((e) => diagnostics.record("warn", "achievements home", e));
      return () => {
        alive = false;
      };
    }, [achievements]),
  );

  if (!home) return null;
  const pulseNote = home.pulse.qualified ? t("achv.pulse.qualified") : t("achv.pulse.progress", { done: home.pulse.qualifiedDays, goal: home.pulse.dayTarget });
  const weeks12Earned = home.earned.some((r) => r.badgeId === "qualified_weeks_12");
  return (
    <View>
      {home.bannerCount !== null ? (
        <Card>
          <AppText>{t("achv.banner", { n: home.bannerCount })}</AppText>
          <BigButton variant="secondary" label={t("achv.banner.dismiss")} onPress={() => void achievements.dismissBanner().then(() => setHome({ ...home, bannerCount: null }))} />
        </Card>
      ) : null}
      {home.quest ? (
        <Card>
          <AppText accessibilityRole="header" style={{ fontWeight: "600" }}>{t("quest.title")}</AppText>
          {(home.quest.status === "completed" || (home.quest.picked && !home.quest.canSwap)
            ? (home.quest.picked ? [home.quest.picked] : [])
            : home.quest.offers).map((card) => {
            const selected = home.quest!.picked?.kind === card.kind;
            const progress = selected ? home.quest!.progress : null;
            return (
              <View key={card.kind + card.titleKey} style={{ gap: space.xs, paddingVertical: space.sm }}>
                <AppText style={{ fontWeight: selected ? "600" : "400" }}>{t(card.titleKey as StringKey)}</AppText>
                {progress ? (
                  <View
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel={t("quest.a11y", { done: progress.current, goal: progress.target })}
                    accessibilityValue={{ min: 0, max: progress.target, now: progress.current }}
                  >
                    <AppText style={{ color: p.muted }}>{t("quest.progress", { done: progress.current, goal: progress.target })}</AppText>
                  </View>
                ) : null}
                {home.quest!.status === "completed" && selected ? <AppText>{t("quest.done")}</AppText> : null}
                {home.quest!.status !== "completed" && (!selected || home.quest!.canSwap) ? (
                  <BigButton
                    variant="secondary"
                    label={selected ? t("quest.swap") : t("quest.pick")}
                    onPress={() => {
                      telemetry.record(selected ? "quest_swapped" : "quest_picked");
                      void achievements.pickQuest(card.kind).then(() => achievements.getHome().then(setHome));
                    }}
                  />
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : null}
      <Card>
        <AppText accessibilityRole="header" style={{ fontWeight: "600" }}>{t("achv.pulse.title")}</AppText>
        <AppText style={{ fontSize: ty.title, color: p.accent }}>{pulseNote}</AppText>
        <AppText style={{ color: p.muted }}>{t("achv.pulse.rest")}</AppText>
      </Card>
      <Card style={{ paddingVertical: space.xs }}>
        <AppText accessibilityRole="header" style={{ fontWeight: "600", paddingHorizontal: space.xs, paddingTop: space.sm }}>{t("achv.recent.title")}</AppText>
        {home.recent.length === 0 ? (
          <AppText style={{ color: p.muted, padding: space.sm }}>{t("achv.empty")}</AppText>
        ) : (
          home.recent.map((row, i) => (
            <ListRow
              key={row.id}
              title={t(row.i18nKey as StringKey)}
              note={evidenceLine(row.evidence, t, lang, unit, { nameEn: row.exerciseNameEn, nameAr: row.exerciseNameAr })}
              last={i === home.recent.length - 1}
              onPress={() => setDetail(row)}
            />
          ))
        )}
      </Card>
      <Card style={{ paddingVertical: space.xs }}>
        <AppText accessibilityRole="header" style={{ fontWeight: "600", paddingHorizontal: space.xs, paddingTop: space.sm }}>{t("achv.nextup.title")}</AppText>
        {home.nextUp.length === 0 ? (
          <AppText style={{ color: p.muted, padding: space.sm }}>{t("achv.nextup.empty")}</AppText>
        ) : (
          home.nextUp.map((row, i) => (
            <View
              key={row.badgeId}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t("achv.nextup.a11y", { done: row.current, goal: row.target })}
              accessibilityValue={{ min: 0, max: row.target, now: row.current }}
            >
              <ListRow
                title={t(row.i18nKey as StringKey)}
                note={t("achv.nextup.progress", { done: row.current, goal: row.target })}
                last={i === home.nextUp.length - 1}
              />
            </View>
          ))
        )}
      </Card>
      <AchievementEvidenceSheet
        row={detail}
        qualifiedWeeksLifetime={home.stats.qualifiedWeeksLifetime}
        weeks12Earned={weeks12Earned}
        onClose={() => setDetail(null)}
        onViewWorkout={(sessionId) => nav.navigate("SessionDetail", { sessionId })}
      />
    </View>
  );
}
