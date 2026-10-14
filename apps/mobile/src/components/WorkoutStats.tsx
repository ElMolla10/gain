import React, { memo, useEffect, useState } from "react";
import { View, type TextStyle } from "react-native";
import { useI18n } from "../i18n";
import { formatDuration } from "../logic/liveSummary";
import { formatClock, remainingMs, type RestTimer } from "../logic/restTimer";
import { useLogPalette } from "../theme";
import { AppText } from "../ui";

/**
 * The rest-timer readout. It ticks every 250 ms on its own (P27), so the logger screen is not re-rendered four times a second while a
 * rest counts down. The timer value (an end time) is owned by the screen; this only reads it.
 */
export const RestClock = memo(function RestClock({ timer, style }: { timer: RestTimer; style: TextStyle }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (timer.endsAt === null) return;
    setNow(Date.now());
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, [timer.endsAt]);
  return (
    <AppText ltr accessibilityRole="timer" style={style}>
      {formatClock(remainingMs(timer, now))}
    </AppText>
  );
});

/** Ticks once a second on its own, so the rest of the screen does not re-render every second. */
export function LiveDuration({ startedAt, color }: { startedAt: number; color: string }) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  return (
    <AppText ltr style={{ fontSize: 20, fontWeight: "600", color }}>
      {formatDuration(now - startedAt, { h: t("workout.dur.h"), m: t("workout.dur.m"), s: t("workout.dur.s") })}
    </AppText>
  );
}

export function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  const p = useLogPalette();
  return (
    <View style={{ gap: 2, minWidth: 74 }}>
      <AppText style={{ color: p.muted, fontSize: 13 }}>{label}</AppText>
      {children}
    </View>
  );
}

