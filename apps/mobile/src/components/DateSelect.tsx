import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "./Icon";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { dayOptions, joinIso, monthOptions, setPart, splitIso, yearOptions, type DateParts } from "../logic/datePick";
import { MIN_TOUCH, radius, space, usePalette } from "../theme";
import { AppText, BigButton, Sheet } from "../ui";

type Part = keyof DateParts;

/**
 * A date picked from three selectors (day, month, year), never typed. Only a complete, real calendar date is reported
 * (as YYYY-MM-DD); while a part is missing the value is "" (not set). Plain React Native Modal + list: no native module,
 * works offline and follows the screen direction.
 */
export function DateSelect(props: { label: string; value: string; onChange: (iso: string) => void; years: "past" | "future"; span?: number; minAge?: number; hint?: string }) {
  const { t } = useI18n();
  const p = usePalette();
  const [parts, setParts] = useState<DateParts>(() => splitIso(props.value));
  const [open, setOpen] = useState<Part | null>(null);
  // The value can arrive after the first render (a saved goal loading): follow it, but never wipe a half-picked date.
  useEffect(() => {
    setParts((cur) => (props.value === joinIso(cur) ? cur : splitIso(props.value)));
  }, [props.value]);

  const change = (part: Part, v: number | null) => {
    const next = setPart(parts, part, v);
    setParts(next);
    props.onChange(joinIso(next));
    setOpen(null);
  };
  const options = (part: Part): number[] => (part === "d" ? dayOptions(parts) : part === "m" ? monthOptions() : yearOptions(props.years, Date.now(), props.span ?? 100, props.minAge ?? 0));
  const shown = (part: Part, n: number): string => (part === "m" ? t(`date.month.${n}` as StringKey) : String(n));
  const partName = (part: Part) => t(part === "d" ? "date.day" : part === "m" ? "date.month" : "date.year");

  const box = (part: Part, grow: number) => (
    <Pressable
      key={part}
      accessibilityRole="button"
      accessibilityLabel={`${props.label}: ${partName(part)}`}
      onPress={() => setOpen(part)}
      style={{ flex: grow, minHeight: MIN_TOUCH, borderWidth: 1.5, borderColor: p.edge, borderRadius: radius.button, backgroundColor: p.raised, justifyContent: "center", paddingHorizontal: space.sm }}
    >
      <AppText style={{ color: parts[part] === null ? p.muted : p.text, fontWeight: "600", textAlign: "center" }} numberOfLines={1}>
        {parts[part] === null ? partName(part) : shown(part, parts[part]!)}
      </AppText>
    </Pressable>
  );

  return (
    <View style={{ gap: space.xs }}>
      <AppText style={{ fontWeight: "600" }}>{props.label}</AppText>
      {props.hint ? <AppText style={{ color: p.muted, fontSize: 13 }}>{props.hint}</AppText> : null}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {box("d", 1)}
        {box("m", 2)}
        {box("y", 1.3)}
      </View>
      {parts.y !== null || parts.m !== null || parts.d !== null ? (
        <BigButton
          label={t("date.clear")}
          variant="quiet"
          onPress={() => {
            setParts({ y: null, m: null, d: null });
            props.onChange("");
          }}
        />
      ) : null}
      <Sheet visible={open !== null} title={open ? t("date.choose", { part: partName(open) }) : ""} onClose={() => setOpen(null)}>
        {open
          ? options(open).map((item) => {
              const on = parts[open] === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => change(open, item)}
                  style={({ pressed }) => ({ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm, borderRadius: radius.button, backgroundColor: on ? p.fill : pressed ? p.raised : "transparent" })}
                >
                  <AppText style={{ fontWeight: on ? "700" : "400", color: on ? p.onFill : p.text, flex: 1 }}>{shown(open, item)}</AppText>
                  {on ? <Icon name="check" color={p.onFill} size={20} /> : null}
                </Pressable>
              );
            })
          : null}
      </Sheet>
    </View>
  );
}
