import React from "react";
import { Alert, View } from "react-native";
import type { Decision, EquipmentType, GymLoadSpec } from "@gain/engine";
import { useI18n } from "../i18n";
import { formatLoad, isolateLtr } from "../i18n/format";
import { matchingJumpKg, TREND_LOAD_JUMPS_KG } from "../logic/exerciseLoads";
import type { ReportedSymptom } from "../logic/liveAdaptation";
import type { NextSetState } from "../logic/nextSetCard";
import { weightText } from "../logic/units";
import { radius, space, type as ty, useLogPalette } from "../theme";
import { AppText, BigButton, Chip, Field, IconButton, QuietAction } from "../ui";

interface Props {
  decision: Decision;
  state: NextSetState;
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
  basis?: { load: number; reps: number };
  repMin: number;
  repMax: number;
  equipment: EquipmentType;
  loadSpec?: GymLoadSpec | null;
  manualLoad: boolean;
  busy: boolean;
  onApply: () => void;
  onOwn: () => void;
  onKeep: () => void;
  onReport: (symptom: ReportedSymptom) => void;
  whySentence?: string | null;
}

/** Presentation only: the logger owns persistence, staleness checks and acceptance. */
export function LiveSuggestion({ decision, state, detailsOpen = false, onToggleDetails, basis, repMin, repMax, equipment, loadSpec, manualLoad, busy, onApply, onOwn, onKeep, onReport, whySentence }: Props) {
  const { t, lang, unit } = useI18n();
  const p = useLogPalette();
  const load = formatLoad(decision.suggestedWeightKg, lang, unit);
  const nextValue = `${load} × ${isolateLtr(String(decision.suggestedReps))}`;
  const stop = state === "stop";
  const starting = state === "starting";
  const predictedOk = !stop && !starting && decision.predictionAvailable !== false && decision.reason !== "reported_symptoms";
  const stateKey = state === "stop" ? "live.stop" : `live.state.${state}`;
  const reason = stop
    ? t(`live.reason.${decision.reason}` as never)
    : starting
      ? t("live.startingNote")
      : state === "no_heavier"
        ? t("live.noHeavier", { equipment: t(`equipment.${equipment}` as never), load, min: repMin, max: repMax })
        : whySentence ?? (basis ? t("live.afterSet", { load: formatLoad(basis.load, lang, unit), reps: basis.reps }) : null);

  return (
    <View accessibilityLiveRegion={stop ? "assertive" : "polite"} style={{ marginHorizontal: space.md, marginVertical: space.sm, padding: space.md, gap: space.sm, borderRadius: radius.card, backgroundColor: p.card, borderWidth: 2, borderColor: stop ? p.danger : p.fill }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <AppText style={{ flex: 1, fontWeight: "600" }}>{t("live.title")}</AppText>
        <IconButton icon="alert" label={t("live.report")} onPress={() => Alert.alert(t("live.report"), undefined, [
          { text: t("live.severePain"), onPress: () => onReport("severe_pain") },
          { text: t("live.dizziness"), onPress: () => onReport("dizziness") },
          { text: t("common.cancel"), style: "cancel" },
        ])} />
      </View>
      <AppText style={{ fontWeight: "700", color: p.accent }}>{t(stateKey as never)}</AppText>
      {/* Label on its own line, value in the language's order with only the numbers isolated (L-10): never ltr-forced. */}
      {stop ? null : (
        <View accessible accessibilityLabel={`${t("live.nextLabel")}: ${nextValue}`} style={{ gap: 2 }}>
          <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("live.nextLabel")}</AppText>
          <AppText style={{ fontWeight: "700", fontSize: ty.load, color: p.accent, fontVariant: ["tabular-nums"] }}>{nextValue}</AppText>
        </View>
      )}
      {reason ? <AppText style={{ color: p.muted }}>{reason}</AppText> : null}
      {predictedOk ? <AppText>{t("live.predicted", { reps: Math.round(decision.predictedReps * 10) / 10, min: repMin, max: repMax })}</AppText> : null}
      {detailsOpen ? <View style={{ gap: space.xs }}>
        {decision.action !== "stop" && state !== "no_heavier" ? <AppText style={{ color: p.muted }}>{t(`live.reason.${decision.reason}` as never)}</AppText> : null}
        {whySentence && state === "no_heavier" ? <AppText style={{ color: p.muted }}>{whySentence}</AppText> : null}
        {predictedOk ? <AppText style={{ color: p.muted }}>{t("live.estimateNote")}</AppText> : null}
      </View> : null}
      {stop ? (
        <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap", alignItems: "center" }}>
          <BigButton variant="quiet" label={t("live.dismiss")} disabled={busy} onPress={onKeep} />
          <QuietAction label={detailsOpen ? t("live.less") : t("live.details")} expanded={detailsOpen} onPress={onToggleDetails ?? (() => undefined)} />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <BigButton label={t("live.apply")} disabled={busy} onPress={onApply} />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <BigButton variant="secondary" label={t("live.own")} disabled={busy} onPress={onOwn} />
            </View>
          </View>
          {manualLoad ? <AppText style={{ color: p.muted }}>{t("live.manual")}</AppText> : null}
          <QuietAction label={detailsOpen ? t("live.less") : t("live.details")} expanded={detailsOpen} onPress={onToggleDetails ?? (() => undefined)} />
        </>
      )}
    </View>
  );
}

/**
 * Available-load settings for one exercise (jump chips and a custom list), opened from the exercise header's Loads control.
 * Saving changes later suggestions and the plate line; weights already logged stay as they are.
 */
export function LoadSettings({ loadSpec, busy, onPickJump, listText, onListChange, onSaveList }: {
  loadSpec?: GymLoadSpec | null; busy: boolean; onPickJump: (kg: number) => void;
  listText?: string; onListChange?: (text: string) => void; onSaveList?: () => void;
}) {
  const { t, unit, unitText } = useI18n();
  const p = useLogPalette();
  const selectedJump = matchingJumpKg(loadSpec ?? null);
  return (
    <View style={{ marginHorizontal: space.md, marginBottom: space.xs, padding: space.sm, gap: space.xs, borderRadius: radius.card, backgroundColor: p.card }}>
      <AppText style={{ fontWeight: "600", fontSize: ty.label }}>{t("live.loads")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {TREND_LOAD_JUMPS_KG.map((kg) => (
          <Chip
            key={kg}
            label={t("loads.jump", { step: weightText(kg, unit), unit: unitText })}
            selected={selectedJump === kg}
            onPress={() => onPickJump(kg)}
          />
        ))}
      </View>
      {onSaveList && onListChange ? (
        <>
          <Field label={t("loads.mode.list")} hint={t("loads.list.hint")} value={listText ?? ""} onChangeText={onListChange} keyboardType="numbers-and-punctuation" />
          <BigButton variant="quiet" label={t("loads.save")} disabled={busy || !(listText ?? "").trim()} onPress={onSaveList} />
        </>
      ) : null}
    </View>
  );
}
