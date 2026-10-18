import React from "react";
import { View } from "react-native";
import { useI18n } from "../../i18n";
import { space, type as ty, usePalette } from "../../theme";
import { AppText, QuietAction } from "../../ui";

/**
 * The header: the date (13/18 600 muted), the day name as the screen's ONE title (28/34 600, header role), decorative page dots beside it,
 * then the label ("Suggested today") and Change (hidden with one day).
 */
export function TodayHeader({ date, dayName, label, dayIndex, dayCount, onChange, onStep, pagerName }: { date: string; dayName: string; label: string; dayIndex: number; dayCount: number; onChange: () => void; /** The day pager for screen readers: increment = next day. */ onStep?: (step: 1 | -1) => void; /** The day name the pager speaks (the title can say "Done for today"). */ pagerName?: string }) {
  const { t } = useI18n();
  const p = usePalette();
  return (
    <View style={{ gap: 2 }}>
      <AppText style={{ fontSize: ty.caption, lineHeight: 18, fontWeight: "600", color: p.muted }}>{date}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
        <AppText accessibilityRole="header" style={{ fontSize: ty.title, lineHeight: 34, fontWeight: "600", flexShrink: 1 }}>{dayName}</AppText>
        {dayCount > 1 ? (
          <View
            style={{ flexDirection: "row", gap: 4, paddingVertical: space.sm }}
            accessible={!!onStep}
            accessibilityRole="adjustable"
            accessibilityLabel={t("today.pager.a11y", { n: dayIndex + 1, total: dayCount, day: pagerName ?? dayName })}
            accessibilityActions={[{ name: "increment", label: t("today.pager.next") }, { name: "decrement", label: t("today.pager.prev") }]}
            onAccessibilityAction={(e) => onStep?.(e.nativeEvent.actionName === "increment" ? 1 : -1)}
          >
            {Array.from({ length: Math.min(dayCount, 7) }, (_, i) => (
              <View key={i} style={{ width: i === dayIndex ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === dayIndex ? p.text : p.edge }} />
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: space.sm }}>
        <AppText accessibilityLiveRegion="polite" style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, flexShrink: 1 }}>{label}</AppText>
        {dayCount > 1 ? <QuietAction label={t("today.change")} accessibilityLabel={t("today.changeLabel", { day: dayName })} onPress={onChange} /> : null}
      </View>
    </View>
  );
}
