import React from "react";
import { View } from "react-native";
import type { TrendPoint } from "@gain/engine";
import { chartBars } from "../logic/trendChart";
import { space, usePalette } from "../theme";

const HEIGHT = 140;

/**
 * Plain bars (no chart library, so nothing heavy on low-end phones). Always drawn left-to-right, oldest first, in both
 * languages, because time on an axis does not flip with the text direction. Imported sessions are outlined, not filled.
 */
export function TrendChart({ points, assisted }: { points: TrendPoint[]; assisted: boolean }) {
  const p = usePalette();
  const bars = chartBars(points, assisted);
  if (bars.length === 0) return null;
  return (
    <View
      accessible
      accessibilityRole="image"
      style={{ direction: "ltr", flexDirection: "row", alignItems: "flex-end", gap: 3, height: HEIGHT, paddingVertical: space.xs }}
    >
      {bars.map((b) => (
        <View
          key={b.at}
          style={{
            flex: 1,
            height: Math.max(4, Math.round(b.frac * (HEIGHT - 8))),
            borderRadius: 3,
            borderWidth: 2,
            borderColor: p.accent,
            backgroundColor: b.imported ? "transparent" : p.accent,
          }}
        />
      ))}
    </View>
  );
}
