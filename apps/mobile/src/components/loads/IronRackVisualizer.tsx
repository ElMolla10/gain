import React from "react";
import { Pressable, View } from "react-native";
import { barbellPlates, type GymLoadSpec } from "@gain/engine";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import { weightText, type Unit } from "../../logic/units";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { BarArt } from "../today/BarArt";
import { haptics } from "../../haptics";

export interface IronRackVisualizerProps {
  values: number[];
  invalid: string[];
  unit: Unit;
  equipment: GymLoadSpec["equipment"];
  selectedLoad: number | null;
  onSelectLoad: (load: number) => void;
}

/**
 * 10x The Iron Rack Visualizer:
 * Displays the configured weight ladder as tactile physical rungs,
 * previews step deltas between weights, and shows an instant Olympic
 * barbell breakdown for any selected rung.
 */
export function IronRackVisualizer({
  values,
  invalid,
  unit,
  equipment,
  selectedLoad,
  onSelectLoad,
}: IronRackVisualizerProps) {
  const { t, unitText } = useI18n();
  const p = usePalette();

  const standardSpec = {
    equipment: "barbell" as const,
    increment: unit === "lb" ? 5 : 2.5,
    min: unit === "lb" ? 45 : 20,
    max: unit === "lb" ? 600 : 300,
    plates: unit === "lb" ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25],
  };

  const selectedIndex = selectedLoad !== null ? values.indexOf(selectedLoad) : -1;
  const prevLoad = selectedIndex > 0 ? values[selectedIndex - 1] : null;
  const delta = prevLoad !== null && selectedLoad !== null ? Math.round((selectedLoad - prevLoad) * 10) / 10 : null;

  const selectedPlates =
    equipment === "barbell" && selectedLoad !== null && selectedLoad >= (standardSpec.min ?? 20)
      ? barbellPlates(standardSpec, selectedLoad)?.perSide ?? []
      : [];

  return (
    <View style={{ gap: space.sm }}>
      {/* Rack Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
          <AppText style={{ fontSize: 16 }}>🏋️</AppText>
          <AppText
            style={{
              fontSize: ty.caption,
              fontWeight: "600",
              color: p.muted,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {t("loads.rack.title")}
          </AppText>
        </View>

        {values.length > 0 ? (
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: p.raised }}>
            <AppText style={{ fontSize: ty.caption, color: p.muted }}>
              {t("loads.rack.rungs", { n: isolateLtr(String(values.length)) })}
            </AppText>
          </View>
        ) : null}
      </View>

      {/* Rungs Grid */}
      {values.length === 0 && invalid.length === 0 ? (
        <View style={{ padding: space.md, borderRadius: radius.button, backgroundColor: p.raised, alignItems: "center" }}>
          <AppText style={{ fontSize: ty.caption, color: p.muted }}>
            {t("loads.rack.empty")}
          </AppText>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, direction: "ltr" }}>
          {values.map((v) => {
            const isSelected = v === selectedLoad;
            const text = weightText(v, "kg");
            return (
              <Pressable
                key={'val_' + v}
                accessibilityRole="button"
                accessibilityLabel={text + ' ' + unitText}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                onPress={() => {
                  haptics.selection();
                  onSelectLoad(v);
                }}
                style={({ pressed }) => ({
                  minHeight: 40,
                  minWidth: 44,
                  paddingHorizontal: space.sm,
                  borderRadius: radius.button,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: isSelected ? p.tint : pressed ? p.raised : p.card,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? p.accent : p.border,
                })}
              >
                <AppText
                  ltr={!/[\u0600-\u06FF]/.test(text)}
                  style={{
                    fontSize: ty.label,
                    fontWeight: isSelected ? "800" : "600",
                    fontVariant: ["tabular-nums"],
                    color: isSelected ? p.accent : p.text,
                  }}
                >
                  {text}
                </AppText>
              </Pressable>
            );
          })}

          {invalid.map((bad, i) => (
            <View
              key={'bad_' + i}
              style={{
                minHeight: 40,
                minWidth: 44,
                paddingHorizontal: space.sm,
                borderRadius: radius.button,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "transparent",
                borderWidth: 1.5,
                borderColor: p.danger,
              }}
            >
              <AppText
                style={{
                  fontSize: ty.label,
                  fontWeight: "600",
                  color: p.danger,
                  textDecorationLine: "line-through",
                }}
              >
                {bad}
              </AppText>
            </View>
          ))}
        </View>
      )}

      {/* Selected Rung Inspector */}
      {selectedLoad !== null ? (
        <View
          style={{
            marginTop: space.xs,
            padding: space.sm,
            borderRadius: radius.button,
            backgroundColor: p.raised,
            borderWidth: 1,
            borderColor: p.border,
            gap: space.xs,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>
              {t("loads.rack.selected")}: {isolateLtr(`${selectedLoad} ${unitText}`)}
            </AppText>
            {delta !== null ? (
              <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: p.tint }}>
                <AppText style={{ fontSize: 11, fontWeight: "700", color: p.accent }}>
                  {t("loads.rack.stepDelta", { step: isolateLtr(String(delta)), unit: unitText })}
                </AppText>
              </View>
            ) : null}
          </View>

          {/* Barbell Plate Art */}
          {equipment === "barbell" && selectedPlates.length > 0 ? (
            <View style={{ marginTop: 2, gap: 4 }}>
              <BarArt perSide={selectedPlates} unit={unit} height={50} />
              <AppText style={{ fontSize: 11, color: p.muted, textAlign: "center" }}>
                {t("plates.each", { plates: isolateLtr(selectedPlates.join(" · ")) })}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
