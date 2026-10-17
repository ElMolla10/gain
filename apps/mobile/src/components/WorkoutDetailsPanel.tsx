import React, { type ReactNode } from "react";
import { View } from "react-native";
import type { ReadinessFlag } from "@gain/engine";
import { useI18n } from "../i18n";
import { space, useLogPalette } from "../theme";
import { AppText, Chip, QuietAction } from "../ui";
import { PreviousSourceToggle, type PreviousSource } from "./PreviousSourceToggle";

/** Session-level controls (readiness, PREVIOUS source, reorder), closed by default. Renders nothing while closed. */
export function WorkoutDetailsPanel({ open, readiness, onReadiness, previousSource, onPreviousSource, onReorder, children }: {
  open: boolean;
  readiness: ReadinessFlag | null;
  onReadiness: (next: ReadinessFlag | null) => void;
  previousSource: PreviousSource;
  onPreviousSource: (source: PreviousSource) => void;
  /** Omitted when there is nothing to reorder. */
  onReorder?: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const p = useLogPalette();
  if (!open) return null;
  return <View>
    {children}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm }}>
      <AppText style={{ color: p.muted, alignSelf: "center" }}>{t("workout.readiness.label")}</AppText>
      {(["normal", "fatigued", "returning"] as const).map((flag) => (
        <Chip
          key={flag}
          label={t(`workout.readiness.${flag}`)}
          selected={flag === "normal" ? readiness == null : readiness === flag}
          onPress={() => onReadiness(flag === "normal" ? null : flag)}
        />
      ))}
    </View>
    <PreviousSourceToggle source={previousSource} onChange={onPreviousSource} />
    {onReorder ? <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm }}>
      <QuietAction icon="drag" label={t("workout.reorder.button")} onPress={onReorder} />
    </View> : null}
  </View>;
}
