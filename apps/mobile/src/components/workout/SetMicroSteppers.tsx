import React from "react";
import { Pressable, View } from "react-native";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import type { Unit } from "../../logic/units";
import { radius, space, type as ty, useLogPalette, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { haptics } from "../../haptics";

export interface SetMicroSteppersProps {
  load: number | null;
  reps: number | null;
  unit: Unit;
  rir: number | null;
  trackEffort?: boolean;
  onAdjustLoad: (delta: number) => void;
  onAdjustReps: (delta: number) => void;
  onSetRir: (rir: number) => void;
}

/**
 * Chalk-friendly in-row micro-steppers for the active set.
 * Allows instant load adjustments (±2.5kg or ±5lb) and rep increments (±1)
 * without opening the software keyboard.
 */
export function SetMicroSteppers({
  load,
  reps,
  unit,
  rir,
  trackEffort,
  onAdjustLoad,
  onAdjustReps,
  onSetRir,
}: SetMicroSteppersProps) {
  const { t } = useI18n();
  const lp = useLogPalette();
  const p = usePalette();

  const loadStep = unit === "lb" ? 5 : 2.5;

  return (
    <View style={{ gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, flexWrap: "wrap" }}>
        {/* Load Micro-Steppers */}
        <View style={{ flexDirection: "row", gap: space.xs, flex: 1, minWidth: 140 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("workout.stepper.loadDown", { n: loadStep, unit })}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => {
              haptics.tick();
              onAdjustLoad(-loadStep);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 36,
              borderRadius: radius.button,
              borderWidth: 1,
              borderColor: lp.edge,
              backgroundColor: pressed ? lp.line : lp.field,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <AppText ltr style={{ fontSize: ty.caption, fontWeight: "600", color: lp.text }}>
              {isolateLtr(`−${loadStep}`)}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("workout.stepper.loadUp", { n: loadStep, unit })}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => {
              haptics.tick();
              onAdjustLoad(loadStep);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 36,
              borderRadius: radius.button,
              borderWidth: 1,
              borderColor: lp.edge,
              backgroundColor: pressed ? lp.line : lp.field,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <AppText ltr style={{ fontSize: ty.caption, fontWeight: "600", color: lp.text }}>
              {isolateLtr(`+${loadStep}`)}
            </AppText>
          </Pressable>
        </View>

        {/* Reps Micro-Steppers */}
        <View style={{ flexDirection: "row", gap: space.xs, flex: 1, minWidth: 120 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("workout.stepper.repsDown")}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => {
              haptics.tick();
              onAdjustReps(-1);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 36,
              borderRadius: radius.button,
              borderWidth: 1,
              borderColor: lp.edge,
              backgroundColor: pressed ? lp.line : lp.field,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <AppText ltr style={{ fontSize: ty.caption, fontWeight: "600", color: lp.text }}>
              {isolateLtr("−1")}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("workout.stepper.repsUp")}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => {
              haptics.tick();
              onAdjustReps(1);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 36,
              borderRadius: radius.button,
              borderWidth: 1,
              borderColor: lp.edge,
              backgroundColor: pressed ? lp.line : lp.field,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <AppText ltr style={{ fontSize: ty.caption, fontWeight: "600", color: lp.text }}>
              {isolateLtr("+1")}
            </AppText>
          </Pressable>
        </View>
      </View>

      {/* RIR Dial (when effort is tracked) */}
      {trackEffort ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: 2 }}>
          <AppText style={{ fontSize: ty.caption, color: lp.muted, marginEnd: space.xs }}>
            {t("workout.rir.label")}
          </AppText>
          {([0, 1, 2, 3] as const).map((r) => {
            const isSelected = rir === r || (r === 3 && rir !== null && rir >= 3);
            return (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`RIR ${r === 3 ? "3+" : r}`}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                onPress={() => {
                  haptics.selection();
                  onSetRir(r);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 32,
                  borderRadius: radius.button,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? p.accent : lp.edge,
                  backgroundColor: isSelected ? p.tint : pressed ? lp.line : lp.field,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <AppText
                  ltr
                  style={{
                    fontSize: ty.caption,
                    fontWeight: isSelected ? "700" : "500",
                    color: isSelected ? p.accent : lp.text,
                  }}
                >
                  {isolateLtr(r === 3 ? "3+" : String(r))}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
