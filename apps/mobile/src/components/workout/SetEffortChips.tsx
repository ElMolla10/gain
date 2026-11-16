import React from "react";
import { Pressable, View } from "react-native";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import { radius, space, type as ty, useLogPalette, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { haptics } from "../../haptics";

export interface SetEffortChipsProps {
  rir: number | null;
  trackEffort?: boolean;
  onSetRir: (rir: number) => void;
}

/** Optional effort shortcuts. Weight and reps are entered directly in the row's fields. */
export function SetEffortChips({ rir, trackEffort, onSetRir }: SetEffortChipsProps) {
  const { t } = useI18n();
  const lp = useLogPalette();
  const p = usePalette();
  if (!trackEffort) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs }}>
    <AppText style={{ fontSize: ty.caption, color: lp.muted, marginEnd: space.xs }}>
      {t("workout.rir.label")}
    </AppText>
    {([0, 1, 2, 3] as const).map((r) => {
      const isSelected = rir === r || (r === 3 && rir !== null && rir >= 3);
      return (
        <Pressable
          key={r}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={`RIR ${r === 3 ? "3+" : r}`}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          onPress={() => {
            haptics.selection();
            onSetRir(r);
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 32,
            borderRadius: radius.button,
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? p.accent : lp.edge,
            backgroundColor: isSelected ? p.tint : pressed ? lp.line : lp.field,
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <AppText
            ltr
            style={{
              fontSize: ty.caption,
              fontWeight: isSelected ? "700" : "500",
              color: isSelected ? p.accent : lp.text,
            }}
          >
            {isolateLtr(r === 3 ? "3+" : String(r))}
          </AppText>
        </Pressable>
      );
    })}
  </View>
  );
}
