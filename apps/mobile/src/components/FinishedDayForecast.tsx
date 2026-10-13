import { renderReason } from "@gain/engine";
import React from "react";
import { View } from "react-native";
import type { FinishRepo } from "../db/finishRepo";
import { formatLoad, isolateLtr } from "../i18n/format";
import { useI18n } from "../i18n";
import { isTimed, targetPhrase } from "../logic/quantity";
import { shortReason } from "../logic/nextTarget";
import { localizeReason } from "../logic/units";
import { space, type as ty, usePalette } from "../theme";
import { AppText, Card, TargetStrip } from "../ui";

export type SameDayForecast = NonNullable<Awaited<ReturnType<FinishRepo["previewFinishedDay"]>>>;

/** Forecast of the next OCCURRENCE of the day just completed. Not a planned
 * rotation session; these read-only suggestions are not accepted targets. */
export function FinishedDayForecast({ value }: { value: SameDayForecast | "none" }) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  if (value === "none") return <Card><AppText>{t("finish.noNext")}</AppText></Card>;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("finish.next", { day: value.dayName })}</AppText>
        <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("finish.nextHint")}</AppText>
      </View>
      {value.exercises.map(ex => {
        const proposal = ex.proposal;
        const target = proposal.load === null || proposal.currency === "none" ? null
          : isTimed(ex.measure)
            ? targetPhrase(proposal.load,
                ex.measure === "time" ? proposal.durationS ?? 0 : proposal.distanceM ?? 0,
                ex.measure, (kg) => formatLoad(kg, lang, unit), { s: t("qty.s"), m: t("qty.m") })
            : `${formatLoad(proposal.load, lang, unit)} × ${isolateLtr(String(proposal.reps ?? ""))}`;
        return (
          <Card key={ex.exerciseId}>
            <AppText style={{ fontWeight: "600" }}>{lang === "ar" ? ex.nameAr : ex.nameEn}</AppText>
            {target === null
              ? <AppText style={{ color: p.muted }}>{t("finish.noTarget")}</AppText>
              : <TargetStrip label={t("target.label")} value={isolateLtr(target)}
                  reason={shortReason(renderReason(localizeReason(proposal.reason, unit, lang), lang))} />}
          </Card>
        );
      })}
    </View>
  );
}
