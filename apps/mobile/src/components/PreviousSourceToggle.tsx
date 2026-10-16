import React from "react";
import { Pressable, View } from "react-native";
import { useI18n } from "../i18n";
import { radius, space, useLogPalette } from "../theme";
import { AppText } from "../ui";

export type PreviousSource = "any" | "routine";
export const PREVIOUS_SOURCE_KEY = "previous_source";
export const parsePreviousSource = (value: string | null): PreviousSource => value === "routine" ? "routine" : "any";

/** Display preference only: its owner must never rebuild drafts or suggestions on change. */
export function PreviousSourceToggle({ source, onChange }: { source: PreviousSource; onChange: (source: PreviousSource) => void }) {
  const { t } = useI18n();
  const p = useLogPalette();
  return <View accessibilityRole="radiogroup" accessibilityLabel={t("workout.col.prev")} style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, paddingHorizontal: space.md, paddingBottom: space.sm }}>
    {(["any", "routine"] as const).map(option => <Pressable key={option} accessibilityRole="radio"
      accessibilityState={{ checked: source === option }} onPress={() => onChange(option)}
      style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: space.sm, borderRadius: radius.button, borderWidth: 1, borderColor: source === option ? p.accent : p.line }}>
      <AppText style={{ fontSize: 13, color: source === option ? p.accent : p.muted }}>{source === option ? "✓ " : ""}{t(option === "any" ? "workout.previous.any" : "workout.previous.routine")}</AppText>
    </Pressable>)}
  </View>;
}
