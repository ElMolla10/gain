import React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import type { RestTimer } from "../logic/restTimer";
import { radius, space, type as ty, useLogPalette } from "../theme";
import { AppText } from "../ui";
import { Icon } from "./Icon";
import { RestClock } from "./WorkoutStats";

/** Sticky layout child; only RestClock re-renders on countdown ticks. */
export function RestTimerBar({ timer, restFor, restOver, onAdjust, onToggle }: {
  timer: RestTimer; restFor: string | null; restOver: boolean;
  onAdjust: (seconds: number) => void; onToggle: () => void;
}) {
  const { t } = useI18n();
  const p = useLogPalette();
  const insets = useSafeAreaInsets();
  const timerRunning = timer.endsAt !== null;
  const over = restOver && !timerRunning;
  return (
        // Rest over (L-9): the dock turns tint with a 4 dp accent top edge, and the clock becomes "Rest is over" + check at 28 semibold:
        // text and icon, not colour alone. The haptic fires elsewhere (PR 231).
        <View style={{ backgroundColor: over ? p.activeBg : p.card, borderTopWidth: over ? 4 : 1, borderColor: over ? p.accent : p.line, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, gap: space.xs }}>
          {restFor ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
              <Icon name="timer" color={p.muted} size={16} />
              <AppText style={{ color: p.muted, fontSize: 13, flexShrink: 1 }}>{restFor}</AppText>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: space.sm, rowGap: space.sm }}>
            {over ? (
              <View accessibilityLiveRegion="polite" accessible accessibilityLabel={t("workout.rest.done")} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48 }}>
                <Icon name="check" color={p.accent} size={28} />
                <AppText style={{ fontSize: ty.title, fontWeight: "600", color: p.text }}>{t("workout.rest.done")}</AppText>
              </View>
            ) : (
              <RestClock timer={timer} style={{ fontSize: 36, fontWeight: "600", minWidth: 110, color: p.text }} />
            )}
            <View style={{ flexDirection: "row", gap: space.sm, flexGrow: 1, flexBasis: 220 }}>
              {[-15, 15].map((d) => ( /* symmetric: +15 then −15 is the original duration */
                <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${d > 0 ? "+" : "−"}${Math.abs(d)} ${t("qty.s")}`} onPress={() => onAdjust(d)} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.button, borderWidth: 1.5, borderColor: p.edge, backgroundColor: pressed ? p.line : p.field, alignItems: "center", justifyContent: "center" })}>
                  <AppText ltr style={{ fontWeight: "600", fontSize: 16 }}>{d > 0 ? `+${d}` : `−${-d}`}</AppText>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: timerRunning }}
                onPress={onToggle}
                style={({ pressed }) => ({ flex: 1.4, minHeight: 48, borderRadius: radius.button, backgroundColor: pressed ? p.fillPressed : p.fill, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm })}
              >
                <AppText style={{ color: p.onFill, fontWeight: "600", textAlign: "center" }}>{timerRunning ? t("workout.rest.stop") : t("workout.rest.start")}</AppText>
              </Pressable>
            </View>
          </View>
        </View>
  );
}
