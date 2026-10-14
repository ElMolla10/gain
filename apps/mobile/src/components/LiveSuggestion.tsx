import React from "react";
import { Alert, View } from "react-native";
import type { Decision } from "@gain/engine";
import { useI18n } from "../i18n";
import { formatLoad } from "../i18n/format";
import type { ReportedSymptom } from "../logic/liveAdaptation";
import { radius, space, useLogPalette } from "../theme";
import { AppText, BigButton } from "../ui";

interface Props {
  decision: Decision;
  repMin: number;
  repMax: number;
  manualLoad: boolean;
  busy: boolean;
  onApply: () => void;
  onKeep: () => void;
  onReport: (symptom: ReportedSymptom) => void;
}

/** Presentation only: the logger owns persistence, staleness checks and acceptance. */
export function LiveSuggestion({ decision, repMin, repMax, manualLoad, busy, onApply, onKeep, onReport }: Props) {
  const { t, lang, unit } = useI18n();
  const p = useLogPalette();
  return (
    <View accessibilityLiveRegion="polite" style={{ marginHorizontal: space.md, marginVertical: space.sm, padding: space.md, gap: space.xs, borderRadius: radius.card, backgroundColor: p.card, borderWidth: 1, borderColor: p.line }}>
      <AppText style={{ fontWeight: "600" }}>{t("live.title")}</AppText>
      <AppText style={{ fontWeight: "600" }}>{t(`live.${decision.action}` as never)}</AppText>
      {decision.reason !== "reported_symptoms" ? <AppText>{t("live.predicted", { reps: Math.round(decision.predictedReps * 10) / 10, min: repMin, max: repMax })}</AppText> : null}
      <AppText style={{ color: p.muted }}>{t(`live.reason.${decision.reason}` as never)}</AppText>
      {decision.action !== "stop" ? <AppText ltr>{formatLoad(decision.suggestedWeightKg, lang, unit)}</AppText> : null}
      <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
        {decision.action !== "stop" ? <BigButton variant="secondary" label={t("live.apply")} disabled={manualLoad || busy} onPress={onApply} /> : null}
        <BigButton variant="quiet" label={t("live.report")} onPress={() => Alert.alert(t("live.report"), undefined, [
          { text: t("live.severePain"), onPress: () => onReport("severe_pain") },
          { text: t("live.dizziness"), onPress: () => onReport("dizziness") },
          { text: t("common.cancel"), style: "cancel" },
        ])} />
        <BigButton variant="quiet" label={t("live.keep")} onPress={onKeep} />
      </View>
      {decision.action !== "stop" && manualLoad ? <AppText style={{ color: p.muted }}>{t("live.manual")}</AppText> : null}
    </View>
  );
}
