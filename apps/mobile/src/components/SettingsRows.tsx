import React from "react";
import { Pressable, Switch, View } from "react-native";
import { useI18n } from "../i18n";
import { MIN_TOUCH, space, type as ty, usePalette } from "../theme";
import { AppText, Card } from "../ui";

/** A titled group of settings rows (Training, Display, Data, About) on one card, rows separated by hairlines. */
export function Group(props: { title: string; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ gap: space.sm }}>
      <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "800", color: p.accent }}>
        {props.title}
      </AppText>
      <Card style={{ paddingVertical: 0, gap: 0 }}>{props.children}</Card>
    </View>
  );
}

/** A block inside a group that holds its own controls (steppers, chips). */
export function Block(props: { title?: string; note?: string; children?: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ paddingVertical: space.md, gap: space.sm, borderBottomWidth: 1, borderColor: p.edge }}>
      {props.title ? <AppText style={{ fontSize: ty.body, fontWeight: "700" }}>{props.title}</AppText> : null}
      {props.note ? <AppText style={{ fontSize: ty.secondary, color: p.muted }}>{props.note}</AppText> : null}
      {props.children}
    </View>
  );
}

/** A tappable row that opens another screen. */
export function LinkRow(props: { label: string; note?: string; onPress: () => void }) {
  const p = usePalette();
  const { isRTL } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={{ minHeight: MIN_TOUCH + 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: p.edge }}
    >
      <View style={{ flex: 1 }}>
        <AppText style={{ fontSize: ty.body }}>{props.label}</AppText>
        {props.note ? <AppText style={{ fontSize: ty.secondary, color: p.muted }}>{props.note}</AppText> : null}
      </View>
      <AppText style={{ fontSize: ty.section, color: p.muted }}>{isRTL ? "‹" : "›"}</AppText>
    </Pressable>
  );
}

/** An on/off setting: the whole row is the target. */
export function SwitchRow(props: { label: string; note?: string; value: boolean; onChange: (on: boolean) => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={props.label}
      accessibilityState={{ checked: props.value }}
      onPress={() => props.onChange(!props.value)}
      style={{ minHeight: MIN_TOUCH + 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: p.edge }}
    >
      <View style={{ flex: 1 }}>
        <AppText style={{ fontSize: ty.body }}>{props.label}</AppText>
        {props.note ? <AppText style={{ fontSize: ty.secondary, color: p.muted }}>{props.note}</AppText> : null}
      </View>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch accessibilityLabel={props.label} value={props.value} trackColor={{ true: p.accent, false: p.edge }} thumbColor={props.value ? p.accentText : p.muted} />
      </View>
    </Pressable>
  );
}

/** A compact selector: a label above a row of 2-3 segments (one stays selected). */
export function SelectRow<T extends string>(props: { label: string; note?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const p = usePalette();
  return (
    <View style={{ paddingVertical: space.sm, gap: space.xs, borderBottomWidth: 1, borderColor: p.edge }}>
      <AppText style={{ fontSize: ty.body }}>{props.label}</AppText>
      <View style={{ flexDirection: "row", borderWidth: 1, borderColor: p.edge, borderRadius: 12, overflow: "hidden" }}>
        {props.options.map((o, i) => {
          const on = o.value === props.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => props.onChange(o.value)}
              style={{ flex: 1, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, backgroundColor: on ? p.accent : "transparent", borderStartWidth: i === 0 ? 0 : 1, borderColor: p.edge }}
            >
              <AppText style={{ fontSize: ty.bodySmall, fontWeight: "600", textAlign: "center", color: on ? p.accentText : p.text }}>{o.label}</AppText>
            </Pressable>
          );
        })}
      </View>
      {props.note ? <AppText style={{ fontSize: ty.secondary, color: p.muted }}>{props.note}</AppText> : null}
    </View>
  );
}
