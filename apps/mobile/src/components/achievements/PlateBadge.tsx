import React, { useId } from "react";
import { View } from "react-native";
import { plateProgress, plateTier } from "../../logic/achievementShowcase";
import { useAchievementArt, useIsDark, usePalette } from "../../theme";
import { Icon } from "../Icon";
import { PlateArt } from "./LifetimePlate";

/** Matches the compact Cabinet header badge. */
export const PLATE_BADGE_SIZE = 36;

/**
 * A mini bumper plate in the current Lifetime Plate tier (always an earned colour), used as the Cabinet
 * header mark. Decorative: the summary line already speaks the day count. With no training days yet, this
 * falls back to the Cabinet tab's trophy icon in the accent colour — never a dotted locked shape.
 */
export function PlateBadge({ days, size = PLATE_BADGE_SIZE }: { days: number | null; size?: number }) {
  const p = usePalette();
  const art = useAchievementArt();
  const dark = useIsDark();
  const uid = useId().replace(/[^A-Za-z0-9]/g, "");
  if (!days) {
    return (
      <View accessible={false} importantForAccessibility="no" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Icon name="trophy" color={p.accent} size={24} />
      </View>
    );
  }
  return (
    <View accessible={false} importantForAccessibility="no" style={{ width: size, height: size }}>
      <PlateArt size={size} uid={uid} empty={false} tier={plateTier(days)} progress={plateProgress(days)} mono={false} art={art} dark={dark} />
    </View>
  );
}
