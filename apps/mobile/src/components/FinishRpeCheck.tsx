import React from "react";
import { Pressable, View } from "react-native";
import { haptics } from "../haptics";
import { useI18n } from "../i18n";
import { MIN_TOUCH, radius, space, type as ty, usePalette } from "../theme";
import { AppText, Card } from "../ui";

export type RpeOption = "smooth" | "target" | "heavy";

export function FinishRpeCheck({
  value,
  onChange,
}: {
  value: RpeOption | null;
  onChange: (opt: RpeOption) => void;
}) {
  const { t } = useI18n();
  const p = usePalette();

  const options: { id: RpeOption; label: string }[] = [
    { id: "smooth", label: t("finish.rpe.smooth") },
    { id: "target", label: t("finish.rpe.target") },
    { id: "heavy", label: t("finish.rpe.heavy") },
  ];

  return (
    <Card>
      <View style={{ gap: space.sm }}>
        <AppText accessibilityRole="header" style={{ fontWeight: "600", fontSize: ty.section }}>
          {t("finish.rpe.title")}
        </AppText>
        <View style={{ flexDirection: "row", gap: space.xs }}>
          {options.map((opt) => {
            const selected = value === opt.id;
            return (
              <Pressable
                key={opt.id}
                accessibilityRole="button"
                accessibilityLabel={t("finish.rpe.a11y", { option: opt.label })}
                accessibilityState={{ selected }}
                onPress={() => {
                  haptics.selection();
                  onChange(opt.id);
                }}
                style={{
                  flex: 1,
                  minHeight: MIN_TOUCH,
                  borderRadius: radius.card,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: space.sm,
                  paddingHorizontal: space.xs,
                  backgroundColor: selected ? p.tint : p.raised,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? p.accent : p.edge,
                }}
              >
                <AppText
                  style={{
                    fontSize: ty.label,
                    fontWeight: selected ? "600" : "400",
                    color: selected ? p.accent : p.text,
                    textAlign: "center",
                  }}
                >
                  {opt.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Card>
  );
}
