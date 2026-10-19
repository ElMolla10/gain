import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { barbellPlates, type GymLoadSpec } from "@gain/engine";
import { useI18n } from "../i18n";
import { formatLoad, isolateLtr, NBSP } from "../i18n/format";
import { parseNumber } from "../logic/gymInput";
import { kgToUnit, unitToKg, weightText } from "../logic/units";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, Field, SegmentedTabs } from "../ui";
import { BarArt } from "./today/BarArt";
import { Icon } from "./Icon";
import { haptics } from "../haptics";

export interface BarbellPlateStudioProps {
  spec: GymLoadSpec | null | undefined;
}

/** Standard Olympic bar denominations in kg. */
const BARS = [
  { id: "mens", kg: 20, labelKey: "plates.bar.mens" as const },
  { id: "womens", kg: 15, labelKey: "plates.bar.womens" as const },
  { id: "power", kg: 25, labelKey: "plates.bar.power" as const },
  { id: "ez", kg: 10, labelKey: "plates.bar.ez" as const },
];

/** Standard Olympic plate denominations with authentic competition color cues. */
const STANDARD_PLATES_KG = [
  { kg: 25, color: "#D32F2F", textDark: false }, // a11y-ok: Olympic plate standard
  { kg: 20, color: "#1976D2", textDark: false }, // a11y-ok: Olympic plate standard
  { kg: 15, color: "#FBC02D", textDark: true }, // a11y-ok: Olympic plate standard
  { kg: 10, color: "#388E3C", textDark: false }, // a11y-ok: Olympic plate standard
  { kg: 5, color: "#E0E0E0", textDark: true }, // a11y-ok: Olympic plate standard
  { kg: 2.5, color: "#424242", textDark: false }, // a11y-ok: Olympic plate standard
  { kg: 1.25, color: "#9E9E9E", textDark: true }, // a11y-ok: Olympic plate standard
  { kg: 0.5, color: "#FFA000", textDark: true }, // a11y-ok: Olympic plate standard
];

export function BarbellPlateStudio({ spec }: BarbellPlateStudioProps) {
  const { t, lang, unit, unitText } = useI18n();
  const p = usePalette();

  const [mode, setMode] = useState<"target" | "tally">("target");
  const [barKg, setBarKg] = useState<number>(spec?.min ?? 20);
  const [targetInput, setTargetInput] = useState<string>("100");
  const [tallyPlates, setTallyPlates] = useState<number[]>([20, 20]); // per side

  // 1. Target Mode calculations
  const parsedTarget = parseNumber(targetInput);
  const targetKg = parsedTarget !== null ? unitToKg(parsedTarget, unit) : null;
  const targetSpec: GymLoadSpec = {
    equipment: "barbell",
    min: barKg,
    increment: spec?.increment ?? 2.5,
    plates: spec?.plates ?? [25, 20, 15, 10, 5, 2.5, 1.25],
  };
  const targetCalc = targetKg !== null && targetKg >= barKg ? barbellPlates(targetSpec, targetKg) : null;
  const targetPerSide = targetCalc ? targetCalc.perSide : [];

  const adjustTarget = (deltaKg: number) => {
    haptics.selection();
    const cur = targetKg ?? barKg;
    const nextKg = Math.max(barKg, Math.round((cur + deltaKg) * 10) / 10);
    const converted = kgToUnit(nextKg, unit);
    setTargetInput(String(Math.round(converted * 10) / 10));
  };

  // 2. Reverse Tally Mode calculations
  const tallyTotalKg = barKg + 2 * tallyPlates.reduce((acc, plate) => acc + plate, 0);
  const tallyDisplayWeight = formatLoad(tallyTotalKg, lang, unit);

  const addPlatePair = (plateKg: number) => {
    haptics.selection();
    setTallyPlates((cur) => [...cur, plateKg]);
  };

  const stripOuterPlate = () => {
    haptics.selection();
    setTallyPlates((cur) => (cur.length > 0 ? cur.slice(0, -1) : cur));
  };

  const clearBar = () => {
    haptics.selection();
    setTallyPlates([]);
  };

  const activePerSide = mode === "target" ? targetPerSide : tallyPlates;
  const activeTotalKg = mode === "target" ? (targetCalc ? targetCalc.load : barKg) : tallyTotalKg;

  return (
    <View style={{ gap: space.md }}>
      {/* Mode Selector */}
      <SegmentedTabs
        value={mode}
        options={[
          { value: "target", label: t("plates.mode.target") },
          { value: "tally", label: t("plates.mode.tally") },
        ]}
        onChange={setMode}
      />

      {/* Barbell Visualizer Studio */}
      <Card style={{ paddingVertical: space.md, alignItems: "center", gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: space.sm }}>
          <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, letterSpacing: 0.5 }}>
            {t("plates.totalWeight")}
          </AppText>
          <AppText style={{ fontSize: ty.section, fontWeight: "600", fontVariant: ["tabular-nums"], color: p.text }}>
            {formatLoad(activeTotalKg, lang, unit)}
          </AppText>
        </View>

        {/* Dynamic Barbell SVG Art */}
        <View style={{ width: "100%", height: 110, justifyContent: "center", alignItems: "center" }}>
          <BarArt perSide={activePerSide} unit={unit} height={105} width="100%" />
        </View>

        {/* Per-Side Stack Description */}
        <View style={{ paddingHorizontal: space.sm, width: "100%" }}>
          <AppText style={{ fontSize: ty.label, color: p.muted, textAlign: "center" }}>
            {activePerSide.length === 0
              ? t("plates.bar")
              : t("plates.each", { plates: activePerSide.map((k) => formatLoad(k, lang, unit)).join(" + ") })}
          </AppText>
        </View>
      </Card>

      {/* Bar Tare Selection */}
      <View style={{ gap: space.xs }}>
        <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>
          {t("plates.barWeight", { weight: weightText(barKg, unit) })}
        </AppText>
        <View style={{ flexDirection: "row", gap: space.xs, flexWrap: "wrap" }}>
          {BARS.map((b) => {
            const isSelected = barKg === b.kg;
            return (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  haptics.selection();
                  setBarKg(b.kg);
                }}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                style={({ pressed }) => ({
                  minHeight: 38,
                  paddingHorizontal: space.sm,
                  borderRadius: radius.button,
                  borderWidth: 1,
                  borderColor: isSelected ? p.accent : p.border,
                  backgroundColor: isSelected ? p.tint : pressed ? p.raised : p.card,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <AppText style={{ fontSize: ty.caption, fontWeight: isSelected ? "600" : "400", color: isSelected ? p.accent : p.text }}>
                  {t(b.labelKey)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Mode Controls */}
      {mode === "target" ? (
        <Card style={{ gap: space.sm }}>
          <Field
            label={t("plates.load")}
            value={targetInput}
            onChangeText={setTargetInput}
            numeric
            hint={unitText}
          />

          <View style={{ flexDirection: "row", gap: space.xs, justifyContent: "space-between" }}>
            {[-10, -2.5, 2.5, 10].map((delta) => (
              <Pressable
                key={delta}
                accessibilityRole="button"
                onPress={() => adjustTarget(delta)}
                hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 44,
                  borderRadius: radius.button,
                  backgroundColor: pressed ? p.raised : p.card,
                  borderWidth: 1,
                  borderColor: p.border,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <AppText style={{ fontSize: ty.body, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                  {delta > 0 ? `+${isolateLtr(String(delta))}` : isolateLtr(String(delta))}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : (
        <Card style={{ gap: space.md }}>
          <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>
            {t("gyms.platePalette.title")}
          </AppText>

          {/* Plate Tree Buttons */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {STANDARD_PLATES_KG.map((plate) => {
              const displayWeight = isolateLtr(String(kgToUnit(plate.kg, unit)));
              return (
                <Pressable
                  key={plate.kg}
                  accessibilityRole="button"
                  accessibilityLabel={`+${displayWeight} ${unitText} pair`}
                  onPress={() => addPlatePair(plate.kg)}
                  style={({ pressed }) => ({
                    minWidth: 70,
                    minHeight: 48,
                    flex: 1,
                    borderRadius: radius.button,
                    backgroundColor: plate.color,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: space.sm,
                    opacity: pressed ? 0.75 : 1,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.2)",
                  })}
                >
                  <AppText style={{ fontSize: ty.body, fontWeight: "600", color: plate.textDark ? plate.textDark ? p.onFill : p.card }}>
                    +${displayWeight}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Reverse Tally Action Buttons */}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <BigButton
                variant="secondary"
                label={t("plates.stripOuter")}
                disabled={tallyPlates.length === 0}
                onPress={stripOuterPlate}
              />
            </View>
            <View style={{ flex: 1 }}>
              <BigButton
                variant="secondary"
                label={t("plates.clearBar")}
                disabled={tallyPlates.length === 0}
                onPress={clearBar}
              />
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}
