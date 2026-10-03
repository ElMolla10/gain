import React from "react";
import { Pressable, Text, TextInput, View, type KeyboardTypeOptions, type TextProps, type ViewStyle } from "react-native";
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

export function BigButton(props: { label: string; onPress?: () => void; disabled?: boolean; selected?: boolean; accessibilityHint?: string; /** The one primary action on a screen: taller, larger label. */ hero?: boolean }) {
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
        minHeight: props.hero ? 64 : MIN_TOUCH,
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
      <AppText style={{ fontSize: props.hero ? 20 : 18, fontWeight: "700", color: filled ? p.accentText : p.text }}>{props.label}</AppText>
    </Pressable>
  );
}

/** Labelled text field. Numbers stay left-to-right inside right-to-left layouts; the text itself follows the language. */
export function Field(props: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  numeric?: boolean;
  multiline?: boolean;
  hint?: string;
}) {
  const p = usePalette();
  const { direction } = useI18n();
  return (
    <View style={{ gap: space.xs }}>
      <AppText style={{ fontWeight: "600" }}>{props.label}</AppText>
      {props.hint ? <AppText style={{ color: p.muted, fontSize: 13 }}>{props.hint}</AppText> : null}
      <TextInput
        accessibilityLabel={props.label}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={p.muted}
        keyboardType={props.keyboardType ?? (props.numeric ? "decimal-pad" : "default")}
        multiline={props.multiline}
        style={{
          minHeight: MIN_TOUCH,
          borderWidth: 2,
          borderColor: p.border,
          borderRadius: 12,
          paddingHorizontal: space.md,
          fontSize: 18,
          color: p.text,
          backgroundColor: p.card,
          textAlign: props.numeric ? "left" : direction === "rtl" ? "right" : "left",
          writingDirection: props.numeric ? "ltr" : direction,
        }}
      />
    </View>
  );
}

/** Compact toggle. State is carried by a text mark as well as colour. */
export function Chip(props: { label: string; selected?: boolean; disabled?: boolean; onPress?: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!props.selected, disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={{
        opacity: props.disabled ? 0.4 : 1,
        minHeight: 48,
        borderRadius: 24,
        paddingHorizontal: space.md,
        justifyContent: "center",
        borderWidth: 2,
        borderColor: p.accent,
        backgroundColor: props.selected ? p.accent : p.card,
      }}
    >
      <AppText style={{ fontWeight: "600", color: props.selected ? p.accentText : p.text }}>{props.selected ? `✓ ${props.label}` : props.label}</AppText>
    </Pressable>
  );
}

/** Shown in Arabic only: the screen's Arabic text is a draft translation. */
export function ArDraftNote() {
  const { lang, t } = useI18n();
  const p = usePalette();
  if (lang !== "ar") return null;
  return <AppText style={{ color: p.muted, fontSize: 13 }}>{t("common.draftAr")}</AppText>;
}

/** Whole-number stepper with large − / + buttons. `value` stays readable left-to-right in RTL. */
export function Stepper(props: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; /** Size of one tap (default 1). */ step?: number }) {
  const step = props.step ?? 1;
  const p = usePalette();
  const btn = (txt: string, delta: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.label} ${txt}`}
      disabled={disabled}
      onPress={() => props.onChange(Math.min(props.max, Math.max(props.min, props.value + delta * step)))}
      style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: disabled ? p.disabled : p.accent, alignItems: "center", justifyContent: "center", backgroundColor: p.card }}
    >
      <AppText ltr style={{ fontSize: 20, fontWeight: "700", color: disabled ? p.disabled : p.text }}>{txt}</AppText>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
      <AppText style={{ fontWeight: "600", flexShrink: 1 }}>{props.label}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        {btn("−", -1, props.value <= props.min)}
        <AppText ltr style={{ minWidth: 36, textAlign: "center", fontSize: 20, fontWeight: "800" }}>{String(props.value)}</AppText>
        {btn("+", 1, props.value >= props.max)}
      </View>
    </View>
  );
}
