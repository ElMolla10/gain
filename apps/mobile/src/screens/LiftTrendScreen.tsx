import { useFocusEffect, useRoute } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ScrollView } from "react-native";
import type { LiftTrend } from "@gain/engine";
import { useServices } from "../AppContext";
import type { LiftItem } from "../db/historyRepo";
import { TrendChart } from "../components/TrendChart";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import { directionKey, localDateText } from "../logic/trendChart";
import { kgToUnit } from "../logic/units";
import { space, usePalette } from "../theme";
import { AppText, Card } from "../ui";

/** One trend per lift: the top set of each workout, drawn as bars, with plain words for the direction. */
export function LiftTrendScreen() {
  const { history } = useServices();
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = usePalette();
  const lineId = (useRoute().params as { lineId: string }).lineId;
  const [data, setData] = useState<{ lift: LiftItem; trend: LiftTrend } | null | "none">(null);

  useFocusEffect(
    useCallback(() => {
      history.getLiftTrend(lineId).then((r) => setData(r ?? "none"));
    }, [history, lineId]),
  );

  if (data === null) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  if (data === "none") return <AppText style={{ padding: space.lg }}>{t("trend.noPoints")}</AppText>;
  const { lift, trend } = data;
  const assisted = lift.setup === "assisted";
  const setText = (pt: { load: number; reps: number }) => `${fmt(pt.load)} × ${isolateLtr(String(pt.reps))}`;
  const recent = [...trend.points].reverse().slice(0, 10);

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      <AppText style={{ fontSize: 24, fontWeight: "800" }}>{exerciseLabels(lift, lang).primary}</AppText>
      <AppText style={{ color: p.muted }}>{t("trend.setupLine", { gym: lift.gymName, setup: t(`setup.${lift.setup}` as never) })}</AppText>
      <Card>
        <AppText style={{ color: p.muted }}>{assisted ? t("trend.measureAssisted") : t("trend.measure")}</AppText>
        {trend.points.length === 0 ? <AppText>{t("trend.noPoints")}</AppText> : null}
        <TrendChart points={trend.points} assisted={assisted} />
        {trend.points.length > 0 ? <AppText style={{ color: p.muted, fontSize: 13 }}>{t("trend.chartHint")}</AppText> : null}
        <AppText style={{ fontWeight: "800", fontSize: 18 }}>{t(directionKey(trend.direction, assisted))}</AppText>
        {trend.loadChangePer30d !== null ? (
          <AppText style={{ color: p.muted }}>
            {t("trend.change", {
              delta: String(Math.round(kgToUnit(Math.abs(trend.loadChangePer30d), unit) * 10) / 10),
              unit: unitText,
              n: Math.min(trend.points.length, 10),
            })}
          </AppText>
        ) : null}
        {trend.latest ? <AppText>{t("trend.latest", { set: setText(trend.latest), date: localDateText(trend.latest.at) })}</AppText> : null}
        {trend.best ? <AppText>{t("trend.best", { set: setText(trend.best), date: localDateText(trend.best.at) })}</AppText> : null}
      </Card>
      {recent.length > 0 ? (
        <Card>
          <AppText style={{ fontWeight: "700" }}>{t("trend.recent")}</AppText>
          {recent.map((pt) => (
            <AppText key={pt.at} ltr style={{ textAlign: "left" }}>
              {localDateText(pt.at)}  {fmt(pt.load)} × {pt.reps}
              {pt.imported ? `  (${t("trend.imported")})` : ""}
            </AppText>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
