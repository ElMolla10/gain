import React from "react";
import { Pressable, View } from "react-native";
import type { GymLoadSpec, LoggedSet, Measure, SetupType } from "@gain/engine";
import { personalMilestone, type MilestoneSession } from "../logic/personalProgress";
import { targetPhrase } from "../logic/quantity";
import { useI18n } from "../i18n";
import { formatLoad } from "../i18n/format";
import { AppText } from "../ui";
import { space, useLogPalette } from "../theme";
export function PersonalMilestoneLine({ onOpen, history, today, spec, measure, repMin, repMax, setup }: { onOpen: () => void; history: MilestoneSession[]; today: LoggedSet[]; spec: GymLoadSpec | null; measure: Measure; repMin: number; repMax: number; setup: SetupType }) {
  const { t, lang, unit } = useI18n(); const p = useLogPalette();
  const m = setup === "assisted" ? null : personalMilestone(history, today, spec, measure, repMin, repMax);
  if (!m) return null;
  const target = targetPhrase(m.load, m.quantity, measure, kg => formatLoad(kg, lang, unit), { s: t("qty.s"), m: t("qty.m") });
  return <View style={{ gap: space.xs, paddingBottom: space.sm }}>
    <Pressable accessibilityRole="button" accessibilityHint={t("progress.openHint")}
      onPress={onOpen} style={{ minHeight: 48, justifyContent: "center" }}>
      <AppText style={{ color: p.accent, fontSize: 13 }}>{t("progress.milestone", { target })}{m.reached ? ` · ${t("progress.reached")}` : ""}  ›</AppText>
    </Pressable>
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t("progress.milestone", { target })} accessibilityValue={{ min: 0, max: 100, now: Math.round(m.progress * 100) }} style={{ height: 4, borderRadius: 2, backgroundColor: p.line, overflow: "hidden" }}>
      <View style={{ height: 4, width: `${m.progress * 100}%`, backgroundColor: p.accent }} />
    </View>
  </View>;
}
