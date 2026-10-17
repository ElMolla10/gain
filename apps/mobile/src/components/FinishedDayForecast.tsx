import { renderReason } from "@gain/engine";
import React, { useState } from "react";
import { View } from "react-native";
import type { FinishRepo } from "../db/finishRepo";
import { useI18n } from "../i18n";
import { targetRowText } from "../logic/bidiText";
import { shortReason } from "../logic/nextTarget";
import { forecastOrder, whyDetail } from "../logic/finishLayout";
import { localizeReason } from "../logic/units";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, Card, QuietAction } from "../ui";
import { Icon } from "./Icon";

export type SameDayForecast = NonNullable<Awaited<ReturnType<FinishRepo["previewFinishedDay"]>>>;

/**
 * Forecast of the next OCCURRENCE of the day just completed (not a planned rotation session; read-only suggestions, not accepted
 * targets). Design audit F-1/F-3/F-4/F-8: the lead exercise (the goal lift when there is one) is a target strip with its name as the
 * first line, the load at 36 and the reason as a readable 16 sentence with a "Why" that opens the full reasoning in place; the other
 * exercises are compact 56 dp rows like the Today list. Loads are built in the language's order (F-2).
 */
export function FinishedDayForecast({ value, leadExerciseId, whyTargets, onWhy }: {
  value: SameDayForecast | "none";
  leadExerciseId?: string | null;
  /** exerciseId -> targetId for exercises with a saved decision record (see resolveWhyTargets). */
  whyTargets?: Record<string, string>;
  /** Opens the real Why / decision detail for a saved target. */
  onWhy?: (targetId: string) => void;
}) {
  const { t, lang, unit, direction } = useI18n();
  const p = usePalette();
  const [whyOpen, setWhyOpen] = useState(false);
  if (value === "none") return <Card><AppText>{t("finish.noNext")}</AppText></Card>;
  const letters = { s: t("qty.s"), m: t("qty.m") };
  const targetOf = (ex: SameDayForecast["exercises"][number]) =>
    ex.proposal.load === null || ex.proposal.currency === "none" ? null
      : targetRowText({ measure: ex.measure, reps: ex.proposal.reps, durationS: ex.proposal.durationS, distanceM: ex.proposal.distanceM, effectiveLoad: ex.proposal.load }, lang, unit, letters);
  const { lead, rest } = forecastOrder(value.exercises, leadExerciseId ?? null, (ex) => targetOf(ex) !== null);
  const name = (ex: { nameEn: string; nameAr: string }) => (lang === "ar" ? ex.nameAr : ex.nameEn);
  const leadTarget = lead ? targetOf(lead) : null;
  const fullReason = lead ? renderReason(localizeReason(lead.proposal.reason, unit, lang), lang) : "";
  const sentence = shortReason(fullReason);
  const more = whyDetail(fullReason, sentence);
  // A saved decision record wins: Why opens the same Why screen as everywhere else. Only without one does it expand in place.
  const savedTargetId = lead && onWhy ? whyTargets?.[lead.exerciseId] ?? null : null;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("finish.next", { day: value.dayName })}</AppText>
        <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("finish.nextHintShort")}</AppText>
      </View>
      {lead ? (
        // One strip, no card around it (F-4): name, load, reason, Why.
        <View style={{ backgroundColor: p.tint, borderRadius: radius.card, padding: space.lg, gap: space.xs, borderStartWidth: 4, borderStartColor: p.accent }}>
          <AppText style={{ fontWeight: "600" }}>{name(lead)}</AppText>
          <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent, letterSpacing: 0.4 }}>{t("target.label")}</AppText>
          {leadTarget ? <AppText style={{ fontSize: ty.load, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{leadTarget}</AppText> : <AppText style={{ color: p.muted }}>{t("finish.noTarget")}</AppText>}
          {sentence ? <AppText>{sentence}</AppText> : null}
          {!savedTargetId && whyOpen && more ? <AppText style={{ color: p.muted, fontSize: ty.label }}>{more}</AppText> : null}
          {/* Saved record: open Why. Otherwise only when there is more to say than the sentence; hidden, not disabled (F-3). */}
          {savedTargetId ? (
            <View style={{ alignItems: "flex-start" }}>
              <QuietAction icon="why" label={t("workout.whyShort")} accessibilityLabel={`${t("workout.whyShort")}: ${name(lead!)}`} onPress={() => onWhy!(savedTargetId)} />
            </View>
          ) : more ? (
            // In-place fallback: a chevron after the label shows open/closed (D-R4).
            <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start" }}>
              <QuietAction icon="why" label={t("workout.whyShort")} accessibilityLabel={`${t("workout.whyShort")}: ${name(lead)}`} expanded={whyOpen} onPress={() => setWhyOpen((o) => !o)} />
              <View pointerEvents="none" style={{ transform: [{ rotate: whyOpen ? (direction === "rtl" ? "-90deg" : "90deg") : "0deg" }] }}>
                <Icon name="chevron" color={p.accent} size={18} mirror />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      {rest.length > 0 ? (
        <Card style={{ paddingVertical: space.xs }}>
          {rest.map((ex, i) => {
            const target = targetOf(ex);
            return (
              <View key={ex.exerciseId} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: space.md, paddingVertical: space.sm, borderBottomWidth: i === rest.length - 1 ? 0 : 1, borderColor: p.border }}>
                <AppText style={{ fontWeight: "600", flexShrink: 1 }}>{name(ex)}</AppText>
                {target
                  ? <AppText style={{ fontSize: ty.section, fontWeight: "600", color: p.accent, fontVariant: ["tabular-nums"] }}>{target}</AppText>
                  : <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("finish.noTarget")}</AppText>}
              </View>
            );
          })}
        </Card>
      ) : null}
    </View>
  );
}
