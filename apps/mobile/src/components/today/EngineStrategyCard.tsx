import React from "react";
import { View } from "react-native";
import { useI18n } from "../../i18n";
import { setText } from "../../logic/loadText";
import { isolateLtr } from "../../i18n/format";
import type { Unit } from "../../logic/units";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText, QuietAction } from "../../ui";

export interface EngineStrategyCardProps {
  leadName: string;
  targetLoad: number;
  targetReps: number;
  unit: Unit;
  reasonText?: string | null;
  lastTimeText?: string | null;
  isGoal?: boolean;
  onWhy?: () => void;
}

/**
 * Tactical Engine Strategy Brief for the Today Screen: explains progressive overload
 * target, rationale, previous achievement, and the unlock trigger.
 */
export function EngineStrategyCard({
  leadName,
  targetLoad,
  targetReps,
  unit,
  reasonText,
  lastTimeText,
  isGoal,
  onWhy,
}: EngineStrategyCardProps) {
  const { t, lang } = useI18n();
  const p = usePalette();

  const formattedTarget = setText(targetLoad, targetReps, lang, unit);

  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: isGoal ? p.accent : p.border,
        padding: space.md,
        gap: space.xs,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
          <AppText style={{ fontSize: 14 }}>🎯</AppText>
          <AppText style={{ fontSize: ty.label, fontWeight: "600", color: isGoal ? p.accent : p.text }}>
            {t("today.strategy.title")}
          </AppText>
        </View>
        {onWhy ? (
          <QuietAction
            icon="why"
            label={t("workout.whyShort")}
            accessibilityLabel={t("workout.help.button")}
            onPress={onWhy}
          />
        ) : null}
      </View>

      <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>
        {t("today.strategy.unlock", { target: formattedTarget })}
      </AppText>

      {lastTimeText ? (
        <AppText style={{ fontSize: ty.caption, color: p.text }}>
          {lastTimeText}
        </AppText>
      ) : null}

      {reasonText ? (
        <AppText style={{ fontSize: ty.caption, color: p.muted, lineHeight: 18 }}>
          {reasonText}
        </AppText>
      ) : null}
    </View>
  );
}
