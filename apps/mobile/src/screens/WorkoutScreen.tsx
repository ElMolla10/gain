import { useSheetAction } from "../hooks/useSheetAction";
import { inputScrollOffset } from "../logic/workoutKeyboard";
import { WorkoutSessionOverview } from "../components/WorkoutSessionOverview";
import { Profiler, useCallback, useEffect, useRef, useState, type ProfilerOnRenderCallback } from "react";
import { perfMark, perfMarks, perfNow } from "../perfMarks";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { WorkoutExerciseSection } from "../components/WorkoutExerciseSection";
import { WorkoutDetailsPanel } from "../components/WorkoutDetailsPanel";
import { RestClock, LiveDuration, Stat } from "../components/WorkoutStats";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import { useI18n } from "../i18n";
import { volumeText } from "../logic/liveSummary";
import { plannedWorkRows, sessionLineWarns } from "../logic/sessionLine";
import { adjustTimer, startTimer, stopTimer } from "../logic/restTimer";
import { radius, space, type as ty, useLogPalette } from "../theme";
import { AppText, BigButton, QuietAction, ErrorState, IconButton, InlineStatus, LoadingState, Notice, Sheet } from "../ui";
import { useWorkoutSession } from "../hooks/useWorkoutSession";
import { useIsFocused } from "@react-navigation/native";
import { useServices } from "../AppContext";
import { setKeepAwake } from "../keepAwake";
import { KEEP_AWAKE_KEY, keepAwakeSetting, shouldKeepAwake } from "../logic/keepAwake";
import { WorkoutSessionSheets } from "../components/WorkoutSessionSheets";

/** Developer Mode "loggerCommit": React commit time of the logger's scroll content. Returns at once with Developer Mode off. */
const onLoggerRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
  if (!perfMarks.isOn()) return;
  perfMark("loggerCommit", actualDuration);
};

/** Presentation only; timer ticks stay in their leaf components. */
export function WorkoutScreen() {
  const session = useWorkoutSession();
  const { t, lang, unit, unitText } = useI18n();
  // Keep the screen on while this logger is focused and a session is open (setting on by default). Re-read on every
  // focus, so a change made in Settings mid-workout applies on return. Released on blur, unmount, finish and discard.
  const { repos } = useServices();
  const focused = useIsFocused();
  const [keepAwakeOn, setKeepAwakeOn] = useState(true);
  useEffect(() => {
    if (!focused) return;
    let alive = true;
    void repos.getSetting(KEEP_AWAKE_KEY).then((raw) => alive && setKeepAwakeOn(keepAwakeSetting(raw))).catch(() => undefined);
    return () => { alive = false; };
  }, [focused, repos]);
  const sessionOpen = session.phase === "ready" && !session.finishing;
  const awake = shouldKeepAwake({ setting: keepAwakeOn, focused, sessionOpen });
  useEffect(() => {
    if (!awake) return;
    setKeepAwake(true);
    return () => setKeepAwake(false);
  }, [awake]);
  const p = useLogPalette();
  const insets = useSafeAreaInsets();
  const largeText = useWindowDimensions().fontScale > 1.3;
  // Session-only: the Workout details panel always starts closed and is not persisted.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsAction = useSheetAction(detailsOpen, () => setDetailsOpen(false));
  // Developer Mode timings: mount → session ready, once.
  const openT0 = useRef(perfNow());
  const openMarked = useRef(false);
  // Measure the actual scroll viewport: the dock and keyboard both consume space.
  const [keyboardUp, setKeyboardUpLocal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null!);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const keyboardVisible = useRef(false);
  const revealInput = useCallback(() => {
    if (!keyboardVisible.current) return;
    const input = TextInput.State.currentlyFocusedInput();
    const content = contentRef.current;
    if (!input || !content) return;
    // measureLayout ignores inputs in another native sheet, which are not descendants of this content.
    input.measureLayout(content, (_x, top, _width, height) => {
      if (TextInput.State.currentlyFocusedInput() !== input) return;
      const next = inputScrollOffset(top, height, scrollY.current, viewportHeight.current);
      if (Math.abs(next - scrollY.current) > 1) scrollRef.current?.scrollTo({ y: next, animated: false });
    }, () => undefined);
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => { keyboardVisible.current = true; setKeyboardUpLocal(true); requestAnimationFrame(revealInput); });
    const hide = Keyboard.addListener("keyboardDidHide", () => { keyboardVisible.current = false; setKeyboardUpLocal(false); });
    return () => { show.remove(); hide.remove(); };
  }, []);
  const exerciseViews = useRef<Record<string, View | null>>({});
  const scrollToExercise = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const view = exerciseViews.current[id], content = contentRef.current;
      if (view && content) view.measureLayout(content, (_x, top) => scrollRef.current?.scrollTo({ y: top, animated: true }), () => undefined);
    });
  }, []);
  const activeExerciseId = session.phase === "ready" ? session.current?.exId : null;
  const exerciseOrder = session.phase === "ready" ? session.shown.map(ex => ex.id).join("|") : "";
  const scrollToken = activeExerciseId ? `${activeExerciseId}:${exerciseOrder}` : null;
  const scrolledExercise = useRef(scrollToken);
  useEffect(() => {
    if (!keyboardUp && activeExerciseId && scrolledExercise.current !== scrollToken) {
      scrolledExercise.current = scrollToken;
      scrollToExercise(activeExerciseId);
    }
  }, [activeExerciseId, scrollToken, keyboardUp, scrollToExercise]);
  const selectedInputRow = session.phase === "ready" ? session.current?.key : null;
  useEffect(() => { if (keyboardUp) requestAnimationFrame(revealInput); }, [keyboardUp, selectedInputRow, revealInput]);
  const syncKeyboard = session.phase === "ready" ? session.setKeyboardUp : null;
  useEffect(() => { syncKeyboard?.(keyboardUp); }, [keyboardUp, syncKeyboard]);
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
    loaded, toggleDurationPause, summary, sets,
    summaryOpen, setSummaryOpen, readiness, changeReadiness,
    previousSource, choosePreviousSource, finishFailed, doFinish,
    shown, setReorderOpen, exerciseProps, setAddOpen, removedSlots,
    restore, unlogged, setTimer, busy, current, activeRow, activeCanLog, activeLog, jumpExercise,
    statusKind, statusShort, rows,
  } = session;
  const warns = sessionLineWarns(statusKind);
  const showStatusWarning = warns && !(largeText && keyboardUp && statusKind === "unsaved");
  const plannedSets = Math.max(summary.sets, plannedWorkRows(rows, shown.map((e) => e.exerciseId)));
  const dockVisible = timerOpen || timerRunning || restOver;
  const openDetails = () => { Keyboard.dismiss(); setDetailsOpen(true); };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: p.bg }}>
      {/* Compact header with the session identity, menu, running rest clock and Finish. */}
      <View style={{ paddingTop: insets.top + space.xs, paddingBottom: space.xs, paddingHorizontal: space.xs, flexDirection: "row", alignItems: "center", gap: space.sm /* 8 dp between 48 dp header targets (L-14) */, backgroundColor: p.bg }}>
        <IconButton icon="chevron" back label={t("workout.collapse")} onPress={() => navigation.goBack()} />
        {/* The day name ("Upper A") confirms at a glance which session is open (L-13); the generic title is the fallback. */}
        <Pressable accessibilityRole="button" accessibilityLabel={`${loaded.dayName || t("workout.header")}. ${t("workout.details")}`} onPress={openDetails} style={{ flex: 1, minHeight: 48, justifyContent: "center" }}>
          <AppText maxFontSizeMultiplier={1.3} accessibilityRole="header" numberOfLines={largeText || keyboardUp ? 1 : 2} style={{ fontSize: ty.body, fontWeight: "600" }}>{loaded.dayName || t("workout.header")}</AppText>
          <AppText maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ color: p.accent, fontSize: 13 }}>{t("workout.details")}</AppText>
        </Pressable>
        {!keyboardUp || timerRunning ? <Pressable
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
          {timerRunning ? <RestClock maxFontSizeMultiplier={1.3} timer={timer} style={{ color: p.accent, fontWeight: "600", fontSize: 14 }} /> : null}
        </Pressable> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("workout.finishBtn")}
          disabled={finishing}
          onPress={() => askFinish(loaded)}
          style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: space.sm, marginStart: space.xs, borderRadius: radius.button, backgroundColor: pressed ? p.fillPressed : p.fill, alignItems: "center", justifyContent: "center" })}
        >
          <AppText maxFontSizeMultiplier={1.3} style={{ color: p.onFill, fontWeight: "600", fontSize: 16, textAlign: "center" }}>{t("workout.finishBtn")}</AppText>
        </Pressable>
      </View>

      {/* Elapsed time, pause/resume and set progress stay visible above the table. */}
        <View style={{ flexDirection: "row", alignItems: "center", columnGap: space.sm, paddingHorizontal: space.lg }}>
          <LiveDuration compact maxFontSizeMultiplier={1.3} startedAt={loaded.startedAt} pausedMs={loaded.pausedMs} pausedAt={loaded.pausedAt} color={p.accent} />
          {/* Pause / resume the whole workout: the duration freezes and Finish records active time only. The rest timer is separate. */}
          <IconButton icon={loaded.pausedAt != null ? "play" : "pause"} label={loaded.pausedAt != null ? t("workout.resume") : t("workout.pause")} onPress={() => void toggleDurationPause()} />
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.xs }}>
            {(
              <AppText maxFontSizeMultiplier={1.3} accessibilityLabel={t("rack.setsOf", { x: summary.sets, y: plannedSets })} numberOfLines={1} style={{ fontSize: ty.label, color: p.muted, fontVariant: ["tabular-nums"] }}>
                {largeText && keyboardUp ? isolateLtr(`${summary.sets} / ${plannedSets}`) : t("rack.setsOf", { x: summary.sets, y: plannedSets })}
              </AppText>
            )}

          </View>

        </View>
      {showStatusWarning ? <InlineStatus kind="warn" text={statusShort} maxFontSizeMultiplier={1.3} /> : null}
      <ScrollView ref={scrollRef} innerViewRef={contentRef} onLayout={event => { viewportHeight.current = event.nativeEvent.layout.height; requestAnimationFrame(revealInput); }} onScroll={event => { scrollY.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.md }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets={false}>
        <Profiler id="logger" onRender={onLoggerRender}>


        {finishFailed ? (
          <View accessibilityLiveRegion="assertive" style={{ marginHorizontal: space.md, marginBottom: space.sm }}>
            <Notice kind="error" title={t("workout.finishFailed.title")} actionLabel={t("workout.finishFailed.retry")} onAction={() => void doFinish(loaded)}>
              {t("workout.finishFailed.body")}
            </Notice>
          </View>
        ) : null}

        {shown.map((ex, i) => {
          const props = exerciseProps(ex, i);
          return props ? <View key={ex.id} collapsable={false} ref={view => { exerciseViews.current[ex.exerciseId] = view; }}>
            <WorkoutExerciseSection {...props} />
          </View> : null;
        })}
        {shown.length === 0 ? <View style={{ padding: space.md }}><QuietAction label={t("workout.add.button")} onPress={openDetails} /></View> : null}

        </Profiler>
      </ScrollView>

      {restOver ? <View style={{ paddingHorizontal: space.lg }}><QuietAction maxFontSizeMultiplier={1.3} icon="timer" label={t("workout.rest.done")} onPress={() => { setRestOver(false); setTimerOpen(true); }} /></View> : null}
      {restPermDenied ? <View style={{ paddingHorizontal: space.lg }}><InlineStatus maxFontSizeMultiplier={1.3} kind="warn" text={t("rest.perm.denied")} /></View> : null}
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, borderTopWidth: 1, borderColor: p.line, backgroundColor: p.bg }}>
        <BigButton icon="check" maxFontSizeMultiplier={1.5} label={activeRow?.saved ? t("workout.tickUpdate") : t("rack.log")}
          accessibilityHint={activeRow?.saved ? t("workout.tickUpdate") : t("rack.log")} disabled={!activeCanLog || finishing} loading={busy != null && busy === current?.key} onPress={activeLog} />
      </View>

      <WorkoutSessionOverview visible={detailsOpen} activeId={current?.exId ?? null}
        exercises={shown.map(ex => {
          const list = (rows[ex.exerciseId] ?? []).filter(row => !row.warmup && !row.tags.includes("drop"));
          return { id: ex.exerciseId, name: exerciseLabels(ex, lang).primary, done: list.filter(row => row.saved).length, total: list.length };
        })}
        onJump={id => detailsAction.dismissThen(() => { jumpExercise(id); scrollToExercise(id); })}
        onRemove={id => detailsAction.dismissThen(() => { const ex = shown.find(ex => ex.exerciseId === id); if (ex) session.askRemove(ex, exerciseLabels(ex, lang).primary); })}
        onAdd={() => detailsAction.dismissThen(() => setAddOpen(true))}
        onReorder={() => detailsAction.dismissThen(() => setReorderOpen(true))}
        onClose={() => setDetailsOpen(false)} onDismiss={detailsAction.onDismiss}>
        <WorkoutDetailsPanel
          open={detailsOpen}
          readiness={readiness}
          onReadiness={(next) => { void changeReadiness(next); }}
          previousSource={previousSource}
          onPreviousSource={source => void choosePreviousSource(source)}
        >
          <View style={{ paddingHorizontal: space.lg }}><QuietAction icon="why" label={t("workout.help.button")} onPress={() => detailsAction.dismissThen(() => setHelpOpen(true))} /></View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.xl, paddingHorizontal: space.lg, paddingBottom: space.xs }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: summaryOpen }} onPress={() => setSummaryOpen(open => !open)} style={{ minHeight: 48, justifyContent: "center" }}>
              <AppText style={{ color: p.muted }}>{t("workout.summary")}</AppText>
            </Pressable>
            {summaryOpen ? <Stat label={t("workout.stat.volume")}>
              <AppText style={{ fontSize: 20, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{isolateLtr(volumeText(summary.volumeKg, unit))} {unitText}</AppText>
            </Stat> : null}
          </View>
        </WorkoutDetailsPanel>
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
        <InlineStatus kind={warns ? "warn" : "success"} text={statusShort} />
      </WorkoutSessionOverview>
      <Sheet visible={timerOpen} title={t("workout.restTimerBtn")} onClose={() => setTimerOpen(false)}>
        <RestClock timer={timer} style={{ color: p.accent, fontSize: 28, fontWeight: "600" }} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {[-15, 15].map(seconds => <QuietAction key={seconds} label={`${seconds > 0 ? "+" : "−"}${Math.abs(seconds)} ${t("qty.s")}`} onPress={() => setTimer(tm => adjustTimer(tm, seconds, Date.now()))} />)}
          <QuietAction label={timerRunning ? t("workout.rest.stop") : t("workout.rest.start")} onPress={() => { setRestOver(false); setTimer(tm => tm.endsAt === null ? startTimer(tm, Date.now()) : stopTimer(tm)); }} />
        </View>
      </Sheet>
      <WorkoutSessionSheets session={session} />
    </KeyboardAvoidingView>
  );
}
