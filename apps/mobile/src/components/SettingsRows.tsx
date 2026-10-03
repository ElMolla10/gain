import React from "react";
import { Pressable, Switch, View } from "react-native";
import { Icon } from "./Icon";
import { MIN_TOUCH, radius, space, type as ty, usePalette } from "../theme";
import { AppText, Card } from "../ui";

/** A titled group of settings rows (Training, Display, Data, About) on one card, rows separated by hairlines. */
export function Group(props: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>
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
    <View style={{ paddingVertical: space.md, gap: space.sm, borderBottomWidth: 1, borderColor: p.border }}>
      {props.title ? <AppText style={{ fontSize: ty.body, fontWeight: "600" }}>{props.title}</AppText> : null}
      {props.note ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.note}</AppText> : null}
      {props.children}
    </View>
  );
}

/** A tappable row that opens another screen. */
export function LinkRow(props: { label: string; note?: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.raised : "transparent" })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontSize: ty.body }}>{props.label}</AppText>
        {props.note ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.note}</AppText> : null}
      </View>
      <Icon name="chevron" color={p.muted} size={20} mirror />
    </Pressable>
  );
}

/** An on/off setting: the whole row is the target. The switch is the picture; the row carries the role and state for TalkBack. */
export function SwitchRow(props: { label: string; note?: string; value: boolean; onChange: (on: boolean) => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={props.label}
      accessibilityState={{ checked: props.value }}
      onPress={() => props.onChange(!props.value)}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.raised : "transparent" })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontSize: ty.body }}>{props.label}</AppText>
        {props.note ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.note}</AppText> : null}
      </View>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch accessibilityLabel={props.label} value={props.value} trackColor={{ true: p.fill, false: p.edge }} thumbColor={props.value ? p.onFill : p.card} />
      </View>
    </Pressable>
  );
}

/** A compact selector: a label above a row of 2-3 segments (one stays selected; the selected one also shows a check, not colour alone). */
export function SelectRow<T extends string>(props: { label: string; note?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const p = usePalette();
  return (
    <View style={{ paddingVertical: space.md, gap: space.sm, borderBottomWidth: 1, borderColor: p.border }}>
      <AppText style={{ fontSize: ty.body }}>{props.label}</AppText>
      <View style={{ flexDirection: "row", borderWidth: 1.5, borderColor: p.edge, borderRadius: radius.button, overflow: "hidden" }}>
        {props.options.map((o, i) => {
          const on = o.value === props.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => props.onChange(o.value)}
              style={{ flex: 1, minHeight: MIN_TOUCH, flexDirection: "row", gap: space.xs, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, paddingVertical: space.xs, backgroundColor: on ? p.fill : "transparent", borderStartWidth: i === 0 ? 0 : 1.5, borderColor: p.edge }}
            >
              {on ? <Icon name="check" color={p.onFill} size={16} /> : null}
              <AppText style={{ fontSize: ty.bodySmall, fontWeight: "600", textAlign: "center", color: on ? p.onFill : p.text, flexShrink: 1 }}>{o.label}</AppText>
            </Pressable>
          );
        })}
      </View>
      {props.note ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.note}</AppText> : null}
    </View>
  );
}
