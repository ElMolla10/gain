import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, PanResponder, Pressable, ScrollView, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import { useI18n } from "../i18n";
import { useLogPalette } from "../theme";
import { AppText } from "../ui";

/**
 * Small building blocks of the active workout screen. Icons are drawn with Views (no icon font to ship, and they flip cleanly in RTL).
 */

/** Chevron pointing down (the "collapse" button). */
export function ChevronDown({ size = 12, color }: { size?: number; color: string }) {
  return <View style={{ width: size, height: size, borderRightWidth: 2.5, borderBottomWidth: 2.5, borderColor: color, transform: [{ rotate: "45deg" }, { translateY: -size / 5 }, { translateX: -size / 5 }] }} />;
}

/** Vertical three dots. */
export function Dots({ color }: { color: string }) {
  return (
    <View style={{ gap: 3.5, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
}

/** A small stopwatch: ring, crown and a hand. */
export function Stopwatch({ size = 18, color }: { size?: number; color: string }) {
  return (
    <View style={{ width: size, height: size + 3, alignItems: "center", justifyContent: "flex-end" }}>
      <View style={{ position: "absolute", top: 0, width: size * 0.35, height: 2.5, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, alignItems: "center" }}>
        <View style={{ marginTop: 2, width: 2, height: size * 0.3, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

/** A tick drawn with two borders (no font dependence). */
export function Tick({ size = 14, color }: { size?: number; color: string }) {
  return <View style={{ width: size * 0.55, height: size, borderRightWidth: 3, borderBottomWidth: 3, borderColor: color, transform: [{ rotate: "45deg" }, { translateY: -size * 0.12 }] }} />;
}

/**
 * A number the lifter types straight into the table cell: no label, no steppers. Keeps the text while typing ("62." on the way to "62.5"),
 * reports the parsed value (null for empty / invalid) and shows `placeholder` (the ghost target) while the box is empty.
 */
export function CellInput<T extends number>(props: {
  a11y: string;
  value: T | null;
  format: (v: T) => string;
  parse: (s: string, current: T | null) => T | null;
  onValue: (v: T | null) => void;
  placeholder?: string;
  decimal?: boolean;
  done?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useLogPalette();
  const [text, setText] = useState(props.value === null ? "" : props.format(props.value));
  const seen = useRef<T | null>(props.value);
  useEffect(() => {
    if (props.value !== seen.current) {
      seen.current = props.value;
      if (props.value !== props.parse(text, props.value)) setText(props.value === null ? "" : props.format(props.value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  const bad = text.trim() !== "" && props.parse(text, props.value) === null;
  return (
    <View style={[{ flex: 1 }, props.style]}>
      <TextInput
        accessibilityLabel={props.a11y}
        value={text}
        onChangeText={(s) => {
          setText(s);
          const v = props.parse(s, props.value);
          seen.current = v;
          props.onValue(v);
        }}
        keyboardType={props.decimal ? "decimal-pad" : "number-pad"}
        selectTextOnFocus
        placeholder={props.placeholder ?? "—"}
        placeholderTextColor={p.muted}
        style={{
          height: 42,
          borderRadius: 8,
          borderWidth: bad ? 2 : 0,
          borderColor: p.warn,
          paddingHorizontal: 4,
          paddingVertical: 0,
          fontSize: 17,
          fontWeight: "700",
          color: p.text,
          backgroundColor: props.done ? "transparent" : p.field,
          textAlign: "center",
          writingDirection: "ltr",
        }}
      />
    </View>
  );
}

/**
 * Swipe a row toward the end side to reveal "Delete". Opening is deliberate (drag past a third of the button), and deleting is a second
 * tap, so a stray vertical scroll or a half swipe never removes a set. Works in both directions of reading.
 */
export function SwipeRow(props: { children: React.ReactNode; deleteLabel: string; onDelete: () => void; background: string }) {
  const { direction } = useI18n();
  const p = useLogPalette();
  const W = 84;
  const sign = direction === "rtl" ? 1 : -1; // dragging toward the "end" edge
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const snap = (to: number) => {
    open.current = to !== 0;
    Animated.spring(x, { toValue: to, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderMove: (_, g) => {
          const base = open.current ? sign * W : 0;
          const v = base + g.dx;
          x.setValue(sign === -1 ? Math.max(-W, Math.min(0, v)) : Math.min(W, Math.max(0, v)));
        },
        onPanResponderRelease: (_, g) => {
          const base = open.current ? sign * W : 0;
          const v = Math.abs(base + g.dx);
          snap(v > W / 3 ? sign * W : 0);
        },
        onPanResponderTerminate: () => snap(open.current ? sign * W : 0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sign],
  );
  return (
    <View style={{ overflow: "hidden" }}>
      <View style={{ position: "absolute", top: 0, bottom: 0, end: 0, width: W, backgroundColor: p.danger, alignItems: "center", justifyContent: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={props.deleteLabel} onPress={props.onDelete} style={{ flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" }}>
          <AppText style={{ color: p.onDanger, fontWeight: "700", fontSize: 14 }}>{props.deleteLabel}</AppText>
        </Pressable>
      </View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }], backgroundColor: props.background }}>
        {props.children}
      </Animated.View>
    </View>
  );
}

/** A small action sheet: tap outside to close. */
export function MenuSheet(props: { visible: boolean; title: string; onClose: () => void; items: { label: string; danger?: boolean; onPress: () => void }[] }) {
  const p = useLogPalette();
  const { t } = useI18n();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={props.onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: p.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 12, paddingBottom: 28, gap: 4 }}>
          <AppText numberOfLines={1} style={{ color: p.muted, fontSize: 14, paddingHorizontal: 12, paddingVertical: 8 }}>{props.title}</AppText>
          <ScrollView style={{ maxHeight: height * 0.6 }} keyboardShouldPersistTaps="handled">
          {props.items.map((it, i) => (
            <Pressable
              key={`${i}:${it.label}`}
              accessibilityRole="button"
              onPress={() => {
                props.onClose();
                it.onPress();
              }}
              style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10 }}
            >
              <AppText style={{ fontSize: 17, fontWeight: "600", color: it.danger ? p.danger : p.text }}>{it.label}</AppText>
            </Pressable>
          ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}
