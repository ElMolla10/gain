import { targetPhrase } from "../logic/quantity";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import type { LiftTrend } from "@gain/engine";
import { useServices } from "../AppContext";
import type { LiftItem } from "../db/historyRepo";
import { TrendChart } from "../components/TrendChart";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import { directionKey, localDateText } from "../logic/trendChart";
import { kgToUnit } from "../logic/units";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, EmptyState, LoadingState, Screen } from "../ui";

/** One trend per lift: the top set of each workout, drawn as bars, with plain words for the direction. */
export function LiftTrendScreen() {
  const { history } = useServices();
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const lineId = (useRoute().params as { lineId: string }).lineId;
  const [data, setData] = useState<{ lift: LiftItem; trend: LiftTrend } | null | "none">(null);

  useFocusEffect(
    useCallback(() => {
      history.getLiftTrend(lineId).then((r) => setData(r ?? "none"));
    }, [history, lineId]),
  );

  if (data === null) return <LoadingState />;
  if (data === "none") return <EmptyState icon="progress" title={t("trend.noPoints")} />;
  const { lift, trend } = data;
  const assisted = lift.setup === "assisted";
  const timed = trend.timed ?? null;
  const letters = { s: t("qty.s"), m: t("qty.m") };
  const setText = (pt: { load: number; reps: number; quantity?: number }) => (timed && pt.quantity !== undefined ? isolateLtr(targetPhrase(pt.load, pt.quantity, timed, fmt, letters)) : `${fmt(pt.load)} × ${isolateLtr(String(pt.reps))}`);
  const recent = [...trend.points].reverse().slice(0, 10);

  return (
    <Screen title={exerciseLabels(lift, lang).primary}>
      <AppText style={{ color: p.muted }}>{t("trend.setupLine", { setup: t(`setup.${lift.setup}` as never) })}</AppText>
      <Card>
        <AppText style={{ color: p.muted }}>{timed ? t("trend.timedMeasure") : assisted ? t("trend.measureAssisted") : t("trend.measure")}</AppText>
        {trend.points.length === 0 ? <AppText>{t("trend.noPoints")}</AppText> : null}
        <AppText style={{ fontWeight: "600", fontSize: ty.section }}>{t(directionKey(trend.direction, assisted))}</AppText>
        {trend.latest ? <AppText ltr style={{ fontSize: ty.load, fontWeight: "600" }}>{setText(trend.latest)}</AppText> : null}
        <TrendChart points={trend.points} assisted={assisted} summary={t("trend.chartLabel", { dir: t(directionKey(trend.direction, assisted)), n: trend.points.length })} axisText={(from, to) => t("trend.axis", { from, to })} />
        {trend.points.length > 0 ? <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("trend.chartHint")}</AppText> : null}
        {timed && trend.quantityChangePer30d != null ? (
          <AppText style={{ color: p.muted }}>
            {t("trend.changeQuantity", { delta: String(Math.round(Math.abs(trend.quantityChangePer30d) * 10) / 10), unit: timed === "time" ? letters.s : letters.m, n: Math.min(trend.points.length, 10) })}
          </AppText>
        ) : null}
        {(!timed || trend.quantityChangePer30d == null) && trend.loadChangePer30d !== null ? (
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
      <BigButton variant="secondary" label={t("loads.open")} onPress={() => nav.navigate("ExerciseLoads", { exerciseId: lift.exerciseId })} />
      {recent.length > 0 ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("trend.recent")}</AppText>
          {recent.map((pt) => (
            <AppText key={pt.at} ltr style={{ textAlign: "left" /* a11y-ok: LTR figures stay left-aligned */ }}>
              {localDateText(pt.at)}  {setText(pt)}
              {pt.imported ? `  (${t("trend.imported")})` : ""}
            </AppText>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
