import { RestTimerBar } from "../components/RestTimerBar";
import { Profiler, useEffect, useRef, useState, type ProfilerOnRenderCallback } from "react";
import { perfMark, perfMarks, perfNow } from "../perfMarks";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { adjustKeyboardInsets } from "../numberPad";
import { Icon } from "../components/Icon";
import { WorkoutExerciseSection } from "../components/WorkoutExerciseSection";
import { WorkoutDetailsPanel } from "../components/WorkoutDetailsPanel";
import { RestClock, LiveDuration, Stat } from "../components/WorkoutStats";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import { useI18n } from "../i18n";
import { volumeText } from "../logic/liveSummary";
import { adjustTimer, startTimer, stopTimer } from "../logic/restTimer";
import { MIN_TOUCH, radius, space, type as ty, useLogPalette } from "../theme";
import { AppText, BigButton, QuietAction, ErrorState, IconButton, InlineStatus, LoadingState, Notice } from "../ui";
import { useWorkoutSession } from "../hooks/useWorkoutSession";
import { WorkoutSessionSheets } from "../components/WorkoutSessionSheets";

/** Developer Mode "loggerCommit": React commit time of the logger's scroll content. Returns at once with Developer Mode off. */
const onLoggerRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
  if (!perfMarks.isOn()) return;
  perfMark("loggerCommit", actualDuration);
};

/** Presentation only; timer ticks stay in their leaf components. */
export function WorkoutScreen() {
  const session = useWorkoutSession();
  const { t, lang, unit, unitText, fmt, direction } = useI18n();
  const p = useLogPalette();
  const insets = useSafeAreaInsets();
  // Session-only: the Workout details panel always starts closed and is not persisted.
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Developer Mode timings: mount → session ready, once.
  const openT0 = useRef(perfNow());
  const openMarked = useRef(false);
  useEffect(() => {
    if (session.phase !== "ready" || openMarked.current) return;
    openMarked.current = true;
    perfMark("workoutOpen", perfNow() - openT0.current);
  }, [session.phase]);
  if (session.phase === "error") {
    return (
      <View style={{ flex: 1, padding: space.lg, paddingTop: insets.top + space.lg, gap: space.md, backgroundColor: p.bg }}>
        <ErrorState
          title={t("workout.loadError.title")}
          body={t("workout.loadError.body")}
          retryLabel={t("today.error.retry")}
          onRetry={session.retry}
        />
        <BigButton variant="secondary" label={t("common.close")} onPress={() => session.navigation.goBack()} />
      </View>
    );
  }
  if (session.phase === "loading") return <LoadingState />;
  if (session.phase === "nogym") return <View style={{ flex: 1, backgroundColor: p.bg }}><Notice kind="error">{t("workout.noGym")}</Notice></View>;

  const {
    timerOpen, timerRunning, restOver, restPermDenied, navigation, setHelpOpen,
    setRestOver, setTimerOpen, timer, finishing, askFinish,
    loaded, status, toggleDurationPause, summary, sets,
    summaryOpen, setSummaryOpen, readiness, setReadiness, workout,
    source, previousSource, choosePreviousSource, finishFailed, doFinish,
    shown, setReorderOpen, exerciseProps, setAddOpen, removedSlots,
    restore, unlogged, restFor, setTimer,
  } = session;
  const dockVisible = timerOpen || timerRunning || restOver;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {/* Compact header: back, title, rest timer, Finish. The numbers live in the stats row below, in the scroll. */}
      <View style={{ paddingTop: insets.top + space.xs, paddingBottom: space.xs, paddingHorizontal: space.xs, flexDirection: "row", alignItems: "center", gap: space.sm /* 8 dp between 48 dp header targets (L-14) */, backgroundColor: p.bg }}>
        <IconButton icon="chevron" back label={t("workout.collapse")} onPress={() => navigation.goBack()} />
        {/* The day name ("Upper A") confirms at a glance which session is open (L-13); the generic title is the fallback. */}
        <AppText accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontSize: ty.body, fontWeight: "600" }}>{loaded.dayName || t("workout.header")}</AppText>
        <IconButton icon="why" label={t("workout.help.button")} onPress={() => setHelpOpen(true)} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("workout.restTimerBtn")}
          accessibilityState={{ expanded: dockVisible }}
          onPress={() => {
            setRestOver(false);
            setTimerOpen((o) => !o);
          }}
          style={{ minHeight: 48, minWidth: 48, paddingHorizontal: space.sm, flexDirection: "row", gap: 6, borderRadius: radius.button, backgroundColor: timerRunning ? p.field : "transparent", alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="timer" color={timerRunning ? p.accent : p.text} size={24} />
          {timerRunning ? <RestClock timer={timer} style={{ color: p.accent, fontWeight: "600", fontSize: 14 }} /> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("workout.finishBtn")}
          disabled={finishing}
          onPress={() => askFinish(loaded)}
          style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: space.lg, marginStart: space.xs, borderRadius: radius.button, backgroundColor: finishing ? p.line : pressed ? p.fillPressed : p.fill, alignItems: "center", justifyContent: "center" })}
        >
          <AppText style={{ color: p.onFill, fontWeight: "600", fontSize: 16, textAlign: "center" }}>{t("workout.finishBtn")}</AppText>
        </Pressable>
      </View>

      {/* Save status: one line under the header, outside the scroll so it is always in view, in words + icon. Failures and unsaved work come before any friendlier message; "resumed" goes away after a few seconds. */}
      <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: space.lg, paddingBottom: space.xs }}>
        {/* 14/20 with a 16 dp icon (pencil when sets are typed but not ticked) (L-4c). */}
        <InlineStatus kind={status.kind} icon={status.icon} text={status.text} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: (dockVisible ? space.lg : insets.bottom) + space.xxl }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets={adjustKeyboardInsets}>
        <Profiler id="logger" onRender={onLoggerRender}>
        {/* Row 1: duration with ONE pause/resume control beside it, sets at the end. Row 2: a full-width "Workout details" disclosure (L-7). */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.lg }}>
          <Stat label={t("workout.stat.duration")}>
            <LiveDuration startedAt={loaded.startedAt} pausedMs={loaded.pausedMs} pausedAt={loaded.pausedAt} color={p.accent} />
          </Stat>
          {/* Pause / resume the whole workout: the duration freezes and Finish records active time only. The rest timer is separate. */}
          <IconButton icon={loaded.pausedAt != null ? "play" : "pause"} label={loaded.pausedAt != null ? t("workout.resume") : t("workout.pause")} onPress={() => void toggleDurationPause()} />
          <View style={{ flex: 1 }} />
          <Stat label={t("workout.stat.sets")}>
            {/* Same 48 dp value box as Duration, so both labels share a top line and both values a baseline (C-R1). */}
            <View style={{ minHeight: MIN_TOUCH, justifyContent: "center" }}>
              <AppText ltr style={{ fontSize: 20, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{summary.sets}</AppText>
            </View>
          </Stat>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          onPress={() => setDetailsOpen(open => !open)}
          style={({ pressed }) => ({ minHeight: MIN_TOUCH, marginHorizontal: space.lg, marginBottom: space.xs, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.button, backgroundColor: pressed ? p.field : "transparent" })}
        >
          <AppText style={{ flex: 1, fontSize: ty.label, fontWeight: "600", color: p.accent }}>{t("workout.details")}</AppText>
          <View style={{ transform: [{ rotate: detailsOpen ? (direction === "rtl" ? "-90deg" : "90deg") : "0deg" }] }}>
            <Icon name="chevron" color={p.accent} size={20} mirror />
          </View>
        </Pressable>
        <WorkoutDetailsPanel
          open={detailsOpen}
          readiness={readiness}
          onReadiness={(next) => {
            setReadiness(next);
            void workout.setSessionReadiness(loaded.sessionId, next);
          }}
          previousSource={previousSource}
          onPreviousSource={source => void choosePreviousSource(source)}
          onReorder={shown.length > 1 ? () => setReorderOpen(true) : undefined}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.xl, paddingHorizontal: space.lg, paddingBottom: space.xs }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: summaryOpen }} onPress={() => setSummaryOpen(open => !open)} style={{ minHeight: 48, justifyContent: "center" }}>
              <AppText style={{ color: p.muted }}>{t("workout.summary")}</AppText>
            </Pressable>
            {summaryOpen ? <Stat label={t("workout.stat.volume")}>
              <AppText style={{ fontSize: 20, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{isolateLtr(volumeText(summary.volumeKg, unit))} {unitText}</AppText>
            </Stat> : null}
          </View>
        </WorkoutDetailsPanel>

        {finishFailed ? (
          <View accessibilityLiveRegion="assertive" style={{ marginHorizontal: space.md, marginBottom: space.sm }}>
            <Notice kind="error" title={t("workout.finishFailed.title")} actionLabel={t("workout.finishFailed.retry")} onAction={() => void doFinish(loaded)}>
              {t("workout.finishFailed.body")}
            </Notice>
          </View>
        ) : null}

        {shown.map((ex, i) => { const props = exerciseProps(ex, i); return props ? <WorkoutExerciseSection key={ex.id} {...props} /> : null; })}

        <View style={{ paddingHorizontal: space.md, paddingTop: space.xl }}>
          <BigButton variant="secondary" icon="plus" label={t("workout.add.button")} onPress={() => setAddOpen(true)} />
        </View>

        {removedSlots.length > 0 ? (
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.xs }}>
            <AppText style={{ color: p.muted, fontSize: 13, fontWeight: "600" }}>{t("workout.removed")}</AppText>
            {removedSlots.map((s) => (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <AppText style={{ flex: 1, color: p.muted }}>{exerciseLabels(s, lang).primary}</AppText>
                <BigButton variant="quiet" label={t("workout.restore")} onPress={() => void restore(s.exerciseId)} />
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl, gap: 4 }}>
          {unlogged > 0 ? <InlineStatus kind="warn" text={t("workout.unlogged", { n: unlogged })} /> : null}
        </View>
        </Profiler>
      </ScrollView>

      {restPermDenied ? <View style={{ paddingHorizontal: space.lg }}><InlineStatus kind="warn" text={t("rest.perm.denied")} /></View> : null}
      {dockVisible ? <RestTimerBar timer={timer} restFor={restFor} restOver={restOver}
        onAdjust={d => setTimer(tm => adjustTimer(tm, d, Date.now()))}
        onToggle={() => { setRestOver(false); setTimer(tm => tm.endsAt === null ? startTimer(tm, Date.now()) : stopTimer(tm)); }} /> : null}

      <WorkoutSessionSheets session={session} />
    </View>
  );
}
