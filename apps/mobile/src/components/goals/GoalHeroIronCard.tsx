import React from "react";
import { View } from "react-native";
import { barbellPlates, type PaceStatus } from "@gain/engine";
import { useI18n } from "../../i18n";
import { formatDay } from "../../logic/dateText";
import { isolateLtr } from "../../i18n/format";
import type { Unit } from "../../logic/units";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { BarArt } from "../today/BarArt";

export interface GoalHeroIronCardProps {
  exerciseName: string;
  currentE1rm: number;
  targetE1rm: number;
  unit: Unit;
  projectedDate?: string | null;
  paceStatus?: PaceStatus | null;
  ratePerExposure?: number | null;
  exposuresLeft?: number | null;
}

/**
 * 10x Goal Hero Card: compares the physical iron barbell of the current record
 * against the target milestone, with visual Olympic plate stacks, trajectory gauge,
 * and checkpoint milestones ladder.
 */
export function GoalHeroIronCard({
  exerciseName,
  currentE1rm,
  targetE1rm,
  unit,
  projectedDate,
  paceStatus = "on_pace",
  ratePerExposure,
  exposuresLeft,
}: GoalHeroIronCardProps) {
  const { t, lang, unitText } = useI18n();
  const p = usePalette();

  const standardSpec = {
    equipment: "barbell" as const,
    increment: unit === "lb" ? 5 : 2.5,
    min: unit === "lb" ? 45 : 20,
    max: unit === "lb" ? 600 : 300,
    plates: unit === "lb" ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25],
  };

  const currentPlates = (currentE1rm >= (standardSpec.min ?? 20) ? barbellPlates(standardSpec, currentE1rm)?.perSide : null) ?? [];
  const targetPlates = (targetE1rm >= (standardSpec.min ?? 20) ? barbellPlates(standardSpec, targetE1rm)?.perSide : null) ?? [];

  const deltaKg = Math.max(0, Math.round((targetE1rm - currentE1rm) * 10) / 10);
  const progressRatio = targetE1rm > 0 ? Math.min(1, Math.max(0, currentE1rm / targetE1rm)) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  // Intermediate checkpoints (e.g. halfway and 80% to goal)
  const cp1 = Math.round((currentE1rm + (targetE1rm - currentE1rm) * 0.4) * 2) / 2;
  const cp2 = Math.round((currentE1rm + (targetE1rm - currentE1rm) * 0.75) * 2) / 2;

  const paceBadgeText =
    paceStatus === "reached"
      ? t("goals.milestoneReached")
      : paceStatus === "ahead"
        ? t("goals.pace.ahead")
        : paceStatus === "on_pace"
          ? t("goals.pace.onPace")
          : paceStatus === "behind"
            ? t("goals.pace.behind")
            : t("goals.pace.maintaining");

  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: p.accent,
        padding: space.md,
        gap: space.md,
      }}
    >
      {/* Header */}
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            <AppText style={{ fontSize: 16 }}>⭐</AppText>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent, letterSpacing: 1, textTransform: "uppercase" }}>
              {t("goals.northStar.title")}
            </AppText>
          </View>
          <View
            style={{
              paddingHorizontal: space.sm,
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: p.tint,
              borderWidth: 1,
              borderColor: p.accent,
            }}
          >
            <AppText style={{ fontSize: ty.caption, fontWeight: "700", color: p.accent }}>
              {paceBadgeText}
            </AppText>
          </View>
        </View>

        <AppText style={{ fontSize: ty.title, fontWeight: "700", color: p.text }}>
          {exerciseName}
        </AppText>
        <AppText style={{ fontSize: ty.body, color: p.muted }}>
          {t("goals.targetGoal", { target: isolateLtr(`${targetE1rm} ${unitText}`) })}
        </AppText>
      </View>

      {/* Physical Iron Visualizer (Goal vs Current) */}
      <View style={{ backgroundColor: p.raised, borderRadius: radius.button, padding: space.sm, gap: space.sm }}>
        {/* Goal Bar */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent }}>
              {t("goals.bar.goal")} ({isolateLtr(`${targetE1rm} ${unitText}`)})
            </AppText>
            <AppText style={{ fontSize: ty.caption, color: p.muted }}>
              {targetPlates.length > 0
                ? t("plates.each", { plates: isolateLtr(targetPlates.join(" · ")) })
                : t("plates.bar")}
            </AppText>
          </View>
          <BarArt perSide={targetPlates} unit={unit} height={60} />
        </View>

        {/* Current Bar */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.text }}>
              {t("goals.bar.current")} ({isolateLtr(`${currentE1rm} ${unitText} e1RM`)})
            </AppText>
            <AppText style={{ fontSize: ty.caption, color: p.muted }}>
              {currentPlates.length > 0
                ? t("plates.each", { plates: isolateLtr(currentPlates.join(" · ")) })
                : t("plates.bar")}
            </AppText>
          </View>
          <BarArt perSide={currentPlates} unit={unit} height={60} />
        </View>

        {/* Delta Callout */}
        <View style={{ paddingHorizontal: space.xs, paddingTop: 2 }}>
          <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent }}>
            {deltaKg > 0
              ? t("goals.deltaEarn", { delta: isolateLtr(`+${deltaKg} ${unitText}`) })
              : t("goals.milestoneReached")}
          </AppText>
        </View>
      </View>

      {/* Progress Rail */}
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>
            {t("goals.progressPercent", { percent: isolateLtr(String(progressPercent)) })}
          </AppText>
          {projectedDate ? (
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent }}>
              {t("goals.projectedDate", { date: formatDay(Date.parse(projectedDate), lang, Date.now()) })}
            </AppText>
          ) : null}
        </View>

        {/* Gauge Track */}
        <View style={{ height: 8, borderRadius: 4, backgroundColor: p.border, overflow: "hidden" }}>
          <View
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              borderRadius: 4,
              backgroundColor: p.accent,
            }}
          />
        </View>
      </View>

      {/* Checkpoint Milestones Ladder */}
      <View style={{ gap: space.xs, borderTopWidth: 1, borderColor: p.border, paddingTop: space.sm }}>
        <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, letterSpacing: 0.5 }}>
          {t("goals.milestones.title")}
        </AppText>
        <View style={{ flexDirection: "row", gap: space.xs, flexWrap: "wrap" }}>
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.button, backgroundColor: p.tint, borderWidth: 1, borderColor: p.accent }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent }}>
              {isolateLtr(`✓ ${currentE1rm} ${unitText}`)}
            </AppText>
          </View>
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.button, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }}>
            <AppText style={{ fontSize: ty.caption, color: p.text }}>
              {isolateLtr(`► ${cp1} ${unitText}`)}
            </AppText>
          </View>
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.button, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }}>
            <AppText style={{ fontSize: ty.caption, color: p.text }}>
              {isolateLtr(`🔒 ${cp2} ${unitText}`)}
            </AppText>
          </View>
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.button, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "700", color: p.text }}>
              {isolateLtr(`⭐ ${targetE1rm} ${unitText}`)}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}
