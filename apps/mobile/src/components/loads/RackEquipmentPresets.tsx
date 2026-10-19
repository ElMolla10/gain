import React from "react";
import { Pressable, View } from "react-native";
import type { GymLoadSpec } from "@gain/engine";
import { useI18n } from "../../i18n";
import type { Unit } from "../../logic/units";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { haptics } from "../../haptics";

export interface PresetOption {
  id: string;
  labelKey: string;
  preset: {
    mode: "step" | "list";
    stepText?: string;
    minText?: string;
    maxText?: string;
    listText?: string;
  };
}

export interface RackEquipmentPresetsProps {
  equipment: GymLoadSpec["equipment"];
  unit: Unit;
  onApplyPreset: (preset: PresetOption["preset"]) => void;
}

/**
 * Quick Equipment Presets:
 * Provides one-tap configuration for common gym dumbbell racks,
 * Olympic barbells with microplates, and selectorized machine stacks.
 */
export function RackEquipmentPresets({ equipment, unit, onApplyPreset }: RackEquipmentPresetsProps) {
  const { t } = useI18n();
  const p = usePalette();

  const presets: PresetOption[] = React.useMemo(() => {
    if (equipment === "dumbbell") {
      return [
        {
          id: "db2",
          labelKey: "loads.rack.preset.db2",
          preset: {
            mode: "list",
            listText: "10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40",
          },
        },
        {
          id: "db25",
          labelKey: "loads.rack.preset.db25",
          preset: {
            mode: "list",
            listText: "10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50",
          },
        },
        {
          id: "db5lb",
          labelKey: "loads.rack.preset.db5lb",
          preset: {
            mode: "list",
            listText: "20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100",
          },
        },
      ];
    }

    if (equipment === "barbell") {
      return [
        {
          id: "bar25",
          labelKey: "loads.rack.preset.bar25",
          preset: {
            mode: "step",
            stepText: unit === "lb" ? "5" : "2.5",
            minText: unit === "lb" ? "45" : "20",
            maxText: unit === "lb" ? "450" : "200",
          },
        },
        {
          id: "bar125",
          labelKey: "loads.rack.preset.bar125",
          preset: {
            mode: "step",
            stepText: unit === "lb" ? "2.5" : "1.25",
            minText: unit === "lb" ? "45" : "20",
            maxText: unit === "lb" ? "450" : "200",
          },
        },
      ];
    }

    return [
      {
        id: "stack5",
        labelKey: "loads.rack.preset.stack5",
        preset: {
          mode: "step",
          stepText: unit === "lb" ? "10" : "5",
          minText: unit === "lb" ? "10" : "5",
          maxText: unit === "lb" ? "200" : "100",
        },
      },
      {
        id: "stack25",
        labelKey: "loads.rack.preset.stack25",
        preset: {
          mode: "step",
          stepText: unit === "lb" ? "5" : "2.5",
          minText: unit === "lb" ? "10" : "5",
          maxText: unit === "lb" ? "160" : "80",
        },
      },
    ];
  }, [equipment, unit]);

  return (
    <View style={{ gap: space.xs }}>
      <AppText
        style={{
          fontSize: ty.caption,
          fontWeight: "600",
          color: p.muted,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {t("loads.rack.presets")}
      </AppText>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
        {presets.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={t(item.labelKey as any)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => {
              haptics.selection();
              onApplyPreset(item.preset);
            }}
            style={({ pressed }) => ({
              minHeight: 36,
              paddingHorizontal: space.sm,
              paddingVertical: 6,
              borderRadius: radius.button,
              backgroundColor: pressed ? p.tint : p.raised,
              borderWidth: 1,
              borderColor: p.border,
              justifyContent: "center",
              alignItems: "center",
            })}
          >
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.text }}>
              ⚡ {t(item.labelKey as any)}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
