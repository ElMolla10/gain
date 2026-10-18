import React from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { LARGE_TEXT } from "./LifetimePlate";

export interface StatTileProps {
  value: string;
  label: string;
  onPress?: () => void;
  /** Where the tile leads (screen readers). */
  hint?: string;
}

/** Minimum tile height (dp): a 48 dp target with room for a two-line label. */
export const STAT_TILE_MIN = 64;

/** One stat: the value (tabular, 20/26) over its label. A button only when it leads somewhere. */
export function StatTile({ value, label, onPress, hint }: StatTileProps) {
  const p = usePalette();
  const body = (
    <>
      <AppText style={{ fontSize: ty.section, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{value}</AppText>
      <AppText style={{ fontSize: ty.caption, color: p.muted }}>{label}</AppText>
    </>
  );
  const style = { flex: 1, minHeight: STAT_TILE_MIN, padding: space.md, gap: space.xs, borderRadius: radius.button, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, justifyContent: "center" as const };
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${value} ${label}`} style={style}>
        {body}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${value} ${label}`} accessibilityHint={hint} onPress={onPress} style={({ pressed }) => [style, pressed ? { backgroundColor: p.raised } : null]}>
      {body}
    </Pressable>
  );
}

/** Qualified weeks · Verified PRs · Medals. Three across, flowing from the start edge; one column above fontScale 1.3 (spec §2, §8). */
export function StatTileRow({ tiles }: { tiles: StatTileProps[] }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > LARGE_TEXT;
  return (
    <View style={{ flexDirection: stacked ? "column" : "row", gap: space.sm }}>
      {tiles.map((tile) => (
        <StatTile key={tile.label} {...tile} />
      ))}
    </View>
  );
}
