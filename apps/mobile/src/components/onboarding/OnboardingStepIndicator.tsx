import React from "react";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../i18n";
import { progressColors } from "../../logic/stateColors";
import { space, useIsDark, usePalette } from "../../theme";
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
  const bar = progressColors(p, !useIsDark());
  const progressPct = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${stepName}. ${t("ob.progress", { i: currentStep, n: totalSteps })}`} accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }} style={styles.container}>
      <View style={styles.topRow}>
        <AppText style={[styles.kicker, { color: p.muted }]}>
          {t("ob.step.progress", {
            current: currentStep,
            total: totalSteps,
          })}
        </AppText>
        <View style={[styles.stepBadge, { backgroundColor: p.card, borderColor: p.border }]}>
          <AppText style={[styles.stepName, { color: p.text }]}>{stepName}</AppText>
        </View>
      </View>

      {/* Progress Track */}
      <View style={[styles.track, { height: bar.height }]}>
        <View style={{ position: "absolute", top: 0, bottom: 0, start: 0, end: 0, backgroundColor: bar.inactive, opacity: bar.inactiveOpacity }} />
        <View
          style={[
            styles.fill,
            {
              width: `${progressPct}%`,
              backgroundColor: bar.active,
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
    flexWrap: "wrap",
    gap: space.sm,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    flexShrink: 1,
    textTransform: "uppercase",
  },
  stepBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 1,
    minWidth: 0,
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
