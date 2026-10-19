import React from "react";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import { space, usePalette } from "../../theme";
import { AppText } from "../../ui";

interface OnboardingStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepName: string;
}

export function OnboardingStepIndicator({
  currentStep,
  totalSteps,
  stepName,
}: OnboardingStepIndicatorProps) {
  const { t } = useI18n();
  const p = usePalette();
  const progressPct = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <AppText style={[styles.kicker, { color: p.muted }]} accessibilityRole="header">
          {t("ob.step.progress", {
            current: isolateLtr(String(currentStep)),
            total: isolateLtr(String(totalSteps)),
          })}
        </AppText>
        <View style={[styles.stepBadge, { backgroundColor: p.card, borderColor: p.border }]}>
          <AppText style={[styles.stepName, { color: p.text }]}>{stepName}</AppText>
        </View>
      </View>

      {/* Progress Track */}
      <View style={[styles.track, { backgroundColor: p.border }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${progressPct}%`,
              backgroundColor: p.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xs,
    paddingBottom: space.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  stepBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  stepName: {
    fontSize: 13,
    fontWeight: "700",
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
});
