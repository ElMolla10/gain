import { quantityText } from "../logic/quantity";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { describePace } from "../logic/paceText";
import type { StringKey } from "../i18n/strings";
import { WeeklyReviewCard } from "../components/WeeklyReviewCard";
import { useServices } from "../AppContext";
import { estimateMinutes, exerciseLabels, isolateLtr } from "../i18n/format";
import { useI18n } from "../i18n";
import { space, usePalette } from "../theme";
import { BrandLogo } from "../BrandLogo";
import { markSuggested, initialSelection, type DayChoice } from "../logic/dayChoice";
import { AppText, BigButton, Card } from "../ui";
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
}

export function TodayScreen() {
  const { repos, goals, programmes, shortWeek, finish, workout } = useServices();
  const { t, lang, fmt } = useI18n();
  const p = usePalette();
  const navigation = useNavigation<{ navigate: (name: "Workout" | "Goals" | "ShortWeek", params?: { dayId: string }) => void }>();
  const [state, setState] = useState<Load<TodayData>>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const [paceLine, setPaceLine] = useState<string>("");
  const [short, setShort] = useState<{ days: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

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
        const active = await repos.getLatestProgrammeVersion();
        const pace = await goals.getPace(Date.now());
        const lib = pace.kind === "lift" ? await programmes.listExercises() : [];
        const ex = pace.kind === "lift" ? lib.find((e) => e.id === pace.goal.exerciseId) : undefined;
        if (alive) setPaceLine(describePace(pace, { t, fmt, exerciseName: ex ? exerciseLabels(ex, lang).primary : "", muscleName: (m) => t(`muscle.${m}` as StringKey) }).short);
        if (alive) setPicked((cur) => initialSelection(marked, next.day.id, open?.dayId ?? null, cur));
        return { programmeName: next.programmeName, isSample: active?.isSample ?? false, days: marked.map((d, i) => ({ ...d, list: lists[i]! })), suggestedId: next.day.id, openDayId: open?.dayId ?? null };
      }, (e) => diagnostics.record("error", "today load", e)).then((r) => alive && setState(r));
      return () => {
        alive = false;
      };
    }, [repos, goals, programmes, shortWeek, workout, t, fmt, lang, attempt]),
  );

  if (state.kind === "loading") return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  if (state.kind === "error") {
    return (
      <View style={{ padding: space.lg, gap: space.md }}>
        <AppText style={{ fontSize: 20, fontWeight: "700" }}>{t("today.error.title")}</AppText>
        <AppText style={{ color: p.muted }}>{t("today.error.body")}</AppText>
        <BigButton
          label={t("today.error.retry")}
          onPress={() => {
            setState(LOADING);
            setAttempt((n) => n + 1);
          }}
        />
      </View>
    );
  }
  if (state.kind === "empty") return <AppText style={{ padding: space.lg }}>{t("today.empty")}</AppText>;
  const data = state.data;

  const chosen = data.days.find((d) => d.id === picked) ?? data.days[0]!;
  const exercises = chosen.list;
  const totalSets = chosen.sets;
  const goalLifts = exercises.filter((e) => e.isGoalLift);
  const openElsewhere = data.openDayId !== null && data.openDayId !== chosen.id;

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      // The chosen day gets its own planned session and targets (planned sessions of other days are voided: missed days never stack).
      if (data.openDayId === null) {
        const gymId = await repos.getActiveGymId();
        if (gymId) await finish.planDay(chosen.id, gymId);
      }
      navigation.navigate("Workout", { dayId: data.openDayId ?? chosen.id });
    } finally {
      setStarting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <BrandLogo size={40} />
        <AppText ltr style={{ fontSize: 20, fontWeight: "800", letterSpacing: 2 }}>
          {t("app.name")}
        </AppText>
      </View>
      <WeeklyReviewCard />
      <Card>
        <AppText style={{ color: p.muted }}>{t("today.choose")}</AppText>
        <AppText style={{ color: p.muted }}>{data.programmeName}</AppText>
        {data.openDayId ? <AppText style={{ fontWeight: "700" }}>{t("today.openWorkout")}</AppText> : null}
        {data.days.map((d) => (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            accessibilityState={{ selected: d.id === chosen.id }}
            onPress={() => setPicked(d.id)}
            style={{ borderWidth: 2, borderColor: d.id === chosen.id ? p.accent : p.edge, borderRadius: 14, padding: space.md, gap: space.xs, backgroundColor: d.id === chosen.id ? p.card : "transparent" }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm }}>
              <AppText style={{ fontSize: 20, fontWeight: "800", flex: 1 }}>{d.id === chosen.id ? "✓ " : ""}{d.name}</AppText>
              {d.suggested ? <AppText style={{ color: p.accent, fontWeight: "700" }}>★ {t("today.suggested")}</AppText> : null}
              {d.id === data.openDayId ? <AppText style={{ fontWeight: "700" }}>{t("today.inProgress")}</AppText> : null}
            </View>
            <AppText style={{ color: p.muted }}>
              {t("today.exercises", { n: d.exercises })} · {t("today.sets", { n: d.sets })} · {t("today.estimate", { min: estimateMinutes(d.sets) })}
            </AppText>
          </Pressable>
        ))}
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("today.chooseNote")}</AppText>
      </Card>

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("today.goalLifts")}</AppText>
        {goalLifts.length === 0 ? (
          <AppText style={{ color: p.muted }}>{t("today.noGoalLifts")}</AppText>
        ) : (
          goalLifts.map((e) => <AppText key={e.id}>{exerciseLabels(e, lang).primary}</AppText>)
        )}
        <AppText style={{ color: p.muted }}>{paceLine}</AppText>
        <BigButton label={t("goals.entry")} selected={false} onPress={() => navigation.navigate("Goals")} />
      </Card>

      <Card>
        {exercises.map((e) => {
          const l = exerciseLabels(e, lang);
          return (
            <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md, paddingVertical: space.xs }}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: "600" }}>{l.primary}</AppText>
                <AppText style={{ color: p.muted, fontSize: 13 }}>
                  {l.secondary}
                  {e.isGoalLift ? ` · ${t("today.goalTag")}` : ""}
                </AppText>
              </View>
              <AppText ltr style={{ fontWeight: "700" }}>
                {isolateLtr(e.measure === "reps" ? `${e.sets} × ${e.repMin}-${e.repMax}` : `${e.sets} × ${e.repMin}-${quantityText(e.repMax, e.measure, { s: t("qty.s"), m: t("qty.m") })}`)}
              </AppText>
            </View>
          );
        })}
      </Card>

      <Card>
        {short ? <AppText style={{ fontWeight: "600" }}>{t("short.active", { days: short.days })}</AppText> : null}
        <BigButton label={t("short.entry")} selected={false} onPress={() => navigation.navigate("ShortWeek")} />
      </Card>

      {openElsewhere ? <AppText style={{ fontWeight: "600" }}>{t("today.finishOpenFirst")}</AppText> : null}
      <BigButton label={data.openDayId ? t("today.resume") : t("today.startDay", { day: chosen.name })} disabled={starting} onPress={() => void start()} />
      {data.isSample ? <AppText style={{ color: p.muted, fontSize: 13 }}>{t("today.sampleNote")}</AppText> : null}
      <HealthNote />
    </ScrollView>
  );
}
