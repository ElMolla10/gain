import React from "react";
import { View } from "react-native";
import type { TrendPoint } from "@gain/engine";
import { useI18n } from "../i18n";
import { formatDay } from "../logic/dateText";
import { chartBars } from "../logic/trendChart";
import { space, type as ty, usePalette } from "../theme";
import { AppText } from "../ui";

const HEIGHT = 140;
/** Room above the tallest bar for its value label (13/18). */
const LABEL = 18;

/**
 * Plain bars (no chart library, so nothing heavy on low-end phones). Always drawn left-to-right, oldest first, in both
 * languages, because time on an axis does not flip with the text direction. Logged sessions are solid (the latest at full strength,
 * the rest at 55%); imported sessions are a dashed outline with no fill, so the two differ without colour (H-5). The best and the
 * latest bar carry their value.
 * The bars are a picture: `summary` is the spoken equivalent, and the screen lists the same points as text underneath.
 */
export function TrendChart({ points, assisted, summary, axisText, valueText }: { points: TrendPoint[]; assisted: boolean; summary?: string; axisText?: (from: string, to: string) => string; /** Value label above the best and the latest bar (isolated by the caller). */ valueText?: (value: number, byQuantity: boolean) => string }) {
  const p = usePalette();
  const { lang } = useI18n();
  const day = (ms: number) => formatDay(ms, lang, Date.now(), true); // short (no weekday): the axis caption is tight
  const bars = chartBars(points, assisted);
  if (bars.length === 0) return null;
  const first = bars[0]!.at;
  const last = bars[bars.length - 1]!.at;
  const lastIndex = bars.length - 1;
  // The best bar = the tallest one (for assisted lines the least assistance); the first one wins a tie.
  const bestIndex = bars.reduce((best, b, i) => (b.frac > bars[best]!.frac ? i : best), 0);
  return (
    <View style={{ gap: space.xs }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        style={{ direction: "ltr", flexDirection: "row", alignItems: "flex-end", gap: 4, height: HEIGHT, paddingVertical: space.xs, borderBottomWidth: 1, borderColor: p.border }}
      >
        {bars.map((b, i) => {
          const labelled = valueText && (i === lastIndex || i === bestIndex);
          return (
            <View key={b.at} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              {labelled ? (
                <AppText numberOfLines={1} style={{ fontSize: ty.caption, lineHeight: LABEL, fontVariant: ["tabular-nums"], color: p.text, minWidth: 40, textAlign: "center" }}>
                  {valueText(b.value, b.byQuantity)}
                </AppText>
              ) : null}
              <View
                style={{
                  alignSelf: "stretch",
                  height: Math.max(6, Math.round(b.frac * (HEIGHT - 8 - LABEL))),
                  borderRadius: 4,
                  ...(b.imported
                    ? { borderWidth: 2, borderStyle: "dashed" as const, borderColor: p.accent, backgroundColor: "transparent" }
                    : { backgroundColor: p.accent, opacity: i === lastIndex ? 1 : 0.55 }),
                }}
              />
            </View>
          );
        })}
      </View>
      <AppText style={{ color: p.muted, fontSize: ty.caption }}>
        {axisText ? axisText(day(first), day(last)) : `${day(first)} – ${day(last)}`}
      </AppText>
    </View>
  );
}
