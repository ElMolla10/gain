import React, { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { dayOptions, joinIso, monthOptions, setPart, splitIso, yearOptions, type DateParts } from "../logic/datePick";
import { MIN_TOUCH, space, usePalette } from "../theme";
import { AppText, BigButton } from "../ui";

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
      style={{ flex: grow, minHeight: MIN_TOUCH, borderWidth: 2, borderColor: p.border, borderRadius: 12, backgroundColor: p.card, justifyContent: "center", paddingHorizontal: space.sm }}
    >
      <AppText style={{ color: parts[part] === null ? p.muted : p.text, fontWeight: "700", textAlign: "center" }} numberOfLines={1}>
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
          selected={false}
          onPress={() => {
            setParts({ y: null, m: null, d: null });
            props.onChange("");
          }}
        />
      ) : null}
      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: space.lg }}>
          <View style={{ backgroundColor: p.card, borderRadius: 16, padding: space.md, maxHeight: "80%", gap: space.sm }}>
            {open ? (
              <>
                <AppText style={{ fontSize: 20, fontWeight: "800" }}>{t("date.choose", { part: partName(open) })}</AppText>
                <FlatList
                  data={options(open)}
                  keyExtractor={(n) => String(n)}
                  initialNumToRender={20}
                  renderItem={({ item }) => (
                    <Pressable accessibilityRole="button" onPress={() => change(open, item)} style={{ minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.sm, borderBottomWidth: 1, borderColor: p.border, backgroundColor: parts[open] === item ? p.accent : "transparent" }}>
                      <AppText style={{ fontSize: 18, fontWeight: parts[open] === item ? "800" : "500", color: parts[open] === item ? p.accentText : p.text }}>{shown(open, item)}</AppText>
                    </Pressable>
                  )}
                />
                <BigButton label={t("common.cancel")} selected={false} onPress={() => setOpen(null)} />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
