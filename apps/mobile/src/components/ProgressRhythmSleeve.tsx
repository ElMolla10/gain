import React from "react";
import { View } from "react-native";
import { useI18n } from "../i18n";
import { formatNumber } from "../logic/dateText";
import { isolateLtr } from "../i18n/format";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, Card } from "../ui";
import { Icon } from "./Icon";

export interface RhythmSession {
  finishedAt: number;
  pr?: boolean;
}

export interface ProgressRhythmSleeveProps {
  sessions: RhythmSession[];
  now?: number;
}

/** 04:00 rollover logical day key (same logical day boundary as Today and Achievements). */
export function rhythmDayKey(ms: number): string {
  const d = new Date(ms - 4 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 28-Day Training Rhythm Sleeve (Page 3: The Lifter's Chronicle).
 * Streakless, zero-shame, evidence-first visualizer of volume and cadence.
 * Shows 4 rolling 7-day microcycles with workout dots, PR glows and recovery rings.
 */
export function ProgressRhythmSleeve({ sessions, now }: ProgressRhythmSleeveProps) {
  const { t, lang } = useI18n();
  const p = usePalette();
  const ref = now ?? Date.now();

  const sessionMap = new Map<string, { count: number; hasPr: boolean }>();
  for (const s of sessions) {
    const k = rhythmDayKey(s.finishedAt);
    const existing = sessionMap.get(k);
    if (!existing) {
      sessionMap.set(k, { count: 1, hasPr: !!s.pr });
    } else {
      existing.count += 1;
      if (s.pr) existing.hasPr = true;
    }
  }

  const points: { key: string; dayIndex: number; hasWorkout: boolean; hasPr: boolean; isToday: boolean }[] = [];
  const todayLogical = rhythmDayKey(ref);

  for (let offset = 27; offset >= 0; offset--) {
    const dayMs = ref - offset * 86_400_000;
    const k = rhythmDayKey(dayMs);
    const entry = sessionMap.get(k);
    points.push({
      key: k,
      dayIndex: 27 - offset,
      hasWorkout: !!entry && entry.count > 0,
      hasPr: !!entry && entry.hasPr,
      isToday: k === todayLogical,
    });
  }

  const workoutsInWindow = points.filter((pt) => pt.hasWorkout).length;
  const weeklyCadence = (workoutsInWindow / 28) * 7;
  const cadenceFormatted = formatNumber(weeklyCadence, lang, 1);

  const weeks: (typeof points)[] = [];
  for (let w = 0; w < 4; w++) {
    weeks.push(points.slice(w * 7, (w + 1) * 7));
  }

  return (
    <Card
      accessible
      accessibilityRole="summary"
      accessibilityLabel={t("history.rhythm.a11y", { workouts: workoutsInWindow, avg: cadenceFormatted })}
      style={{ padding: space.md, gap: space.sm }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
          <Icon name="progress" color={p.muted} size={16} />
          <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, letterSpacing: 0.4 }}>
            {t("history.rhythm.title")}
          </AppText>
        </View>
        <View style={{ minHeight: 22, paddingHorizontal: space.sm, borderRadius: radius.button, backgroundColor: p.tint, justifyContent: "center", alignItems: "center" }}>
          <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent }}>
            {t("history.rhythm.cadence", { n: isolateLtr(cadenceFormatted) })}
          </AppText>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: space.xs }}>
        {weeks.map((week, wIdx) => (
          <View key={wIdx} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {week.map((day) => {
              const bg = day.hasPr ? p.fill : day.hasWorkout ? p.text : "transparent";
              const border = day.hasPr ? p.fillEdge : day.hasWorkout ? "transparent" : p.edge;
              const borderWidth = day.hasPr ? 1 : day.hasWorkout ? 0 : 1.5;
              return (
                <View
                  key={day.dayIndex}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 4.5,
                    backgroundColor: bg,
                    borderColor: border,
                    borderWidth,
                    ...(day.isToday && !day.hasWorkout ? { borderColor: p.accent, borderWidth: 2 } : {}),
                  }}
                />
              );
            })}
            {wIdx < 3 ? (
              <View style={{ width: 1, height: 12, backgroundColor: p.border, marginLeft: space.xs, marginRight: 2 }} />
            ) : null}
          </View>
        ))}
      </View>

      <AppText style={{ fontSize: ty.caption, color: p.muted }}>
        {workoutsInWindow === 0 ? t("history.rhythm.empty") : t("history.rhythm.subtext", { count: isolateLtr(String(workoutsInWindow)) })}
      </AppText>
    </Card>
  );
}
