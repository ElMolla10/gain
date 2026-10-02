import React from "react";
import { Pressable, Text, View, type TextProps, type ViewStyle } from "react-native";
import { useI18n } from "./i18n";
import { MIN_TOUCH, space, usePalette } from "./theme";

/** Text that follows the active writing direction. Pass `ltr` for numbers / Latin names that must keep their order. */
export function AppText({ ltr, style, ...rest }: TextProps & { ltr?: boolean }) {
  const { direction } = useI18n();
  const p = usePalette();
  return <Text {...rest} style={[{ color: p.text, fontSize: 16, writingDirection: ltr ? "ltr" : direction }, style]} />;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const p = usePalette();
  return (
    <View style={[{ backgroundColor: p.card, borderColor: p.border, borderWidth: 1, borderRadius: 16, padding: space.md, gap: space.sm }, style]}>
      {children}
    </View>
  );
}

export function BigButton(props: { label: string; onPress?: () => void; disabled?: boolean; selected?: boolean; accessibilityHint?: string }) {
  const p = usePalette();
  const filled = !props.disabled && (props.selected ?? true);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!props.disabled, selected: !!props.selected }}
      accessibilityHint={props.accessibilityHint}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        borderRadius: 14,
        paddingHorizontal: space.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: props.disabled ? p.disabled : filled ? p.accent : p.card,
        borderWidth: 2,
        borderColor: props.disabled ? p.disabled : p.accent,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText style={{ fontSize: 18, fontWeight: "700", color: filled ? p.accentText : p.text }}>{props.label}</AppText>
    </Pressable>
  );
}
