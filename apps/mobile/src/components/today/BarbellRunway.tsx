import React from "react";
import { Pressable, View } from "react-native";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import type { HeroWarmupStep } from "../../logic/todayHero";
import type { Unit } from "../../logic/units";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";

export interface BarbellRunwayProps {
  warmups: readonly HeroWarmupStep[];
  topLoad: number;
  topReps: number;
  unit: Unit;
  selectedStepIndex: number; // -1 = top work set, 0..n = warmup steps
  onSelectStep: (index: number) => void;
}

/**
 * Interactive warmup-to-workload progression runway. Tapping any node
 * updates the Hero Barbell visual to reflect that exact stage's plate configuration.
 */
export function BarbellRunway({
  warmups,
  topLoad,
  topReps,
  unit,
  selectedStepIndex,
  onSelectStep,
}: BarbellRunwayProps) {
  const { t, unitText } = useI18n();
  const p = usePalette();

  if (!warmups || warmups.length === 0) return null;

  return (
    <View style={{ gap: space.xs, marginTop: space.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, letterSpacing: 0.5 }}>
          {t("today.runway.title")}
        </AppText>
        <AppText style={{ fontSize: ty.caption, color: p.muted }}>
          {selectedStepIndex === -1 ? t("today.runway.top") : t("today.runway.warmup")}
        </AppText>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, paddingVertical: 2 }}>
        {warmups.map((step, idx) => {
          const isSelected = selectedStepIndex === idx;
          const repsText = isolateLtr(String(step.reps));
          const stepText = step.load === 20
            ? `${t("today.emptyBar")} × ${repsText}`
            : `${isolateLtr(String(step.load))} ${unitText} × ${repsText}`;
          return (
            <Pressable
              key={`warmup-${idx}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${t("today.runway.warmup")} ${idx + 1}: ${step.load} ${unitText} × ${step.reps}`}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              onPress={() => {
                onSelectStep(idx);
              }}
              style={({ pressed }) => ({
                minHeight: 36,
                paddingHorizontal: space.sm,
                paddingVertical: 4,
                borderRadius: radius.button,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? p.accent : p.border,
                backgroundColor: isSelected ? p.tint : pressed ? p.raised : p.card,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <AppText
                style={{
                  fontSize: ty.caption,
                  fontWeight: isSelected ? "700" : "500",
                  color: isSelected ? p.accent : p.text,
                }}
              >
                {stepText}
              </AppText>
            </Pressable>
          );
        })}

        {/* Top Work Set Node */}
        <Pressable
          key="top-work-set"
          accessibilityRole="button"
          accessibilityState={{ selected: selectedStepIndex === -1 }}
          accessibilityLabel={`${t("today.runway.top")}: ${topLoad} ${unitText} × ${topReps}`}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          onPress={() => {
            onSelectStep(-1);
          }}
          style={({ pressed }) => ({
            minHeight: 36,
            paddingHorizontal: space.sm,
            paddingVertical: 4,
            borderRadius: radius.button,
            borderWidth: selectedStepIndex === -1 ? 2 : 1,
            borderColor: selectedStepIndex === -1 ? p.accent : p.border,
            backgroundColor: selectedStepIndex === -1 ? p.tint : pressed ? p.raised : p.card,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          })}
        >
          <AppText style={{ fontSize: 12 }}>⭐</AppText>
          <AppText
            style={{
              fontSize: ty.caption,
              fontWeight: selectedStepIndex === -1 ? "700" : "600",
              color: selectedStepIndex === -1 ? p.accent : p.text,
            }}
          >
            {`${isolateLtr(String(topLoad))} ${unitText} × ${isolateLtr(String(topReps))}`}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
