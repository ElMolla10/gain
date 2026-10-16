import React, { memo, useEffect, useState } from "react";
import { Pressable, View, type TextStyle } from "react-native";
import { useI18n } from "../i18n";
import { formatDuration } from "../logic/liveSummary";
import { formatClock, remainingMs, type RestTimer } from "../logic/restTimer";
import { elapsedMs } from "../logic/workoutClock";
import { MIN_TOUCH, useLogPalette } from "../theme";
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

/** Ticks once a second on its own, so the rest of the screen does not re-render every second. Frozen while paused. */
export function LiveDuration({
  startedAt,
  pausedMs = 0,
  pausedAt = null,
  color,
  onToggle,
}: {
  startedAt: number;
  pausedMs?: number;
  pausedAt?: number | null;
  color: string;
  onToggle?: () => void;
}) {
  const { t } = useI18n();
  const paused = pausedAt != null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (paused) return;
    setNow(Date.now());
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [paused]);
  const text = formatDuration(elapsedMs(startedAt, pausedMs, pausedAt, now), { h: t("workout.dur.h"), m: t("workout.dur.m"), s: t("workout.dur.s") });
  const action = paused ? t("workout.dur.resume") : t("workout.dur.pause");
  const label = paused
    ? `${t("workout.stat.duration")}, ${text}, ${t("workout.stat.paused")}. ${action}`
    : `${t("workout.stat.duration")}, ${text}. ${action}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: paused }}
      onPress={onToggle}
      disabled={!onToggle}
      style={{ minHeight: MIN_TOUCH, justifyContent: "center" }}
    >
      <AppText ltr style={{ fontSize: 20, fontWeight: "600", color }}>
        {text}
      </AppText>
      {paused ? <AppText style={{ fontSize: 13, color }}>{t("workout.stat.paused")}</AppText> : null}
    </Pressable>
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

