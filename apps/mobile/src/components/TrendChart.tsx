import React from "react";
import { View } from "react-native";
import type { TrendPoint } from "@gain/engine";
import { chartBars, localDateText } from "../logic/trendChart";
import { space, type as ty, usePalette } from "../theme";
import { AppText } from "../ui";

const HEIGHT = 140;

/**
 * Plain bars (no chart library, so nothing heavy on low-end phones). Always drawn left-to-right, oldest first, in both
 * languages, because time on an axis does not flip with the text direction. Imported sessions are outlined, not filled.
 * The bars are a picture: `summary` is the spoken equivalent, and the screen lists the same points as text underneath.
 */
export function TrendChart({ points, assisted, summary, axisText }: { points: TrendPoint[]; assisted: boolean; summary?: string; axisText?: (from: string, to: string) => string }) {
  const p = usePalette();
  const bars = chartBars(points, assisted);
  if (bars.length === 0) return null;
  const first = bars[0]!.at;
  const last = bars[bars.length - 1]!.at;
  return (
    <View style={{ gap: space.xs }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        style={{ direction: "ltr", flexDirection: "row", alignItems: "flex-end", gap: 4, height: HEIGHT, paddingVertical: space.xs, borderBottomWidth: 1, borderColor: p.border }}
      >
        {bars.map((b, i) => (
          <View
            key={b.at}
            style={{
              flex: 1,
              height: Math.max(6, Math.round(b.frac * (HEIGHT - 8))),
              borderRadius: 4,
              borderWidth: 2,
              borderColor: p.accent,
              backgroundColor: b.imported ? "transparent" : i === bars.length - 1 ? p.fill : p.tint,
            }}
          />
        ))}
      </View>
      <AppText ltr style={{ color: p.muted, fontSize: ty.caption }}>
        {axisText ? axisText(localDateText(first), localDateText(last)) : `${localDateText(first)} – ${localDateText(last)}`}
      </AppText>
    </View>
  );
}
