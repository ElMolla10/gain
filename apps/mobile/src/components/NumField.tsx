import React, { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { AppText } from "../ui";
import { MIN_TOUCH, space, usePalette } from "../theme";

/**
 * A number the lifter can type. The text lives here (so "6", "62." and "62.5" can be typed on the way) and the parent gets the parsed
 * value, or null while the text is empty or not a number. When the parent changes the value (a stepper, a new draft) the text follows.
 */
export function NumField<T extends number>(props: {
  label: string;
  value: T | null;
  /** Value to show as text. */
  format: (v: T) => string;
  /** Text to value; null for empty / invalid. */
  parse: (s: string, current: T | null) => T | null;
  onValue: (v: T | null) => void;
  decimal?: boolean;
  fontSize?: number;
  width?: number;
  placeholder?: string;
}) {
  const p = usePalette();
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
    <View style={{ gap: space.xs, width: props.width, flexGrow: props.width ? 0 : 1 }}>
      <AppText style={{ color: p.muted, fontSize: 13 }}>{props.label}</AppText>
      <TextInput
        accessibilityLabel={props.label}
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
          minHeight: MIN_TOUCH,
          borderWidth: 2,
          borderColor: bad ? p.warn : p.edge,
          borderRadius: 12,
          paddingHorizontal: space.sm,
          fontSize: props.fontSize ?? 24,
          fontWeight: "600",
          color: p.text,
          backgroundColor: p.card,
          textAlign: "center",
          writingDirection: "ltr",
        }}
      />
    </View>
  );
}
