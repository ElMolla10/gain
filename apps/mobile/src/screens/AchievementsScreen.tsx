import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import type { LiftItem } from "../db/historyRepo";
import { useI18n } from "../i18n";
import { exerciseLabels, formatLoad } from "../i18n/format";
import { badgeStatus, BREAKTHROUGH_BADGES, consistencyAchievementStats, GOAL_BADGES, MONTH_BADGES, TRAINING_BADGES, WEEK_BADGES, YEAR_BADGES, type Breakthrough } from "../logic/achievementProgress";
import type { pathFromSessionStrengths } from "../logic/exercisePath";
import type { ConsistencyProgress, PersonalMilestone } from "../logic/personalProgress";
import { targetPhrase } from "../logic/quantity";
import { localDateText } from "../logic/trendChart";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, EmptyState, ErrorState, ListRow, LoadingState, Screen } from "../ui";

interface Data {
  consistency: ConsistencyProgress;
  breakthroughs: Breakthrough[];
  trainingDates: number[];
  reachedGoals: { id: string; exerciseId: string; nameEn: string; nameAr: string; load: number; reps: number; reachedAt: number }[];
  goals: { lift: LiftItem; goal: PersonalMilestone }[];
  paths: { lift: LiftItem; path: NonNullable<ReturnType<typeof pathFromSessionStrengths>> }[];
}

/** A separate Progress destination: every reward is rebuilt from trusted saved history. */
export function AchievementsScreen() {
  const { history } = useServices();
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (name: string, params: object) => void }>();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    let alive = true;
    setFailed(false);
    void (async () => {
      const [consistency, breakthroughs, lifts, trainingDates, reachedGoals, exercisePaths] = await Promise.all([
        history.getPersonalProgress(), history.getStrengthBreakthroughs(), history.listLifts(),
        history.getAchievementDays(), history.getReachedWeightGoals(), history.getExercisePaths(),
      ]);
      const candidates = lifts.filter(lift => lift.setup !== "assisted").slice(0, 8);
      const results = await Promise.all(candidates.map(async lift => ({ lift, goal: await history.getLiftGoal(lift.lineId) })));
      if (alive) setData({ consistency, breakthroughs, trainingDates, reachedGoals,
        goals: results.filter((row): row is { lift: LiftItem; goal: PersonalMilestone } => row.goal !== null).slice(0, 3),
        paths: exercisePaths.flatMap(path => {
          const lift = lifts.find(l => l.lineId === path.lineId);
          return lift ? [{ lift, path }] : [];
        }).sort((a, b) => b.path.score - a.path.score),
      });
    })().catch(error => { diagnostics.record("warn", "achievements", error); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [history, attempt]));

  if (failed) return <ErrorState title={t("achievements.error")} body={t("progress.loadingFailed")}
    retryLabel={t("history.error.retry")} onRetry={() => setAttempt(n => n + 1)} />;
  if (!data) return <LoadingState />;
  const { consistency, breakthroughs, goals, reachedGoals, paths } = data;
  const cadence = consistencyAchievementStats(data.trainingDates, Date.now(), consistency.startsOn);
  const days = badgeStatus(consistency.activeDays, TRAINING_BADGES);
  const strength = badgeStatus(breakthroughs.length, BREAKTHROUGH_BADGES);
  const weeks = badgeStatus(cadence.qualifiedWeeks, WEEK_BADGES);
  const months = badgeStatus(cadence.activeMonths, MONTH_BADGES);
  const years = badgeStatus(cadence.consistentYears, YEAR_BADGES);
  const weightGoals = badgeStatus(reachedGoals.length, GOAL_BADGES);
  const target = (row: Data["goals"][number]) => targetPhrase(row.goal.load, row.goal.quantity, row.lift.measure,
    kg => formatLoad(kg, lang, unit), { s: t("qty.s"), m: t("qty.m") });

  return <Screen title={t("achievements.title")}>
    <Card>
      <AppText style={{ color: p.muted }}>{t("achievements.week")}</AppText>
      <AppText ltr style={{ fontSize: ty.load, fontWeight: "600", color: p.accent }}>
        {consistency.goal === null ? String(consistency.done) : `${consistency.done}/${consistency.goal}`}
      </AppText>
      <AppText>{t(consistency.achieved ? "progress.goalDone" : "progress.rest")}</AppText>
      {consistency.goal !== null ? <ProgressBar value={Math.min(1, consistency.done / consistency.goal)} label={t("progress.weekCount", { done: consistency.done, goal: consistency.goal })} /> : null}
    </Card>

    <Card>
      <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("path.title")}</AppText>
      <AppText style={{ color: p.muted }}>{t("path.listRule")}</AppText>
      {paths.length ? paths.map(({ lift, path }, i) => <ListRow key={lift.lineId}
        title={exerciseLabels(lift, lang).primary}
        note={`${t(`path.tier.${path.tier}`)} · ${path.score}`}
        last={i === paths.length - 1}
        onPress={() => nav.navigate("LiftTrend", { lineId: lift.lineId })} />)
        : <AppText style={{ color: p.muted }}>{t("path.empty")}</AppText>}
    </Card>

    <Card>
      <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("achievements.next")}</AppText>
      {days.next !== null ? <BadgeProgress title={t("achievements.trainingDays")} count={consistency.activeDays} next={days.next} progress={days.progress} /> : null}
      {weeks.next !== null ? <BadgeProgress title={t("achievements.weeks")} count={cadence.qualifiedWeeks} next={weeks.next} progress={weeks.progress} /> : null}
      {months.next !== null ? <BadgeProgress title={t("achievements.months")} count={cadence.activeMonths} next={months.next} progress={months.progress} /> : null}
      {years.next !== null ? <BadgeProgress title={t("achievements.years")} count={cadence.consistentYears} next={years.next} progress={cadence.nextYearProgress} /> : null}
      {strength.next !== null ? <BadgeProgress title={t("achievements.breakthroughs")} count={breakthroughs.length} next={strength.next} progress={strength.progress} /> : null}
      {weightGoals.next !== null ? <BadgeProgress title={t("achievements.weightGoals")} count={reachedGoals.length} next={weightGoals.next} progress={weightGoals.progress} /> : null}
      {days.next === null && weeks.next === null && months.next === null && years.next === null && strength.next === null && weightGoals.next === null ? <AppText>{t("achievements.allEarned")}</AppText> : null}
    </Card>

    <Card>
      <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("achievements.badges")}</AppText>
      <AppText style={{ color: p.muted }}>{t("achievements.badgesNote")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {TRAINING_BADGES.map(n => <Badge key={`d${n}`} label={t("achievements.daysBadge", { n })} earned={consistency.activeDays >= n} />)}
      </View>
      <AppText style={{ fontWeight: "600" }}>{t("achievements.weeks")}</AppText>
      <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("achievements.weekRule")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {WEEK_BADGES.map(n => <Badge key={`w${n}`} label={t("achievements.weeksBadge", { n })} earned={cadence.qualifiedWeeks >= n} />)}
      </View>
      <AppText style={{ fontWeight: "600" }}>{t("achievements.months")}</AppText>
      <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("achievements.monthRule")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {MONTH_BADGES.map(n => <Badge key={`m${n}`} label={t("achievements.monthsBadge", { n })} earned={cadence.activeMonths >= n} />)}
      </View>
      <AppText style={{ fontWeight: "600" }}>{t("achievements.years")}</AppText>
      <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("achievements.yearRule")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {YEAR_BADGES.map(n => <Badge key={`y${n}`} label={t("achievements.yearsBadge", { n })} earned={cadence.consistentYears >= n} />)}
      </View>
      <AppText style={{ fontWeight: "600" }}>{t("achievements.breakthroughs")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {BREAKTHROUGH_BADGES.map(n => <Badge key={`p${n}`} label={t("achievements.prBadge", { n })} earned={breakthroughs.length >= n} />)}
      </View>
      <AppText style={{ fontWeight: "600" }}>{t("achievements.weightGoals")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {GOAL_BADGES.map(n => <Badge key={`g${n}`} label={t("achievements.goalsBadge", { n })} earned={reachedGoals.length >= n} />)}
      </View>
    </Card>

    {reachedGoals.length ? <Card>
      <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("achievements.goalsReached")}</AppText>
      {reachedGoals.slice(0, 5).map(goal => <AppText key={goal.id}>
        {exerciseLabels(goal, lang).primary}: {formatLoad(goal.load, lang, unit)} × {goal.reps} · {localDateText(goal.reachedAt)}
      </AppText>)}
    </Card> : null}

    <Card>
      <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("achievements.monthGoals")}</AppText>
      {goals.length ? goals.map(({ lift, goal }) => <View key={lift.lineId} style={{ gap: space.xs }}>
        <ListRow title={exerciseLabels(lift, lang).primary} note={t(goal.reached ? "progress.reached" : "achievements.goalTarget", { target: target({ lift, goal }) })}
          onPress={() => nav.navigate("LiftTrend", { lineId: lift.lineId })} />
        <ProgressBar value={goal.progress} label={t("progress.milestone", { target: target({ lift, goal }) })} />
      </View>) : <AppText style={{ color: p.muted }}>{t("progress.noExerciseGoal")}</AppText>}
    </Card>

    <Card>
      <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("achievements.recent")}</AppText>
      {breakthroughs.length ? breakthroughs.slice(0, 5).map((event, index) => <ListRow key={`${event.lineId}:${event.at}:${index}`}
        title={exerciseLabels(event, lang).primary}
        note={`${localDateText(event.at)} · ${t(event.assisted ? "achievements.lessAssistance" : "achievements.heavier", {
          before: formatLoad(event.previous, lang, unit), after: formatLoad(event.load, lang, unit),
        })}`}
        onPress={() => nav.navigate("LiftTrend", { lineId: event.lineId })} />)
        : <EmptyState icon="progress" title={t("achievements.noBreakthroughs")} />}
    </Card>
  </Screen>;
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const p = usePalette();
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    style={{ height: 8, borderRadius: 4, backgroundColor: p.border, overflow: "hidden" }}>
    <View style={{ height: 8, width: `${Math.round(value * 100)}%`, backgroundColor: p.accent }} />
  </View>;
}

function BadgeProgress({ title, count, next, progress }: { title: string; count: number; next: number; progress: number }) {
  const { t } = useI18n();
  return <View style={{ gap: space.xs }}>
    <AppText style={{ fontWeight: "600" }}>{title}: {t("achievements.countTo", { count, next })}</AppText>
    <ProgressBar value={progress} label={`${title}: ${count}/${next}`} />
  </View>;
}

function Badge({ label, earned }: { label: string; earned: boolean }) {
  const p = usePalette();
  const { t } = useI18n();
  return <View accessible accessibilityLabel={`${label}. ${t(earned ? "achievements.earned" : "achievements.locked")}`}
    style={{ borderRadius: 12, borderWidth: 1, borderColor: earned ? p.accent : p.border,
      backgroundColor: earned ? p.tint : p.card, padding: space.sm, minWidth: 110, flexGrow: 1, gap: space.xs }}>
    <AppText style={{ fontWeight: "600", color: earned ? p.accent : p.muted }}>{earned ? "◆" : "◇"} {label}</AppText>
    <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t(earned ? "achievements.earned" : "achievements.locked")}</AppText>
  </View>;
}
