import React from "react";
import { Alert, View } from "react-native";
import type { Decision } from "@gain/engine";
import { useI18n } from "../i18n";
import { formatLoad } from "../i18n/format";
import type { ReportedSymptom } from "../logic/liveAdaptation";
import { radius, space, useLogPalette } from "../theme";
import { AppText, BigButton, IconButton, QuietAction } from "../ui";

interface Props {
  decision: Decision;
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
  basis?: { load: number; reps: number };
  repMin: number;
  repMax: number;
  manualLoad: boolean;
  busy: boolean;
  onApply: () => void;
  onKeep: () => void;
  onReport: (symptom: ReportedSymptom) => void;
  whySentence?: string | null;
}

/** Presentation only: the logger owns persistence, staleness checks and acceptance. */
export function LiveSuggestion({ decision, detailsOpen = false, onToggleDetails, basis, repMin, repMax, manualLoad, busy, onKeep, onReport, whySentence }: Props) {
  const { t, lang, unit } = useI18n();
  const p = useLogPalette();
  return (
    <View accessibilityLiveRegion={decision.action === "stop" ? "assertive" : "polite"} style={{ marginHorizontal: space.md, marginVertical: space.sm, padding: space.md, gap: space.xs, borderRadius: radius.card, backgroundColor: p.card, borderWidth: 1, borderColor: decision.action === "stop" ? p.danger : p.line }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <AppText style={{ flex: 1, fontWeight: "600" }}>{t("live.title")}</AppText>
        <IconButton icon="alert" label={t("live.report")} onPress={() => Alert.alert(t("live.report"), undefined, [
          { text: t("live.severePain"), onPress: () => onReport("severe_pain") },
          { text: t("live.dizziness"), onPress: () => onReport("dizziness") },
          { text: t("common.cancel"), style: "cancel" },
        ])} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
        <AppText style={{ fontWeight: "600" }}>{t(`live.${decision.action}` as never)}</AppText>
        {decision.action !== "stop" ? <AppText ltr style={{ fontWeight: "700", color: p.accent }}>{t("live.prescription", { load: formatLoad(decision.suggestedWeightKg, lang, unit), reps: decision.suggestedReps })}</AppText> : null}
      </View>
      {decision.action === "stop" ? <AppText>{t(`live.reason.${decision.reason}` as never)}</AppText> : <>
        {whySentence ? <AppText style={{ color: p.muted }}>{whySentence}</AppText> : basis ? <AppText style={{ color: p.muted }}>{t("live.afterSet", { load: formatLoad(basis.load, lang, unit), reps: basis.reps })}</AppText> : null}
        <AppText style={{ color: p.muted }}>{t("live.shortNote")}</AppText>
      </>}
      {detailsOpen ? <View style={{ gap: space.xs }}>
        {decision.reason !== "reported_symptoms" && decision.predictionAvailable !== false ? <AppText>{t("live.predicted", { reps: Math.round(decision.predictedReps * 10) / 10, min: repMin, max: repMax })}</AppText> : null}
        {decision.action !== "stop" ? <AppText style={{ color: p.muted }}>{t(`live.reason.${decision.reason}` as never)}</AppText> : null}
        {decision.reason !== "reported_symptoms" && decision.predictionAvailable !== false ? <AppText style={{ color: p.muted }}>{t("live.estimateNote")}</AppText> : null}
      </View> : null}
      <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap", alignItems: "center" }}>
        {decision.action === "stop" ? <BigButton variant="quiet" label={t("live.dismiss")} disabled={busy} onPress={onKeep} /> : null}
        <QuietAction label={detailsOpen ? t("live.less") : t("live.details")} expanded={detailsOpen} onPress={onToggleDetails ?? (() => undefined)} />
      </View>
      {decision.action !== "stop" && manualLoad ? <AppText style={{ color: p.muted }}>{t("live.manual")}</AppText> : null}
    </View>
  );
}
