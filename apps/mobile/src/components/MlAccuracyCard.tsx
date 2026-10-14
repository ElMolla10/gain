import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { formatMlNumber, LIVE_MODEL_VERSION } from "../logic/mlEvaluation";
import type { EvaluationReport } from "../logic/mlEvaluationReport";
import { AppText, BigButton, InlineStatus } from "../ui";
import { Block } from "./SettingsRows";

export function MlAccuracyCard() {
  const { mlEvaluation } = useServices();
  const { t, lang } = useI18n();
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setReport(null);
    setFailed(false);
    void mlEvaluation.report(LIVE_MODEL_VERSION).then(value => { if (active) setReport(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [mlEvaluation]));
  const number = (n: number, decimals = 0) => formatMlNumber(n, lang, decimals);
  async function exportReport() {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      if (!(await Sharing.isAvailableAsync())) { setExportError(t("data.noSharing")); return; }
      const snapshot = await mlEvaluation.report(LIVE_MODEL_VERSION);
      const file = new File(Paths.cache, "gain-ml-evaluation.json");
      file.create({ overwrite: true });
      file.write(JSON.stringify(snapshot, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: t("ml.export") });
    } catch {
      setExportError(t("ml.exportFailed"));
    } finally { setExporting(false); }
  }
  return <Block title={t("ml.title")} note={t("ml.note")}>
    {failed ? <InlineStatus kind="error" text={t("ml.failed")} /> : report ? <>
      <AppText>{t("ml.count", { n: number(report.model.count) })}</AppText>
      {report.model.count === 0 ? <AppText>{t("ml.empty")}</AppText> : <>
        <AppText>{t("ml.mae", { n: number(report.model.meanAbsoluteError!, 2) })}</AppText>
        <AppText>{t("ml.one", { n: number(report.model.withinOnePercent!, 1) })}</AppText>
        <AppText>{t("ml.two", { n: number(report.model.withinTwoPercent!, 1) })}</AppText>
        {(["repeatPrevious", "loadAdjusted"] as const).map(kind => {
          const paired = report.comparisons[kind];
          return paired.model.count ? <AppText key={kind}>{t(`ml.baseline.${kind}`, {
            n: number(paired.model.count), ai: number(paired.model.meanAbsoluteError!, 2), baseline: number(paired.baseline.meanAbsoluteError!, 2),
          })}</AppText> : null;
        })}
        <AppText>{t("ml.comparisonNote")}</AppText>
      </>}
      <AppText>{t("ml.coverage", { captured: number(report.coverage.captured), pending: number(report.coverage.pending), excluded: number(report.coverage.invalidated + report.coverage.excludedCurrentState) })}</AppText>
      <AppText>{t("ml.exportNote")}</AppText>
      <BigButton variant="quiet" label={t("ml.export")} disabled={exporting} onPress={() => void exportReport()} />
    </> : null}
    {exportError ? <InlineStatus kind="error" text={exportError} /> : null}
  </Block>;
}
