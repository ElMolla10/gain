import { quantityText } from "../logic/quantity";
import { leadTarget, targetText } from "../logic/nextTarget";
import type { TargetRow } from "../db/finishRepo";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { describePace } from "../logic/paceText";
import type { StringKey } from "../i18n/strings";
import { WeeklyReviewCard } from "../components/WeeklyReviewCard";
import { useServices } from "../AppContext";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import { estimateDayMinutes } from "../logic/duration";
import { loadRestSettings } from "../logic/restAlert";
import { useI18n } from "../i18n";
import { radius, space, type as ty, usePalette } from "../theme";
import { BrandLogo } from "../BrandLogo";
import { dayLabel, initialSelection, markSuggested, sessionAction, type DayChoice } from "../logic/dayChoice";
import { AppText, BigButton, Card, ChoiceSheet, EmptyState, ErrorState, InlineStatus, ListCard, LoadingState, QuietAction, Screen, SectionTitle } from "../ui";
import { HealthNote } from "../components/HealthNote";
import { diagnostics } from "../diagnostics";
import { LOADING, runLoad, type Load } from "../logic/loadState";

type DayExercises = Awaited<ReturnType<ReturnType<typeof useServices>["repos"]["listDayExercises"]>>;
interface TodayData {
  programmeName: string;
  isSample: boolean;
  days: (DayChoice & { list: DayExercises })[];
  suggestedId: string;
  /** The workout that is open right now, if any: it is resumed, another day is not started on top of it. */
  openDayId: string | null;
  /** Rest between sets in seconds (the time estimate counts it). */
  restSeconds: number;
  /** The targets already written for each day (after a finished workout, or once a day is started); none before that. */
  targets: Record<string, TargetRow[]>;
}

export function TodayScreen() {
  const { repos, goals, programmes, shortWeek, finish, workout } = useServices();
  const { t, lang, fmt, unit } = useI18n();
  const p = usePalette();
  const navigation = useNavigation<{ navigate: (name: "Workout" | "Goals" | "ShortWeek" | "Setup" | "Why", params?: { dayId: string } | { targetId: string }) => void }>();
  const [state, setState] = useState<Load<TodayData>>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const [paceLine, setPaceLine] = useState<string>("");
  const [short, setShort] = useState<{ days: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const { fontScale } = useWindowDimensions();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void runLoad<TodayData>(async () => {
        // A new training week has begun: the normal programme returns (if the lifter has not already edited it).
        await shortWeek.endIfExpired(Date.now(), -new Date().getTimezoneOffset() * 60_000).catch(() => undefined);
        const shortActive = await shortWeek.getActive();
        if (alive) setShort(shortActive);
        const next = await repos.getNextDay();
        if (!next) return null; // no programme at all: the genuinely empty state
        const dayList = await repos.listDays(next.versionId);
        const lists = await Promise.all(dayList.map((d) => repos.listDayExercises(d.id)));
        const marked = markSuggested(dayList.map((d, i) => ({ id: d.id, name: d.name, exercises: lists[i]!.length, sets: lists[i]!.reduce((n, e) => n + e.sets, 0) })), next.day.id);
        const open = await workout.getOpenSession();
        const targets: Record<string, TargetRow[]> = {};
        for (const d of dayList) {
          const planned = await finish.getPlannedSession(d.id);
          if (planned) targets[d.id] = await finish.getTargets(planned.id);
        }
        const active = await repos.getLatestProgrammeVersion();
        const pace = await goals.getPace(Date.now());
        const lib = pace.kind === "lift" ? await programmes.listExercises() : [];
        const ex = pace.kind === "lift" ? lib.find((e) => e.id === pace.goal.exerciseId) : undefined;
        if (alive) setPaceLine(pace.kind === "none" ? "" : describePace(pace, { t, fmt, exerciseName: ex ? exerciseLabels(ex, lang).primary : "", muscleName: (m) => t(`muscle.${m}` as StringKey) }).short);
        if (alive) setPicked((cur) => initialSelection(marked, next.day.id, open?.dayId ?? null, cur));
        return { programmeName: next.programmeName, isSample: active?.isSample ?? false, days: marked.map((d, i) => ({ ...d, list: lists[i]! })), suggestedId: next.day.id, openDayId: open?.dayId ?? null, restSeconds: (await loadRestSettings(repos)).seconds, targets };
      }, (e) => diagnostics.record("error", "today load", e)).then((r) => alive && setState(r));
      return () => {
        alive = false;
      };
    }, [repos, goals, programmes, shortWeek, workout, finish, t, fmt, lang, attempt]),
  );

  if (state.kind === "loading") return <LoadingState />;
  if (state.kind === "error") {
    return (
      <Screen tab>
        <ErrorState
          title={t("today.error.title")}
          body={t("today.error.body")}
          retryLabel={t("today.error.retry")}
          onRetry={() => {
            setState(LOADING);
            setAttempt((n) => n + 1);
          }}
        />
      </Screen>
    );
  }
  if (state.kind === "empty") {
    return (
      <Screen tab>
        <EmptyState icon="plan" title={t("today.empty")} actionLabel={t("today.setupPlan")} onAction={() => navigation.navigate("Setup")} />
      </Screen>
    );
  }
  const data = state.data;

  const chosen = data.days.find((d) => d.id === picked) ?? data.days[0]!;
  const exercises = chosen.list;
  const goalIds = new Set(exercises.filter((e) => e.isGoalLift).map((e) => e.exerciseId));
  const dayTargets = data.targets[chosen.id] ?? [];
  const byExercise = new Map(dayTargets.map((tg) => [tg.exerciseId, tg]));
  const lead = leadTarget(dayTargets, goalIds);
  const loadText = (kg: number) => fmt(kg);
  const letters = { s: t("qty.s"), m: t("qty.m") };
  const action = sessionAction(chosen.id, data.openDayId);
  const openDay = data.openDayId ? data.days.find((d) => d.id === data.openDayId) : undefined;
  const label = dayLabel(chosen, data.openDayId);
  const labelText = label === "inProgress" ? t("today.inProgress") : label === "suggested" ? t("today.suggestedToday") : t("today.yourChoice");
  const buttonText = action.kind === "start" ? t("today.start") : action.elsewhere && openDay ? t("today.resumeDay", { day: openDay.name }) : t("today.resume");

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      // Only a NEW workout gets its planned session and targets (planned sessions of other days are voided: missed days never stack).
      // An open workout is resumed as it is, whichever day is shown.
      if (action.kind === "start") {
        const gymId = await repos.getActiveGymId();
        if (gymId) await finish.planDay(action.dayId, gymId);
      }
      navigation.navigate("Workout", { dayId: action.dayId });
    } finally {
      setStarting(false);
    }
  }

  const stack = fontScale > 1.3;
  return (
    <Screen tab>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <BrandLogo size={32} />
        <AppText ltr style={{ fontSize: ty.section, fontWeight: "600", letterSpacing: 0.4 }}>
          {t("app.name")}
        </AppText>
      </View>

      {/* The session: what is suggested, how long, and the one action. Choosing another day is a compact action, not a row of chips. */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: space.sm }}>
          <AppText accessibilityLiveRegion="polite" style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent, letterSpacing: 0.4, flexShrink: 1 }}>{labelText}</AppText>
          {data.days.length > 1 ? <QuietAction label={t("today.change")} accessibilityLabel={t("today.changeLabel", { day: chosen.name })} onPress={() => setChangeOpen(true)} /> : null}
        </View>
        <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>{chosen.name}</AppText>
        {/* Separate runs, so a Latin programme name never scrambles the order of an Arabic sentence. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.xs }}>
          <AppText style={{ color: p.muted }}>{data.programmeName} ·</AppText>
          <AppText style={{ color: p.muted }}>{t("today.meta", { sets: chosen.sets, min: estimateDayMinutes({ exercises: chosen.exercises, sets: chosen.sets }, data.restSeconds) })}</AppText>
        </View>
        {action.kind === "resume" ? <InlineStatus kind={action.elsewhere ? "warn" : "info"} text={action.elsewhere ? t("today.finishOpenFirst") : t("today.openWorkout")} /> : null}
        <BigButton hero icon={action.kind === "start" ? "play" : undefined} label={buttonText} disabled={starting} loading={starting} onPress={() => void start()} />
        {data.isSample ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("today.sampleNote")}</AppText> : null}
      </Card>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t("today.targets")}</SectionTitle>
        {!lead ? <AppText style={{ color: p.muted }}>{t("today.noTargetsYet")}</AppText> : null}
        <Card style={{ paddingVertical: space.xs }}>
          {exercises.map((e, i) => {
            const l = exerciseLabels(e, lang);
            const tg = byExercise.get(e.exerciseId);
            const planned = e.measure === "reps" ? `${e.sets} × ${e.repMin}-${e.repMax}` : `${e.sets} × ${e.repMin}-${quantityText(e.repMax, e.measure, letters)}`;
            const target = tg && !(tg.status === "rejected") && tg.currency !== "none" && tg.effectiveLoad !== null ? targetText(tg, loadText, letters) : null;
            const isLead = !!lead && lead.exerciseId === e.exerciseId && target !== null;
            return (
              <View
                key={e.id}
                style={{ flexDirection: stack ? "column" : "row", justifyContent: "space-between", alignItems: stack ? "flex-start" : isLead ? "flex-start" : "center", gap: stack ? space.xs : space.md, minHeight: 56, paddingVertical: space.sm, paddingHorizontal: isLead ? space.md : 0, marginVertical: isLead ? space.xs : 0, borderRadius: isLead ? radius.button : 0, backgroundColor: isLead ? p.tint : "transparent", borderBottomWidth: i === exercises.length - 1 || isLead ? 0 : 1, borderColor: p.border }}
              >
                <View style={{ flex: stack ? 0 : 1, gap: 2 }}>
                  {isLead ? <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent, letterSpacing: 0.4 }}>{t("target.label")}</AppText> : null}
                  <AppText style={{ fontWeight: "600" }}>{l.primary}</AppText>
                  <AppText ltr style={{ fontSize: ty.label, color: p.muted }}>
                    {isolateLtr(planned)}
                    {e.isGoalLift ? ` · ${t("today.goalTag")}` : ""}
                    {l.secondary ? ` · ${l.secondary}` : ""}
                  </AppText>
                </View>
                {target ? (
                  <View style={{ alignItems: stack ? "flex-start" : "flex-end", flexShrink: 0 }}>
                    <AppText ltr style={{ fontSize: ty.section, fontWeight: "600", color: p.accent }}>
                      {isolateLtr(target)}
                    </AppText>
                    {isLead && tg ? <QuietAction label={t("workout.whyShort")} icon="why" accessibilityLabel={`${t("workout.whyShort")}: ${l.primary}`} onPress={() => navigation.navigate("Why", { targetId: tg.id })} /> : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      </View>

      <WeeklyReviewCard />

      {paceLine ? <ListCard title={t("goals.entry")} note={paceLine} onPress={() => navigation.navigate("Goals")} /> : null}

      <View style={{ gap: space.xs }}>
        {short ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("short.active", { days: short.days })}</AppText> : null}
        <BigButton variant="quiet" label={t("short.entry")} onPress={() => navigation.navigate("ShortWeek")} />
      </View>
      <HealthNote />

      <ChoiceSheet
        visible={changeOpen}
        title={t("today.choose")}
        note={t("today.chooseNote")}
        onClose={() => setChangeOpen(false)}
        onSelect={setPicked}
        options={data.days.map((d) => ({
          id: d.id,
          label: d.name,
          badge: d.id === data.openDayId ? t("today.inProgress") : d.suggested ? t("today.suggestedToday") : undefined,
          detail: t("today.meta", { sets: d.sets, min: estimateDayMinutes({ exercises: d.exercises, sets: d.sets }, data.restSeconds) }),
          selected: d.id === chosen.id,
        }))}
      />
    </Screen>
  );
}
