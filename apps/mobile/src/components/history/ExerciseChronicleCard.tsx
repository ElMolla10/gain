import React from "react";
import { View, type TextStyle } from "react-native";
import type { Measure } from "@gain/engine";
import { useI18n } from "../../i18n";
import { exerciseLabels, isolateLtr } from "../../i18n/format";
import { isTimed, setQuantity } from "../../logic/quantity";
import type { Unit } from "../../logic/units";
import { weightText } from "../../logic/units";
import { rowLabels } from "../../logic/workoutRows";
import { MIN_TOUCH, radius, space, type as ty, usePalette } from "../../theme";
import { AppText, BigButton, Card, Field, InlineStatus } from "../../ui";
import type { HistorySetRow, SessionDetail } from "../../db/historyRepo";
import type { SessionSummary } from "../../db/finishRepo";

export interface EditState {
  setId: string;
  origKg: number;
  load: string;
  reps: string;
  rir: string;
}

export interface ExerciseChronicleCardProps {
  exercise: SessionDetail["exercises"][number];
  summary?: SessionSummary["exercises"][number];
  unit: Unit;
  editing: boolean;
  editState: EditState | null;
  askingId: string | null;
  errorMessage: string | null;
  onStartEdit: (set: HistorySetRow) => void;
  onSaveEdit: (measure: Measure) => void;
  onCancelEdit: () => void;
  onChangeEdit: (state: EditState) => void;
  onAskDelete: (setId: string) => void;
  onConfirmDelete: (setId: string) => void;
  onCancelDelete: () => void;
}

/**
 * 10x Exercise Iron Chronicle Card:
 * Replaces generic tables with a high-contrast heavy log card featuring
 * total exercise volume, distinct PR crowns, prominent Top Set badge,
 * and zero-shame RIR display (shown only when recorded).
 */
export function ExerciseChronicleCard({
  exercise,
  summary,
  unit,
  editing,
  editState,
  askingId,
  errorMessage,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onChangeEdit,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: ExerciseChronicleCardProps) {
  const { t, lang, unitText } = useI18n();
  const p = usePalette();

  const timed = isTimed(exercise.measure);
  const labels = rowLabels(exercise.sets);

  // Compute total volume for this exercise
  let exKg = 0;
  let topSetId: string | null = null;
  let highestLoad = -1;

  exercise.sets.forEach((s) => {
    if (!s.warmup) {
      const reps = timed ? 1 : s.reps;
      exKg += s.load * reps;
      if (s.load > highestLoad) {
        highestLoad = s.load;
        topSetId = s.id;
      }
    }
  });

  const displayVolume = Math.round(unit === "lb" ? exKg * 2.20462 : exKg);

  const head: TextStyle = { fontSize: ty.caption, fontWeight: "600", color: p.muted };
  const cell: TextStyle = { fontSize: ty.body, fontWeight: "600", fontVariant: ["tabular-nums"] };

  const records = summary?.records ?? [];

  return (
    <Card key={exercise.exerciseId} style={{ gap: space.sm }}>
      {/* Exercise Header */}
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "700", color: p.text }}>
              {exerciseLabels(exercise, lang).primary}
            </AppText>
            {exerciseLabels(exercise, lang).secondary ? (
              <AppText style={{ fontSize: ty.caption, color: p.muted }}>
                {exerciseLabels(exercise, lang).secondary}
              </AppText>
            ) : null}
          </View>

          {/* Volume Tonnage Chip */}
          {exKg > 0 ? (
            <View
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: 2,
                borderRadius: radius.pill,
                backgroundColor: p.raised,
                borderWidth: 1,
                borderColor: p.border,
              }}
            >
              <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.text }}>
                {isolateLtr(`${displayVolume.toLocaleString()} ${unitText}`)}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* PR Records Crown Badges */}
        {records.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: 2 }}>
            {records.includes("load") ? (
              <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.button, backgroundColor: p.tint }}>
                <AppText style={{ fontSize: 11, fontWeight: "700", color: p.accent }}>
                  {t("history.record.heaviest")}
                </AppText>
              </View>
            ) : null}

            {records.includes("rep") && summary?.repPr ? (
              <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.button, backgroundColor: p.tint }}>
                <AppText style={{ fontSize: 11, fontWeight: "700", color: p.accent }}>
                  {t("history.record.repPr", { reps: isolateLtr(String(summary.repPr.reps)) })}
                </AppText>
              </View>
            ) : null}

            {records.includes("e1rm") && summary?.estimated1rm ? (
              <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.button, backgroundColor: p.tint }}>
                <AppText style={{ fontSize: 11, fontWeight: "700", color: p.accent }}>
                  {t("history.record.e1rmPr", { load: isolateLtr(`${summary.estimated1rm} ${unitText}`) })}
                </AppText>
              </View>
            ) : null}

            {records.includes("reps_at_load") && summary?.top ? (
              <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.button, backgroundColor: p.tint }}>
                <AppText style={{ fontSize: 11, fontWeight: "700", color: p.accent }}>
                  {t("history.record.repsAtLoad", { load: isolateLtr(`${summary.top.load} ${unitText}`) })}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Column Headers */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingTop: space.xs }}>
        <View style={{ width: 36 }}>
          <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={head}>
            {t("workout.col.set").toUpperCase()}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={head}>{unitText.toUpperCase()}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={head}>
            {(timed ? (exercise.measure === "time" ? t("workout.col.sec") : t("workout.col.metres")) : t("workout.col.reps")).toUpperCase()}
          </AppText>
        </View>
        <View style={{ width: 80, alignItems: "flex-end" }}>
          <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={head}>
            {t("history.postmortem.topSet").toUpperCase()}
          </AppText>
        </View>
      </View>

      {/* Set Rows */}
      {exercise.sets.map((s, i) => {
        const label = labels[i]!;
        const isTop = s.id === topSetId;

        return (
          <View key={s.id} style={{ borderTopWidth: 1, borderColor: p.border, paddingVertical: 2 }}>
            <View style={{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: space.sm }}>
              {/* Set Label */}
              <View style={{ width: 36 }}>
                <AppText ltr style={{ ...cell, color: s.warmup ? p.muted : label === "D" || label === "F" ? p.accent : p.text }}>
                  {label}
                </AppText>
              </View>

              {/* Load */}
              <View style={{ flex: 1 }}>
                <AppText style={{ ...cell, fontWeight: isTop ? "800" : "600", color: isTop ? p.text : p.text }}>
                  {isolateLtr(weightText(s.load, unit))}
                </AppText>
              </View>

              {/* Reps / Quantity */}
              <View style={{ flex: 1 }}>
                <AppText style={{ ...cell, fontWeight: isTop ? "800" : "600", color: isTop ? p.text : p.text }}>
                  {isolateLtr(String(timed ? setQuantity(s, exercise.measure) : s.reps))}
                </AppText>
              </View>

              {/* End Column: Top Set badge OR RIR pill (only if recorded) */}
              <View style={{ width: 80, alignItems: "flex-end", flexDirection: "row", justifyContent: "flex-end", gap: 4 }}>
                {s.rir !== null ? (
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: p.raised }}>
                    <AppText style={{ fontSize: 11, fontWeight: "600", color: p.muted }}>
                      {t("history.rirPill", { n: isolateLtr(String(s.rir)) })}
                    </AppText>
                  </View>
                ) : null}

                {isTop && !s.warmup ? (
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: p.tint }}>
                    <AppText style={{ fontSize: 11, fontWeight: "700", color: p.accent }}>
                      ⭐
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Set Tags */}
            {s.warmup ? (
              <AppText style={{ color: p.muted, fontSize: ty.label, marginStart: space.xs }}>
                {t("history.warmup")}
              </AppText>
            ) : null}
            {!s.warmup && s.tags?.includes("drop") ? (
              <AppText style={{ color: p.muted, fontSize: ty.label, marginStart: space.xs }}>
                {t("history.drop")}
              </AppText>
            ) : null}
            {!s.warmup && s.tags?.includes("failure") ? (
              <AppText style={{ color: p.muted, fontSize: ty.label, marginStart: space.xs }}>
                {t("history.failure")}
              </AppText>
            ) : null}
            {s.outlierStatus === "unconfirmed" ? (
              <InlineStatus kind="warn" text={t("history.unconfirmed")} />
            ) : null}
            {s.outlierStatus === "confirmed" ? (
              <AppText style={{ color: p.muted, fontSize: ty.label, marginStart: space.xs }}>
                {t("history.confirmed")}
              </AppText>
            ) : null}

            {/* In-Place Edit Mode */}
            {editing && editState?.setId === s.id ? (
              <View style={{ gap: space.sm, paddingVertical: space.sm }}>
                <Field
                  label={t("history.field.load", { unit: unitText })}
                  value={editState.load}
                  onChangeText={(v) => onChangeEdit({ ...editState, load: v })}
                  numeric
                  keyboardType="decimal-pad"
                />
                <Field
                  label={timed ? (exercise.measure === "time" ? t("history.field.seconds") : t("history.field.metres")) : t("history.field.reps")}
                  value={editState.reps}
                  onChangeText={(v) => onChangeEdit({ ...editState, reps: v })}
                  numeric
                  keyboardType="number-pad"
                />
                {!timed ? (
                  <Field
                    label={t("history.field.rir")}
                    value={editState.rir}
                    onChangeText={(v) => onChangeEdit({ ...editState, rir: v })}
                    numeric
                    keyboardType="decimal-pad"
                  />
                ) : null}
                {errorMessage ? <InlineStatus kind="error" text={t(errorMessage as any)} /> : null}
                <BigButton label={t("history.save")} onPress={() => onSaveEdit(exercise.measure)} />
                <BigButton variant="secondary" label={t("history.cancel")} onPress={onCancelEdit} />
              </View>
            ) : editing && askingId === s.id ? (
              <View style={{ gap: space.md, paddingVertical: space.sm }}>
                <AppText>{t("history.deleteAsk")}</AppText>
                <BigButton
                  variant="dangerSolid"
                  label={t("history.deleteYes")}
                  onPress={() => onConfirmDelete(s.id)}
                />
                <BigButton variant="secondary" label={t("history.cancel")} onPress={onCancelDelete} />
              </View>
            ) : editing ? (
              <View style={{ flexDirection: "row", gap: space.sm, paddingVertical: space.xs }}>
                <View style={{ flex: 1 }}>
                  <BigButton variant="secondary" icon="edit" label={t("history.edit")} onPress={() => onStartEdit(s)} />
                </View>
                <View style={{ flex: 1 }}>
                  <BigButton variant="danger" icon="trash" label={t("history.delete")} onPress={() => onAskDelete(s.id)} />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}
