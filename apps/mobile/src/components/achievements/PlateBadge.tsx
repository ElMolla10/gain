import { COLLECTION_TIERS } from "@gain/engine";
import { MilestoneArt } from "./MilestoneArt";
import React from "react";
import { View } from "react-native";
import { usePalette } from "../../theme";
import { Icon } from "../Icon";

/** Matches the compact Cabinet header badge. */
export const PLATE_BADGE_SIZE = 36;

/**
 * A mini bumper plate in the current Lifetime Plate tier (always an earned colour), used as the Cabinet
 * header mark. Decorative: the summary line already speaks the day count. With no training days yet, this
 * falls back to the Cabinet tab's trophy icon in the accent colour — never a dotted locked shape.
 */
export function PlateBadge({ days, size = PLATE_BADGE_SIZE }: { days: number | null; size?: number }) {
  const p = usePalette();
  if (days == null || days < 10) {
    return (
      <View accessible={false} importantForAccessibility="no" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Icon name="trophy" color={p.accent} size={24} />
      </View>
    );
  }
  return (
    <View accessible={false} importantForAccessibility="no" style={{ width: size, height: size }}>
      <MilestoneArt size={size} badgeId={`lifetime_plate_${[...COLLECTION_TIERS.lifetime_plate].reverse().find(t => days >= t)}`} />
    </View>
  );
}
