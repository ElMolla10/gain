import { useFocusEffect } from "@react-navigation/native";
import type { WeekPulse } from "@gain/engine";
import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useServices } from "../../AppContext";
import { diagnostics } from "../../diagnostics";
import { useI18n } from "../../i18n";
import { pickDecision, type WeekDecision } from "../../logic/todayWeek";
import { MIN_TOUCH, radius, space, type as ty, usePalette } from "../../theme";
import { AppText, Sheet } from "../../ui";
import { DeloadCard } from "../DeloadCard";
import { Icon } from "../Icon";
import { MuscleVolumeCard } from "../MuscleVolumeCard";
import { PeriodizationCard } from "../PeriodizationCard";
import { WeeklyReviewCard } from "../WeeklyReviewCard";
import { WeekSleeve } from "../achievements/WeekSleeve";

/**
 * This week on Today: the r2 week sleeve from the CHEAP pulse query (`achievements.getPulse`, never the full achievements load), "x of y planned
 * sessions", the pace line, at most ONE decision card, and a row that opens this week's sets by muscle in a sheet. No badge level.
 */
export function WeekBlock({ pace, onPace }: { pace: string; onPace: () => void }) {
  const { achievements, history, weekly, deload, weeklyPlan } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [pulse, setPulse] = useState<WeekPulse | null>(null);
  const [planned, setPlanned] = useState<{ done: number; goal: number | null } | null>(null);
  const [decision, setDecision] = useState<WeekDecision | null>(null);
  const [musclesOpen, setMusclesOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const tz = -new Date().getTimezoneOffset() * 60_000;
      void Promise.all([
        achievements.getPulse().catch(() => null),
        history.getPersonalProgress().catch(() => null),
        weekly.getDue(Date.now(), tz).catch(() => null),
        deload.getState(Date.now(), tz).catch(() => null),
        weeklyPlan.getActive(Date.now()).catch(() => null),
      ])
        .then(([pu, pr, due, dl, plan]) => {
          if (!alive) return;
          setPulse(pu);
          setPlanned(pr ? { done: pr.done, goal: pr.goal } : null);
          setDecision(pickDecision({ weeklyDue: !!due, deloadStatus: dl?.status ?? null, planActive: !!plan }));
        })
        .catch((e) => diagnostics.record("warn", "today week", e));
      return () => {
        alive = false;
      };
    }, [achievements, history, weekly, deload, weeklyPlan]),
  );

  const row = (label: string, onPress: () => void, a11y?: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.button, backgroundColor: pressed ? p.raised : "transparent" })}
    >
      <AppText style={{ flex: 1, fontSize: ty.label, color: p.muted }}>{label}</AppText>
      <Icon name="chevron" color={p.muted} size={18} mirror />
    </Pressable>
  );

  return (
    <View style={{ gap: space.sm }}>
      {pulse ? <WeekSleeve qualifiedDays={pulse.qualifiedDays} dayTarget={pulse.dayTarget} /> : null}
      {pulse?.qualified ? <AppText style={{ fontSize: ty.label }}>{t("today.week.in")}</AppText> : null}
      {planned && planned.goal !== null ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("today.week.planned", { done: planned.done, goal: planned.goal })}</AppText> : null}
      {pace ? row(pace, onPace, `${t("goals.entry")}: ${pace}`) : null}
      {decision === "weekly" || decision === "planActive" ? <WeeklyReviewCard /> : decision === "deload" ? <DeloadCard /> : decision === "periodization" ? <PeriodizationCard /> : null}
      {row(t("today.week.muscles"), () => setMusclesOpen(true))}
      <Sheet visible={musclesOpen} title={t("today.week.muscles")} onClose={() => setMusclesOpen(false)}>
        <MuscleVolumeCard />
      </Sheet>
    </View>
  );
}
