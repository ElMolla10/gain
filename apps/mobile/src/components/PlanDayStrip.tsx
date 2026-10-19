import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { haptics } from "../haptics";
import { useI18n } from "../i18n";
import { MIN_TOUCH, radius, space, type as ty, usePalette } from "../theme";
import { AppText } from "../ui";

export interface PlanDayItem {
  name: string;
  exerciseCount: number;
  setsCount: number;
}

export function PlanDayStrip({
  days,
  selectedIndex,
  onSelect,
}: {
  days: PlanDayItem[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const { t } = useI18n();
  const p = usePalette();
  if (days.length === 0) return null;

  return (
    <View style={{ gap: space.xs }}>
      <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, letterSpacing: 0.4 }}>
        {t("prog.dayStrip.title")}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.xs, paddingVertical: 2 }}
      >
        {days.map((day, i) => {
          const selected = selectedIndex === i;
          return (
            <Pressable
              key={i}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={day.name}
              onPress={() => {
                haptics.selection();
                onSelect(i);
              }}
              style={{
                minHeight: MIN_TOUCH,
                minWidth: 80,
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                borderRadius: radius.card,
                backgroundColor: selected ? p.tint : p.raised,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? p.accent : p.edge,
                justifyContent: "center",
                alignItems: "center",
                gap: 2,
              }}
            >
              <AppText
                style={{
                  fontSize: ty.label,
                  fontWeight: selected ? "600" : "500",
                  color: selected ? p.accent : p.text,
                }}
              >
                {day.name}
              </AppText>
              <AppText
                style={{
                  fontSize: ty.caption,
                  color: p.muted,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {`\u2066${day.setsCount}\u2069 ${t("finish.countedLine", { n: day.setsCount }).split(" ")[1] ?? ""}`}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
