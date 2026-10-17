import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, PanResponder, Pressable, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { useI18n } from "../i18n";
import { numberPadAccessory } from "../numberPad";
import { Icon } from "./Icon";
import { INPUT_HEIGHT, radius, space, type as ty, useLogPalette } from "../theme";
import { AppText, QuietAction, Sheet, useInputFont } from "../ui";

/**
 * Small building blocks of the active workout screen (icons live in components/Icon.tsx).
 */

/**
 * A number the lifter types straight into the table cell: no label, no steppers. Keeps the text while typing ("62." on the way to "62.5"),
 * reports the parsed value (null for empty / invalid) and shows `placeholder` (the ghost target) while the box is empty.
 */
export function CellInput<T extends number>(props: {
  a11y: string;
  value: T | null;
  format: (v: T) => string;
  parse: (s: string, current: T | null) => T | null;
  onValue: (v: T | null, invalid: boolean) => void;
  placeholder?: string;
  decimal?: boolean;
  /** The row is ticked: the box loses its well so the row reads as finished, not as a form still to fill. */
  done?: boolean;
  /** The set the lifter is on: the box gets an outline so it stands out from the wash behind it. */
  current?: boolean;
  /** A small caption above the box (unit or column name). */
  unitLabel?: string;
  /** A typed value that is not saved yet (the row is not ticked): a 2 dp warn underline, because unticked rows are dropped at Finish. */
  pending?: boolean;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
  focusNonce?: number;
}) {
  const p = useLogPalette();
  const font = useInputFont("600");
  const { t } = useI18n();
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(props.value === null ? "" : props.format(props.value));
  const seen = useRef<T | null>(props.value);
  useEffect(() => {
    if (props.value !== seen.current) {
      seen.current = props.value;
      if (props.value !== props.parse(text, props.value)) setText(props.value === null ? "" : props.format(props.value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  useEffect(() => {
    if (props.autoFocus) inputRef.current?.focus();
  }, [props.autoFocus, props.focusNonce]);
  const bad = text.trim() !== "" && props.parse(text, props.value) === null;
  return (
    <View style={[{ flex: 1, gap: 2 }, props.style]}>
      {props.unitLabel ? <AppText style={{ color: p.muted, fontSize: 13, textAlign: "center" }}>{props.unitLabel}</AppText> : null}
      <TextInput
        ref={inputRef}
        accessibilityLabel={props.a11y}
        accessibilityHint={bad ? t("workout.input.invalid") : props.placeholder ? t("workout.input.target", { value: props.placeholder }) : undefined}
        value={text}
        onChangeText={(s) => {
          setText(s);
          const v = props.parse(s, props.value);
          seen.current = v;
          props.onValue(v, s.trim() !== "" && v === null);
        }}
        keyboardType={props.decimal ? "decimal-pad" : "number-pad"}
        {...numberPadAccessory(t)}
        selectTextOnFocus
        placeholder={props.placeholder ?? "—"}
        placeholderTextColor={p.edge /* ghost targets are hints: quieter than a typed value (L-4) */}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); if (bad) AccessibilityInfo.announceForAccessibility(t("workout.input.invalid")); }}
        style={{
          ...font,
          minHeight: INPUT_HEIGHT,
          borderRadius: radius.input,
          borderWidth: bad || focused ? 2 : props.current ? 1.5 : 0,
          borderColor: bad ? p.warn : focused ? p.accent : p.edge,
          ...(props.pending && !bad && !focused ? { borderBottomWidth: 2, borderBottomColor: p.warn } : null),
          paddingHorizontal: 4,
          paddingVertical: 0,
          // Typed weight and reps are the numbers read at arm's length: 20 semibold with tabular figures, so widths don't jump (L-1).
          fontSize: ty.section,
          fontVariant: ["tabular-nums"],
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
export function SwipeRow(props: { children: React.ReactNode; deleteLabel: string; deleteA11y?: string; onDelete: () => void; background: string }) {
  const { direction } = useI18n();
  const p = useLogPalette();
  const W = 84;
  const sign = direction === "rtl" ? 1 : -1; // dragging toward the "end" edge
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const snap = (to: number) => {
    open.current = to !== 0;
    setRevealed(open.current);
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
      <View accessibilityElementsHidden={!revealed} importantForAccessibility={revealed ? "auto" : "no-hide-descendants"} style={{ position: "absolute", top: 0, bottom: 0, end: 0, width: W, backgroundColor: p.danger, alignItems: "center", justifyContent: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={props.deleteA11y ?? props.deleteLabel} onPress={props.onDelete} style={{ flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" }}>
          <AppText style={{ color: p.onDanger, fontWeight: "600", fontSize: 14 }}>{props.deleteLabel}</AppText>
        </Pressable>
      </View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }], backgroundColor: props.background }}>
        {props.children}
      </Animated.View>
    </View>
  );
}

/**
 * An action sheet built on the shared Sheet: heading, explicit close button, Android back dismisses. Ordinary choices are rows in the
 * body; destructive ones (danger) are set apart in the footer.
 */
export function MenuSheet(props: { visible: boolean; title: string; /** Kept for callers: sheet headings always wrap. */ wrapTitle?: boolean; onClose: () => void; items: { label: string; danger?: boolean; selected?: boolean; onPress: () => void }[] }) {
  const p = useLogPalette();
  const row = (it: { label: string; danger?: boolean; selected?: boolean; onPress: () => void }, i: number) => (
    <Pressable
      key={`${i}:${it.label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: !!it.selected }}
      onPress={() => {
        props.onClose();
        it.onPress();
      }}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.button, backgroundColor: pressed ? p.field : "transparent" })}
    >
      <AppText style={{ flex: 1, fontSize: 16, fontWeight: it.selected ? "600" : "400", color: it.danger ? p.danger : p.text }}>{it.label}</AppText>
      {it.selected ? <Icon name="check" color={p.accent} size={22} /> : null}
    </Pressable>
  );
  const normal = props.items.filter((x) => !x.danger);
  const danger = props.items.filter((x) => x.danger);
  return (
    <Sheet visible={props.visible} title={props.title} onClose={props.onClose} footer={danger.length > 0 ? <>{danger.map((d, i) => row(d, i))}</> : undefined}>
      <View style={{ gap: 2 }}>{normal.map((it, i) => row(it, i))}</View>
    </Sheet>
  );
}

/**
 * The target of one exercise as a single compact line: "Target  55 kg × 9  [Why]". It wraps onto a second line when the text is large and
 * is never cut off. "Why" is quiet (accent text, no frame) but keeps a 48 dp touch area. The suggested weight follows it when available; `reason` shows under the line while `expanded`.
 */
export function TargetLine(props: { label: string; value: string; whyLabel: string; whyA11y: string; suggestedLabel?: string; suggestedValue?: string; onWhy: () => void; onWhyLong?: () => void; expanded?: boolean; reason?: string;
  /** Optional compact toggle for the Next-set details (closed by default). */ moreLabel?: string; moreA11y?: string; moreExpanded?: boolean; onMore?: () => void }) {
  const p = useLogPalette();
  const { direction } = useI18n();
  return (
    <View style={{ gap: 2 }}>
      {/* Line 1: label, value, Why. Line 2 (only when the card exists): "Next set details" with an end chevron. The two controls never
          share a wrap row (L-11). */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.sm }}>
        <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.label}</AppText>
        <AppText style={{ fontSize: ty.section, fontWeight: "600", flexShrink: 1, fontVariant: ["tabular-nums"] }}>{props.value}</AppText>
        <QuietAction label={props.whyLabel} icon="why" accessibilityLabel={props.whyA11y} expanded={props.expanded} onPress={props.onWhy} onLongPress={props.onWhyLong} />
      </View>
      {props.suggestedLabel ? (
        <AppText style={{ fontSize: 13, color: p.muted }}>
          {props.suggestedLabel}{props.suggestedValue ? <AppText style={{ color: p.accent, fontSize: 13, fontWeight: "600" }}> {props.suggestedValue}</AppText> : null}
        </AppText>
      ) : null}
      {props.moreLabel && props.onMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.moreA11y ?? props.moreLabel}
          accessibilityState={{ expanded: !!props.moreExpanded }}
          onPress={props.onMore}
          style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.button, backgroundColor: pressed ? p.field : "transparent" })}
        >
          <AppText style={{ flex: 1, fontSize: ty.label, fontWeight: "600", color: p.accent }}>{props.moreLabel}</AppText>
          <View style={{ transform: [{ rotate: props.moreExpanded ? (direction === "rtl" ? "-90deg" : "90deg") : "0deg" }] }}>
            <Icon name="chevron" color={p.accent} size={18} mirror />
          </View>
        </Pressable>
      ) : null}
      {props.expanded && props.reason ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.reason}</AppText> : null}
    </View>
  );
}

/** The per-exercise rest-timer switch: timer icon + the length (or "Off"). The spoken label says it all; 48 dp tall. */
export function RestToggle(props: { text: string; off: boolean; a11y: string; onPress: () => void }) {
  const p = useLogPalette();
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={props.a11y} accessibilityState={{ checked: !props.off }} onPress={props.onPress} style={({ pressed }) => ({ minHeight: 48, minWidth: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, paddingHorizontal: space.sm, borderRadius: radius.button, backgroundColor: pressed ? p.field : "transparent" })}>
      <Icon name="timer" color={props.off ? p.muted : p.accent} size={18} />
      <AppText ltr={!props.off} style={{ color: props.off ? p.muted : p.accent, fontWeight: "600", fontSize: ty.label }}>{props.text}</AppText>
    </Pressable>
  );
}
