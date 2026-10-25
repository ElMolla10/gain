import React from "react";
import { View } from "react-native";
import { barbellPlates, type PaceStatus } from "@gain/engine";
import { useI18n } from "../../i18n";
import { e1rmText } from "../../logic/loadText";
import { formatDay } from "../../logic/dateText";
import { isolateLtr, isolateParam } from "../../i18n/format";
import { goalHeroModel } from "../../logic/goalHero";
import type { Unit } from "../../logic/units";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { BarArt } from "../today/BarArt";

export interface GoalHeroIronCardProps {
  exerciseName: string;
  /** null = no usable history for this lift yet: the card shows the target and an empty state only. */
  currentE1rm: number | null;
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
  const { t, lang } = useI18n();
  const fmt = (kg: number) => e1rmText(kg, lang, unit);
  const p = usePalette();

  const standardSpec = {
    equipment: "barbell" as const,
    increment: unit === "lb" ? 5 : 2.5,
    min: unit === "lb" ? 45 : 20,
    max: unit === "lb" ? 600 : 300,
    plates: unit === "lb" ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25],
  };

  const model = goalHeroModel(currentE1rm, targetE1rm);
  const currentPlates = (currentE1rm !== null && currentE1rm >= (standardSpec.min ?? 20) ? barbellPlates(standardSpec, currentE1rm)?.perSide : null) ?? [];
  const targetPlates = (targetE1rm >= (standardSpec.min ?? 20) ? barbellPlates(standardSpec, targetE1rm)?.perSide : null) ?? [];

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
          {t("goals.targetGoal", { target: fmt(targetE1rm) })}
        </AppText>
      </View>

      {/* Physical Iron Visualizer (Goal vs Current) */}
      <View style={{ backgroundColor: p.raised, borderRadius: radius.button, padding: space.sm, gap: space.sm }}>
        {/* Goal Bar */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent }}>
              {t("goals.bar.goal")} ({fmt(targetE1rm)})
            </AppText>
            <AppText style={{ fontSize: ty.caption, color: p.muted }}>
              {targetPlates.length > 0
                ? t("plates.each", { plates: isolateLtr(targetPlates.join(" · ")) })
                : t("plates.bar")}
            </AppText>
          </View>
          <BarArt perSide={targetPlates} unit={unit} height={60} />
        </View>

        {model.kind === "progress" ? (
          <>
        {/* Current Bar */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.text }}>
              {t("goals.bar.current")} ({t("goals.bar.currentE1rm", { load: fmt(currentE1rm ?? 0) })})
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
            {model.deltaKg > 0
              ? t("goals.deltaEarn", { delta: `+${fmt(model.deltaKg)}` })
              : t("goals.milestoneReached")}
          </AppText>
        </View>
          </>
        ) : (
          <AppText style={{ fontSize: ty.caption, color: p.muted, paddingHorizontal: space.xs }}>
            {t("goals.hero.noData", { exercise: isolateParam(exerciseName) })}
          </AppText>
        )}
      </View>

      {model.kind === "progress" ? (
        <>
      {/* Progress Rail */}
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>
            {t("goals.progressPercent", { percent: isolateLtr(String(model.percent)) })}
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
              width: `${model.percent}%`,
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
              {`✓ ${fmt(currentE1rm ?? 0)}`}
            </AppText>
          </View>
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.button, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }}>
            <AppText style={{ fontSize: ty.caption, color: p.text }}>
              {`► ${fmt(model.cp1)}`}
            </AppText>
          </View>
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.button, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }}>
            <AppText style={{ fontSize: ty.caption, color: p.text }}>
              {`🔒 ${fmt(model.cp2)}`}
            </AppText>
          </View>
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.button, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "700", color: p.text }}>
              {`⭐ ${fmt(targetE1rm)}`}
            </AppText>
          </View>
        </View>
      </View>
        </>
      ) : null}
    </View>
  );
}
