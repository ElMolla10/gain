import React from "react";
import { View } from "react-native";
import type { LoggedSet, Measure } from "@gain/engine";
import { personalMilestone } from "../logic/personalProgress";
import { targetPhrase } from "../logic/quantity";
import { useI18n } from "../i18n";
import { formatLoad } from "../i18n/format";
import { AppText } from "../ui";
import { space, useLogPalette } from "../theme";
export function PersonalMilestoneLine({ history, today, load, measure }: { history: LoggedSet[]; today: LoggedSet[]; load: number | null; measure: Measure }) {
  const { t, lang, unit } = useI18n(); const p = useLogPalette();
  const m = personalMilestone(history, today, load, measure);
  if (!m) return null;
  const target = targetPhrase(m.load, m.quantity, measure, kg => formatLoad(kg, lang, unit), { s: t("qty.s"), m: t("qty.m") });
  return <View style={{ gap: space.xs, paddingBottom: space.sm }}>
    <AppText style={{ color: p.accent, fontSize: 13 }}>{m.reached ? t("progress.reached") : t("progress.milestone", { target })}</AppText>
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t("progress.milestone", { target })} accessibilityValue={{ min: 0, max: 100, now: Math.round(m.progress * 100) }} style={{ height: 4, borderRadius: 2, backgroundColor: p.line, overflow: "hidden" }}>
      <View style={{ height: 4, width: `${m.progress * 100}%`, backgroundColor: p.accent }} />
    </View>
    <AppText style={{ fontSize: 13, color: p.muted }}>{t("progress.optional")}</AppText>
  </View>;
}
