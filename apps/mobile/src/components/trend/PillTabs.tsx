import React from "react";
import { Pressable, View } from "react-native";
import { MIN_TOUCH, radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";

/**
 * A rounded track with a lime pill on the selected option (the exercise screen's tabs and the chart range). Tabs semantics, 48 dp
 * touch height; follows the layout direction like any row.
 */
export function PillTabs<T extends string>({ value, options, onChange, compact }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; compact?: boolean }) {
  const p = usePalette();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", alignSelf: compact ? "center" : "stretch", minWidth: compact ? 240 : undefined, backgroundColor: p.raised, borderRadius: radius.pill, padding: space.xs }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            hitSlop={compact ? { top: 6, bottom: 6 } : undefined}
            style={{ flex: 1, minHeight: compact ? 36 : MIN_TOUCH - space.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: on ? p.fill : "transparent" }}
          >
            <AppText numberOfLines={1} style={{ fontSize: ty.label, fontWeight: "600", textAlign: "center", color: on ? p.onFill : p.muted }}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
