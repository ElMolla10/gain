import React from "react";
import { View } from "react-native";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import type { Unit } from "../../logic/units";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";

export interface StrengthTierRadarProps {
  currentE1rm: number;
  bodyweightKg: number | null;
  unit: Unit;
}

const TIERS = [
  { id: "novice", maxRatio: 0.9, labelKey: "goals.tier.novice" as const },
  { id: "intermediate", maxRatio: 1.2, labelKey: "goals.tier.intermediate" as const },
  { id: "proficient", maxRatio: 1.45, labelKey: "goals.tier.proficient" as const },
  { id: "advanced", maxRatio: 1.8, labelKey: "goals.tier.advanced" as const },
  { id: "elite", maxRatio: 99.0, labelKey: "goals.tier.elite" as const },
];

/**
 * Biomechanical Relative Strength Radar: compares current 1RM against
 * athlete bodyweight and maps to standardized athletic strength tiers.
 */
export function StrengthTierRadar({
  currentE1rm,
  bodyweightKg,
  unit,
}: StrengthTierRadarProps) {
  const { t, unitText } = useI18n();
  const p = usePalette();

  if (!bodyweightKg || bodyweightKg <= 0) return null;

  const ratio = Math.round((currentE1rm / bodyweightKg) * 100) / 100;
  const activeTierIndex = TIERS.findIndex((tier) => ratio <= tier.maxRatio);
  const currentTier = TIERS[activeTierIndex === -1 ? TIERS.length - 1 : activeTierIndex]!;

  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: p.border,
        padding: space.md,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, letterSpacing: 0.5, textTransform: "uppercase" }}>
            {t("goals.strengthTier.title")}
          </AppText>
          <AppText style={{ fontSize: ty.body, fontWeight: "700", color: p.text }}>
            {t(currentTier.labelKey)} · {isolateLtr(`${ratio}×`)} {t("goals.bodyweightRatio")}
          </AppText>
        </View>

        <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: p.raised }}>
          <AppText style={{ fontSize: ty.caption, color: p.muted }}>
            {isolateLtr(`${bodyweightKg} ${unitText}`)} {t("goals.bw")}
          </AppText>
        </View>
      </View>

      {/* Segmented Tier Track */}
      <View style={{ flexDirection: "row", gap: 3, height: 8, borderRadius: 4, overflow: "hidden" }}>
        {TIERS.map((tier, idx) => {
          const isReached = idx <= activeTierIndex;
          const isCurrent = idx === activeTierIndex;
          return (
            <View
              key={tier.id}
              style={{
                flex: 1,
                backgroundColor: isCurrent ? p.accent : isReached ? p.tint : p.border,
                borderRadius: 2,
              }}
            />
          );
        })}
      </View>

      {/* Tier Labels Row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText style={{ fontSize: 11, color: p.muted }}>{t("goals.tier.novice")}</AppText>
        <AppText style={{ fontSize: 11, color: p.muted }}>{t("goals.tier.intermediate")}</AppText>
        <AppText style={{ fontSize: 11, color: p.muted }}>{t("goals.tier.proficient")}</AppText>
        <AppText style={{ fontSize: 11, color: p.muted }}>{t("goals.tier.advanced")}</AppText>
        <AppText style={{ fontSize: 11, color: p.muted }}>{t("goals.tier.elite")}</AppText>
      </View>
    </View>
  );
}
