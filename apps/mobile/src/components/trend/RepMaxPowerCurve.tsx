import React from "react";
import { View } from "react-native";
import { useI18n } from "../../i18n";
import { formatLoad, isolateLtr } from "../../i18n/format";
import { e1rmText } from "../../logic/loadText";
import type { Unit } from "../../logic/units";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";

export interface RepMaxItem {
  reps: number;
  set: {
    load: number;
    reps: number;
    at: number;
  };
}

export interface RepMaxPowerCurveProps {
  repMaxes: RepMaxItem[];
  unit: Unit;
}

/**
 * Calculates estimated 1RM using standard Brzycki formula.
 */
function calcE1rm(load: number, reps: number): number {
  if (reps <= 1) return load;
  return Math.round(load * (36 / (37 - Math.min(reps, 15))) * 10) / 10;
}

/**
 * The Rep Max Power Curve: visualizes the athlete's strength across all rep ranges
 * (1RM, 3RM, 5RM, 8RM, 10RM) and highlights untapped potential brackets.
 */
export function RepMaxPowerCurve({ repMaxes, unit }: RepMaxPowerCurveProps) {
  const { t, lang } = useI18n();
  const p = usePalette();

  if (!repMaxes || repMaxes.length === 0) return null;

  const maxRecordedLoad = Math.max(...repMaxes.map((r) => r.set.load), 1);

  // Find rep bracket with highest estimated 1RM (untapped opportunity)
  let bestE1rm = 0;
  let bestE1rmReps = 0;
  repMaxes.forEach((r) => {
    const e = calcE1rm(r.set.load, r.reps);
    if (e > bestE1rm) {
      bestE1rm = e;
      bestE1rmReps = r.reps;
    }
  });

  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: p.border,
        padding: space.md,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, letterSpacing: 0.5, textTransform: "uppercase" }}>
            {t("trend.powerCurve.title")}
          </AppText>
          <AppText style={{ fontSize: ty.body, fontWeight: "700", color: p.text }}>
            {t("trend.powerCurve.subtitle")}
          </AppText>
        </View>
        <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: p.tint }}>
          <AppText style={{ fontSize: ty.caption, fontWeight: "700", color: p.accent }}>
            {e1rmText(bestE1rm, lang, unit)} {t("trend.peakE1rm")}
          </AppText>
        </View>
      </View>

      {/* Rep Max Bars */}
      <View style={{ gap: space.xs, marginTop: space.xs }}>
        {repMaxes.slice(0, 6).map((item) => {
          const ratio = Math.min(1, Math.max(0.1, item.set.load / maxRecordedLoad));
          const e1rm = calcE1rm(item.set.load, item.reps);
          const isPeak = item.reps === bestE1rmReps;

          return (
            <View key={item.reps} style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: isPeak ? p.accent : p.text }}>
                  {t("trend.powerCurve.rm", { reps: isolateLtr(String(item.reps)), load: formatLoad(item.set.load, lang, unit) })}
                </AppText>
                <AppText style={{ fontSize: 13, color: p.muted }}>
                  {t("trend.calcE1rm", { load: e1rmText(e1rm, lang, unit) })}
                </AppText>
              </View>

              {/* Progress Rail */}
              <View style={{ height: 6, borderRadius: 3, backgroundColor: p.raised, overflow: "hidden" }}>
                <View
                  style={{
                    height: "100%",
                    width: `${Math.round(ratio * 100)}%`,
                    borderRadius: 3,
                    backgroundColor: isPeak ? p.accent : p.border,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Untapped Potential Callout */}
      <View style={{ marginTop: space.xs, padding: space.sm, borderRadius: radius.button, backgroundColor: p.raised }}>
        <AppText style={{ fontSize: ty.caption, color: p.muted, lineHeight: 18 }}>
          {t("trend.powerCurve.insight", {
            reps: isolateLtr(String(bestE1rmReps)),
            load: e1rmText(bestE1rm, lang, unit),
          })}
        </AppText>
      </View>
    </View>
  );
}
