import React from "react";
import { View } from "react-native";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import { repsLabel, wholeInUnit, type RepMaxRow } from "../../logic/progressionSummary";
import { weightText } from "../../logic/units";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";

/**
 * Rep Max tab: the best estimated 1RM as the hero (with the set it came from), then one row per rep count, sorted 1 → 15, each
 * with its heaviest load, a whole-number e1RM and a bar against the best. The best row is tinted and carries a "Best" chip.
 */
export function RepMaxTable({ rows }: { rows: RepMaxRow[] }) {
  const { t, lang, unit, unitText } = useI18n();
  const p = usePalette();
  if (rows.length === 0) return <AppText style={{ color: p.muted }}>{t("trend.repmax.empty")}</AppText>;
  const best = rows.find((r) => r.best) ?? rows[0]!;
  const load = (kg: number) => `${isolateLtr(weightText(kg, unit))}\u00A0${unitText}`;
  const whole = (kg: number) => `${isolateLtr(String(wholeInUnit(kg, unit)))}\u00A0${unitText}`;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, letterSpacing: lang === "ar" ? 0 : 1.2, textTransform: "uppercase" }}>{t("trend.repmax.best")}</AppText>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.xs }}>
          <AppText style={{ fontSize: ty.display, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{isolateLtr(String(wholeInUnit(best.e1rm, unit)))}</AppText>
          <AppText style={{ fontSize: ty.section, color: p.muted }}>{unitText}</AppText>
        </View>
        <AppText style={{ color: p.muted }}>{t("trend.repmax.from", { set: `${load(best.load)} × ${isolateLtr(String(best.reps))}` })}</AppText>
      </View>
      <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <View
            key={r.reps}
            accessible
            accessibilityLabel={`${repsLabel(r.reps, lang, t)}, ${load(r.load)}, ${t("trend.repmax.approx", { load: whole(r.e1rm) })}${r.best ? `, ${t("trend.repmax.bestChip")}` : ""}`}
            style={{ paddingHorizontal: space.md, paddingVertical: space.md, gap: space.sm, backgroundColor: r.best ? p.tint : "transparent", borderTopWidth: i === 0 ? 0 : 1, borderColor: p.border }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <AppText numberOfLines={1} style={{ minWidth: 68, color: p.muted }}>{repsLabel(r.reps, lang, t)}</AppText>
              <AppText style={{ fontWeight: "700", fontVariant: ["tabular-nums"] }}>{load(r.load)}</AppText>
              {r.best ? (
                <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: p.fill }}>
                  <AppText style={{ fontSize: ty.caption, fontWeight: "700", color: p.onFill }}>{t("trend.repmax.bestChip")}</AppText>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              <AppText numberOfLines={1} style={{ flexShrink: 1, fontSize: ty.label, color: p.muted, fontVariant: ["tabular-nums"] }}>{t("trend.repmax.approx", { load: whole(r.e1rm) })}</AppText>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: p.raised, overflow: "hidden" }}>
              <View style={{ height: 4, width: `${Math.round(Math.max(0.05, r.share) * 100)}%`, borderRadius: 2, backgroundColor: p.accent, opacity: r.best ? 1 : 0.45 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
