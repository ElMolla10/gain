import { StackActions, useNavigation, useRoute } from "@react-navigation/native";
import { findSpec, nextLoadAbove, type Decision, type GymFingerprint, type LoggedSet, type Measure, type OutlierResult } from "@gain/engine";
import * as Crypto from "expo-crypto";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { adjustKeyboardInsets } from "../numberPad";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { MenuSheet } from "../components/LogParts";
import { Icon } from "../components/Icon";
import { ExercisePicker } from "../components/ExercisePicker";
import { ExerciseReorderModal } from "../components/ExerciseReorderModal";
import { WorkoutExerciseSection } from "../components/WorkoutExerciseSection";
import { RestClock, LiveDuration, Stat } from "../components/WorkoutStats";
import { WorkoutHelp } from "../components/WorkoutHelp";
import type { LibraryExercise } from "../db/programmeRepo";
import { DEFAULT_EXERCISE_REST_OFF, type ExerciseState, type SetRow } from "../db/workoutRepo";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { weightText } from "../logic/units";
import type { MachineLoadKind, PinMachineStep } from "../logic/machineLoadKind";
import { useI18n } from "../i18n";
import { defaultRestSettings, loadRestSettings, syncRestAlert, type RestSettings } from "../logic/restAlert";
import { joinSuperset, leaveSuperset, orderSlots, reorderBlocks, restAfterSet, supersetLabels } from "../logic/superset";
import { initialDraft } from "../logic/draft";
import { finishChoice } from "../logic/finishChoice";
import { attemptFinish } from "../logic/loadState";
import { checkJump, jumpOptions, JUMP_SETTING_KEY, parseJumpThreshold, type JumpCheck } from "../logic/jumpGuard";
import { isTimed, parseQuantityInput, quantityFields, setQuantity } from "../logic/quantity";
import { replacementDisplay } from "../logic/replacement";
import { substitutionCandidates } from "../logic/substitutions";
import { focusedExercise, livePromptVisible } from "../logic/workoutFocus";
import { liveSummary, volumeText } from "../logic/liveSummary";
import { parseLoadInput, parseRepsInput, parseRirInput } from "../logic/setInput";
import { acceptGhost, addRow, backoffPrefill, editRow, effectiveOf, initialRows, isDropRow, kindOf, kindPatch, markSaved, mergeRows, pendingCount, removeRow, rowCanLog, SET_KINDS, type SetKind, unloggedFilled, unlogRow, type SetRowDraft } from "../logic/workoutRows";
import { applyLiveLoad, liveContext, livePerformanceKey, tryLiveRecommendation, reportedSymptomDecision, nextAdaptiveRow } from "../logic/liveAdaptation";
import { RESUMED_NOTE_MS, saveStatusKind } from "../logic/saveStatus";
import { evaluationPrediction, LIVE_MODEL_VERSION, resumeEvaluationTarget } from "../logic/mlEvaluation";
import { staleOffGridTarget } from "../logic/targetRefresh";
import { adjustTimer, formatClock, isDone, newTimer, startTimer, stopTimer, type RestTimer } from "../logic/restTimer";
import { radius, space, type as ty, useLogPalette } from "../theme";
import { AppText, BigButton, QuietAction, ErrorState, IconButton, InlineStatus, LoadingState, Notice } from "../ui";

import type { DayEx, Disp, ExInfo } from "../logic/workoutTypes";

interface Loaded {
  sessionId: string;
  resumed: boolean;
  startedAt: number;
  gym: GymFingerprint;
  slots: DayEx[];
  info: Record<string, ExInfo>;
}

const clock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// For a timed exercise the row's "reps" box holds seconds or metres (the database stores reps = 1 plus duration_s / distance_m).
const toSaved = (s: SetRow) => ({ id: s.id, load: s.load, reps: s.durationS ?? s.distanceM ?? s.reps, rir: s.rir, warmup: s.warmup, tags: s.tags });
const NO_STATE = (slot: string): ExerciseState => ({ slot, removed: false, replacedBy: null, note: "", restOff: DEFAULT_EXERCISE_REST_OFF, added: false, position: null, superset: null });

/**
 * The active workout (v0.9.0 layout, after Hevy's "Log Workout"): a top bar with collapse, rest timer and Finish; a live Duration / Volume /
 * Sets row; then ONE scrolling list of every exercise. Each exercise has its name, a menu (notes / replace / remove), a notes field, its rest
 * timer line, GAIN's target with a one-line reason, and a SET | PREVIOUS | KG | REPS | tick table. KG and REPS are plain typed boxes whose ghost text is
 * today's target, so one tap on the tick accepts it. A set is saved on the phone the moment it is ticked (offline); nothing waits for the finish.
 */
export function WorkoutScreen() {
  const { repos, workout, finish, programmes, restAlerts, mlEvaluation } = useServices();
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = useLogPalette();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const dayId = (route.params as { dayId: string }).dayId;

  const [loaded, setLoaded] = useState<Loaded | null | "nogym">(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [finishFailed, setFinishFailed] = useState(false);
  /** A big proposed jump waiting for the lifter's decision (P04). `okJumps` remembers "use it anyway" per exercise + load. */
  const [jumpAsk, setJumpAsk] = useState<{ ex: Disp; row: SetRowDraft; check: JumpCheck; load: number; reps: number; prev: number } | null>(null);
  const okJumps = useRef<Set<string>>(new Set());
  const [rows, setRows] = useState<Record<string, SetRowDraft[]>>({});
  const [liveCards, setLiveCards] = useState<Record<string, { decision: Decision; key: string; performance: string; snapshot: string }>>({});
  const [reportedSymptoms, setReportedSymptoms] = useState<Record<string, Decision>>({});
  const [liveDismissed, setLiveDismissed] = useState<Record<string, string>>({});
  const [sets, setSets] = useState<SetRow[]>([]);
  const [exState, setExState] = useState<Record<string, ExerciseState>>({});
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [outliers, setOutliers] = useState<Record<string, OutlierResult>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  /** The last save failed (shown in the header until a save succeeds); the alert alone would be easy to miss. */
  const [saveError, setSaveError] = useState(false);
  /** "Resumed your open workout": a confirmation that goes away by itself. */
  const [resumeNote, setResumeNote] = useState(false);
  const [warmOpen, setWarmOpen] = useState<string | null>(null);
  const [warmDone, setWarmDone] = useState<Record<string, boolean>>({});
  const [preferredExercise, setPreferredExercise] = useState<string | null>(null);
  const [liveDetails, setLiveDetails] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [machineFor, setMachineFor] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  /** The row whose type (normal / warm-up / drop / failure) is being chosen. */
  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  /** The exercise for which "Superset with ..." is being chosen. */
  const [ssFor, setSsFor] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [kindFor, setKindFor] = useState<{ exId: string; key: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [timer, setTimer] = useState<RestTimer>(() => newTimer());
  const [timerOpen, setTimerOpen] = useState(false);
  /** The exercise the running (or just finished) rest belongs to, shown in the rest dock. */
  const [restFor, setRestFor] = useState<string | null>(null);
  const [rest, setRest] = useState<RestSettings>(defaultRestSettings());
  const [restOver, setRestOver] = useState(false);
  const [jumpThreshold, setJumpThreshold] = useState(10);
  const startedRef = useRef(false);
  const libRef = useRef<LibraryExercise[]>([]);
  const noteInputs = useRef<Record<string, TextInput | null>>({});
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const notesPending = useRef<Record<string, string>>({});
  const sessionRef = useRef<string | null>(null);

  /** The exercise shown for a program slot today. */
  const makeDisp = useCallback((slotEx: DayEx, st?: ExerciseState): Disp => {
    const lib = st?.replacedBy ? libRef.current.find((l) => l.id === st.replacedBy) : undefined;
    if (lib) return replacementDisplay(slotEx, lib);
    return { ...slotEx, slot: slotEx.exerciseId };
  }, []);

  /** Target, reason, last performance and prefill for one shown exercise. A swapped-in exercise has no stored target (it is not in the program). */
  const buildInfo = useCallback(
    async (ex: Disp, sessionId: string, gym: GymFingerprint): Promise<ExInfo> => {
      const { proposal, lineId, line } = await workout.liveProposal(
        { exerciseId: ex.exerciseId, name: ex.nameEn, measure: ex.measure, equipment: ex.equipment, setup: ex.setup, repMin: ex.repMin, repMax: ex.repMax, programmeRepMin: ex.programmeRepMin, programmeRepMax: ex.programmeRepMax, repCeiling: ex.repCeiling, repCeilingIsCustom: ex.repCeilingIsCustom, isGoalLift: ex.isGoalLift, trackEffort: ex.trackEffort, sets: ex.sets, topSets: ex.topSets },
        gym,
      );
      const personalHistory = await workout.getHistory(line, lineId);
      const latest = personalHistory.at(-1);
      const last = latest ? { performedAt: latest.performedAt, sets: latest.sets.filter(s => !s.warmup && !s.tags?.includes("drop")) } : null;
      const savedTarget = ex.exerciseId === ex.slot ? await finish.getTargetForExercise(sessionId, ex.exerciseId) : null;
      const stored = staleOffGridTarget(savedTarget, proposal) ? null : savedTarget;
      const lastTop = last?.sets.reduce<LoggedSet | null>((a, s) => (a === null || s.load > a.load ? s : a), null) ?? null;
      // Never invented: today's target, else last time's top set, else empty.
      const m = ex.measure;
      const storedQ = stored ? (m === "time" ? stored.durationS : m === "distance" ? stored.distanceM : stored.reps) : null;
      const proposedQ = m === "time" ? proposal.durationS ?? null : m === "distance" ? proposal.distanceM ?? null : proposal.reps;
      const d = initialDraft({
        today: [],
        target: stored ? (stored.effectiveLoad !== null && storedQ !== null && stored.status !== "rejected" ? { load: stored.effectiveLoad, reps: storedQ } : null) : proposal.status === "proposed" && proposedQ !== null ? { load: proposal.load, reps: proposedQ } : null,
        last: lastTop ? { load: lastTop.load, reps: setQuantity(lastTop, m) } : null,
      });
      return { proposal, line, last, stored, personalHistory: personalHistory.flatMap(h => h.sets), prefill: { load: d.load, reps: d.reps } };
    },
    [workout, finish],
  );

  // Open (or resume) the session exactly once; leaving and coming back never creates a second one. A failed open is an error with a
  // retry (`attempt`), not "no gym".
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const gymId = await repos.getActiveGymId();
      if (!gymId) return setLoaded("nogym");
      const gym = await repos.loadGymFingerprint(gymId);
      const { id, resumed } = await workout.startOrResumeSession(dayId, gymId);
      sessionRef.current = id;
      const programmeSlots = await repos.listDayExercises(dayId);
      libRef.current = await programmes.listExercises();
      setLibrary(libRef.current);
      const states: Record<string, ExerciseState> = {};
      const stateList = await workout.listExerciseState(id);
      for (const st of stateList) states[st.slot] = st;
      // Exercises added to this workout earlier (the workout was resumed) come back after the program's own.
      const addedSlots: DayEx[] = [];
      for (const st of stateList.filter((x) => x.added)) {
        const ad = await repos.adHocDayExercise(st.slot);
        if (ad) addedSlots.push(ad);
      }
      const slots = [...programmeSlots, ...addedSlots];
      const info: Record<string, ExInfo> = {};
      const all = await workout.listSessionSets(id);
      const initial: Record<string, SetRowDraft[]> = {};
      for (const slotEx of slots) {
        const st = states[slotEx.exerciseId];
        if (st?.removed) continue;
        const ex = makeDisp(slotEx, st);
        info[ex.exerciseId] = await buildInfo(ex, id, gym);
        initial[ex.exerciseId] = initialRows(all.filter((s) => s.exerciseId === ex.exerciseId).map(toSaved), ex.sets, info[ex.exerciseId]!.prefill, () => Crypto.randomUUID(), (isTimed(ex.measure) ? null : backoffPrefill(ex.topSets, info[ex.exerciseId]!.last?.sets)));
        const pendingId = await mlEvaluation.pendingTarget(id, ex.exerciseId, LIVE_MODEL_VERSION)
          .catch(e => { diagnostics.record("warn", "ML evaluation resume", e); return null; });
        initial[ex.exerciseId] = resumeEvaluationTarget(initial[ex.exerciseId]!, pendingId);
      }
      const session = await workout.getSession(id);
      setExState(states);
      setSets(all);
      setRows(initial);
      setLoaded({ sessionId: id, resumed, startedAt: session?.started_at ?? Date.now(), gym, slots, info });
      if (resumed) setResumeNote(true);
    })().catch((e) => {
      diagnostics.record("error", "open workout", e);
      startedRef.current = false;
      setLoadError(true);
    });
  }, [repos, workout, programmes, mlEvaluation, dayId, makeDisp, buildInfo, attempt]);

  useEffect(() => {
    if (!resumeNote) return;
    const h = setTimeout(() => setResumeNote(false), RESUMED_NOTE_MS);
    return () => clearTimeout(h);
  }, [resumeNote]);

  useEffect(() => {
    void repos.getSetting(JUMP_SETTING_KEY).then((v) => setJumpThreshold(parseJumpThreshold(v)));
  }, [repos]);

  // Rest settings: the default length (unless a rest is already running) and whether to vibrate / notify.
  useEffect(() => {
    void loadRestSettings(repos).then((s) => {
      setRest(s);
      setTimer((tm) => (tm.endsAt === null ? newTimer(s.seconds) : tm));
    });
  }, [repos]);

  // Keep the end-of-rest notification in step with the timer, so the alert arrives with the screen off.
  useEffect(() => {
    void syncRestAlert(restAlerts, timer, rest, { title: t("rest.alert.title"), body: t("rest.alert.body") }, Date.now());
  }, [timer, rest, restAlerts, t]);

  // Leaving the logger drops the in-app timer, so drop its alert too (no stray buzz after the workout). Pending notes are saved.
  useEffect(
    () => () => {
      void restAlerts.cancel().catch(() => undefined);
      const sid = sessionRef.current;
      if (!sid) return;
      for (const [slot, text] of Object.entries(notesPending.current)) {
        clearTimeout(noteTimers.current[slot]);
        void workout.patchExerciseState(sid, slot, { note: text }).catch(() => undefined);
      }
    },
    [restAlerts, workout],
  );

  // When the rest timer reaches zero: buzz once, remember it, stop. One timeout at the end time, not a per-tick check on the screen.
  useEffect(() => {
    if (timer.endsAt === null) return;
    const fire = () => {
      if (rest.vibrate) Vibration.vibrate(400);
      setRestOver(true);
      setTimer((tm) => stopTimer(tm));
    };
    const wait = timer.endsAt - Date.now();
    if (wait <= 0) {
      fire();
      return;
    }
    const h = setTimeout(fire, wait);
    return () => clearTimeout(h);
  }, [timer, rest.vibrate]);

  const setsByEx = useMemo(() => {
    const m = new Map<string, SetRow[]>();
    for (const s of sets) m.set(s.exerciseId, [...(m.get(s.exerciseId) ?? []), s]);
    return m;
  }, [sets]);

  const summary = useMemo(() => liveSummary(sets, null, 0), [sets]);

  /** Re-read the saved sets and fold them into the rows (unlogged rows and typed-over edits stay). */
  const reload = useCallback(
    async (sessionId: string) => {
      const all = await workout.listSessionSets(sessionId);
      setSets(all);
      setRows((prev) => {
        const next: Record<string, SetRowDraft[]> = {};
        for (const [exId, list] of Object.entries(prev)) next[exId] = mergeRows(list, all.filter((s) => s.exerciseId === exId).map(toSaved));
        return next;
      });
    },
    [workout],
  );

  // Run after persistence has refreshed `sets`. Cancelling the scheduled work prevents stale cards after edits or leaving.
  useEffect(() => {
    if (!loaded || loaded === "nogym") return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const cards: typeof liveCards = {};
      const supportedExerciseIds = loaded.slots
        .map(slot => makeDisp(slot, exState[slot.exerciseId]))
        .filter(ex => ex.measure === "reps" && ex.setup === "free" && ex.equipment !== "assisted")
        .map(ex => ex.exerciseId);
      for (const slot of loaded.slots) {
        if (exState[slot.exerciseId]?.removed) continue;
        const ex = makeDisp(slot, exState[slot.exerciseId]);
        const list = rows[ex.exerciseId] ?? [];
        const performance = livePerformanceKey(sets, ex.exerciseId);
        if (liveDismissed[ex.exerciseId] === performance) continue;
        const reported = reportedSymptoms[ex.exerciseId];
        if (reported) {
          cards[ex.exerciseId] = { decision: reported, key: nextAdaptiveRow(list)?.key ?? "", performance, snapshot: JSON.stringify(list) };
          continue;
        }
        const spec = ex.loadSpec ?? findSpec(loaded.gym, ex.equipment);
        const context = liveContext({ exerciseId: ex.exerciseId, equipment: ex.equipment, setup: ex.setup, measure: ex.measure, sets, supportedExerciseIds, rows: list, last: loaded.info[ex.exerciseId]?.last, targetReps: effectiveOf(nextAdaptiveRow(list) ?? { load:null, reps:null, ghostLoad:null, ghostReps:null }).reps ?? ex.repMin });
        if (!context || !spec) continue;
        const decision = tryLiveRecommendation(context, ex.repMin, ex.repMax, spec, undefined, e => diagnostics.record("warn", "live adaptation", e));
        if (decision) {
          cards[ex.exerciseId] = { decision, key: nextAdaptiveRow(list)!.key, performance, snapshot: JSON.stringify(list) };
          const prediction = evaluationPrediction(loaded.sessionId, ex.exerciseId, list, sets, context, decision);
          if (prediction && !cancelled) {
            try { await mlEvaluation.record(prediction); }
            catch (e) { diagnostics.record("warn", "ML evaluation capture", e); }
          }
        }
      }
      if (!cancelled) setLiveCards(cards);
    }, 0);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [loaded, rows, sets, exState, liveDismissed, reportedSymptoms, makeDisp, mlEvaluation]);

  const patch = (exId: string, key: string, change: Parameters<typeof editRow>[2]) => {
    setPreferredExercise(exId);
    setRows((r) => ({ ...r, [exId]: editRow(r[exId] ?? [], key, change) }));
  };

  async function logRow(ex: Disp, row: SetRowDraft) {
    if (!loaded || loaded === "nogym" || busy || !rowCanLog(row)) return;
    // P04: a proposed load more than 10% above last time is confirmed first (or swapped for a smaller step); nothing is saved yet.
    if (!row.saved && !row.warmup && !isDropRow(row) && !isTimed(ex.measure)) {
      const e0 = effectiveOf(row);
      const info0 = loaded.info[ex.exerciseId];
      const lastTop = info0?.last?.sets.reduce<LoggedSet | null>((a, s0) => (a === null || s0.load > a.load ? s0 : a), null) ?? null;
      if (e0.load !== null && e0.reps !== null && lastTop && !okJumps.current.has(`${ex.exerciseId}:${e0.load}`)) {
        const spec0 = ex.loadSpec ?? findSpec(loaded.gym, ex.equipment);
        const micro = spec0 ? nextLoadAbove(spec0, lastTop.load, false) : lastTop.load + 1.25;
        const check = checkJump({ prevLoad: lastTop.load, prevReps: lastTop.reps, targetLoad: e0.load, targetReps: e0.reps, setup: ex.setup, thresholdPct: jumpThreshold, microLoad: micro });
        if (check.needsConfirm) return void setJumpAsk({ ex, row, check, load: e0.load, reps: e0.reps, prev: lastTop.load });
      }
    }
    setBusy(row.key);
    // Empty boxes take the ghost target as the row's own numbers (what the lifter saw is what is saved).
    setRows((r) => ({ ...r, [ex.exerciseId]: acceptGhost(r[ex.exerciseId] ?? [], row.key) }));
    const eff = effectiveOf(row);
    const load = eff.load as number;
    const q = eff.reps as number; // reps, or seconds / metres for a timed exercise
    const qf = quantityFields(q, ex.measure);
    const ctx = { gym: loaded.gym, equipment: ex.equipment, setup: ex.setup };
    try {
      if (!row.saved) {
        const r = await workout.logSet({ id: row.key, sessionId: loaded.sessionId, exerciseId: ex.exerciseId, load, ...qf, rir: isTimed(ex.measure) ? null : row.rir, warmup: row.warmup, tags: row.tags }, ctx);
        if (r.outlier?.verdict === "unconfirmed") setOutliers((o) => ({ ...o, [r.id]: r.outlier! }));
        // No rest timer after a warm-up or a drop set (the next set follows straight away).
        // In a superset the rest comes after the last exercise of the round only.
        if (!row.warmup && !isDropRow(row) && !(exState[ex.slot]?.restOff ?? DEFAULT_EXERCISE_REST_OFF) && restAfterSet(order, exState, ex.slot)) {
          setRestOver(false);
          setRestFor(exerciseLabels(ex, lang).primary);
          setTimer((tm) => startTimer(tm, Date.now()));
        }
      } else if (row.dirty) {
        const r = await workout.updateLiveSet(row.key, { load, ...qf, rir: isTimed(ex.measure) ? null : row.rir, warmup: row.warmup, tags: row.tags }, ctx);
        if (r.outlier?.verdict === "unconfirmed") setOutliers((o) => ({ ...o, [row.key]: r.outlier! }));
      }
      setRows((r) => ({ ...r, [ex.exerciseId]: markSaved(r[ex.exerciseId] ?? [], row.key) }));
      await reload(loaded.sessionId);
      setSavedAt(Date.now());
      setSaveError(false);
    } catch (e) {
      // Storage full or the database failed: the row stays un-ticked (nothing half-saved) and the lifter is told, never left guessing.
      diagnostics.record("error", "save set", e);
      setSaveError(true);
      Alert.alert(t("workout.saveFailed.title"), t("workout.saveFailed.body"));
    } finally {
      setBusy(null);
    }
  }

  /** Un-tick: the set is deleted, the row keeps its numbers and goes back to "not done". */
  async function untick(ex: Disp, row: SetRowDraft) {
    if (!loaded || loaded === "nogym" || busy) return;
    setBusy(row.key);
    try {
      await workout.deleteSet(row.key);
      setOutliers((o) => {
        const { [row.key]: _gone, ...rest2 } = o;
        return rest2;
      });
      setRows((r) => ({ ...r, [ex.exerciseId]: unlogRow(r[ex.exerciseId] ?? [], row.key, Crypto.randomUUID()) }));
      await reload(loaded.sessionId);
      setSavedAt(Date.now());
      setSaveError(false);
    } finally {
      setBusy(null);
    }
  }

  async function dropRow(ex: Disp, row: SetRowDraft) {
    if (!loaded || loaded === "nogym") return;
    if (row.saved) {
      await workout.deleteSet(row.key);
      setRows((r) => ({ ...r, [ex.exerciseId]: removeRow(r[ex.exerciseId] ?? [], row.key) }));
      await reload(loaded.sessionId);
    } else {
      await mlEvaluation.skip(row.key);
      setRows((r) => ({ ...r, [ex.exerciseId]: removeRow(r[ex.exerciseId] ?? [], row.key) }));
    }
  }

  const askDrop = (ex: Disp, row: SetRowDraft) =>
    Alert.alert(t("workout.deleteSet.title"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("workout.deleteSet"), style: "destructive", onPress: () => void dropRow(ex, row) },
    ]);

  function saveNote(slot: string, text: string, now2 = false) {
    const sid = sessionRef.current;
    if (!sid) return;
    notesPending.current[slot] = text;
    clearTimeout(noteTimers.current[slot]);
    const run = () => {
      delete notesPending.current[slot];
      void workout.patchExerciseState(sid, slot, { note: text }).catch(() => undefined);
    };
    if (now2) run();
    else noteTimers.current[slot] = setTimeout(run, 500);
  }

  const setState = (slot: string, change: Partial<ExerciseState>) => setExState((s) => ({ ...s, [slot]: { ...(s[slot] ?? NO_STATE(slot)), ...change } }));

  async function toggleRest(slot: string) {
    if (!loaded || loaded === "nogym") return;
    const off = !(exState[slot]?.restOff ?? DEFAULT_EXERCISE_REST_OFF);
    setState(slot, { restOff: off });
    await workout.patchExerciseState(loaded.sessionId, slot, { restOff: off });
  }

  function askRemove(ex: Disp, title: string) {
    if (!loaded || loaded === "nogym") return;
    const lo = loaded;
    Alert.alert(t("workout.remove.title"), `${title}\n${t("workout.remove.body")}`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("workout.remove.confirm"),
        style: "destructive",
        onPress: async () => {
          await workout.removeExercise(lo.sessionId, ex.slot, ex.exerciseId);
          setState(ex.slot, { removed: true });
          setRows((r) => {
            const { [ex.exerciseId]: _gone, ...others } = r;
            return others;
          });
          await reload(lo.sessionId);
        },
      },
    ]);
  }

  function startReplace(ex: Disp) {
    if ((setsByEx.get(ex.exerciseId) ?? []).length > 0) return void Alert.alert(t("workout.replace.blocked"));
    setPickFor(ex.slot);
  }

  /** Put an exercise (back) into a slot: rebuild its target info and rows. */
  async function showSlot(lo: Loaded, slot: string, st: ExerciseState) {
    const slotEx = lo.slots.find((s) => s.exerciseId === slot);
    if (!slotEx) return;
    const ex = makeDisp(slotEx, st);
    const info = await buildInfo(ex, lo.sessionId, lo.gym);
    const saved = (await workout.listSessionSets(lo.sessionId, ex.exerciseId)).map(toSaved);
    setLoaded((cur) => (cur && cur !== "nogym" ? { ...cur, info: { ...cur.info, [ex.exerciseId]: info } } : cur));
    setRows((r) => ({ ...r, [ex.exerciseId]: initialRows(saved, ex.sets, info.prefill, () => Crypto.randomUUID(), (isTimed(ex.measure) ? null : backoffPrefill(ex.topSets, info.last?.sets))) }));
  }

  async function applyReplace(lo: Loaded, slot: string, cur: Disp, withId: string | null, permanent: boolean) {
    try {
      await workout.replaceExercise(lo.sessionId, slot, cur.exerciseId, withId, permanent);
    } catch {
      return void Alert.alert(t("workout.replace.blocked"));
    }
    setRows((r) => {
      const { [cur.exerciseId]: _gone, ...others } = r;
      return others;
    });
    if (permanent && withId) {
      const programmeSlots = await repos.listDayExercises(dayId);
      const stateList = await workout.listExerciseState(lo.sessionId);
      const states: Record<string, ExerciseState> = {};
      for (const st of stateList) states[st.slot] = st;
      const addedSlots: DayEx[] = [];
      for (const st of stateList.filter((x) => x.added)) {
        const ad = await repos.adHocDayExercise(st.slot);
        if (ad) addedSlots.push(ad);
      }
      const next: Loaded = { ...lo, slots: [...programmeSlots, ...addedSlots] };
      const st = states[withId] ?? NO_STATE(withId);
      setExState(states);
      setLoaded(next);
      await showSlot(next, withId, st);
      return;
    }
    const st: ExerciseState = { ...(exState[slot] ?? NO_STATE(slot)), replacedBy: withId, removed: false };
    setState(slot, st);
    await showSlot(lo, slot, st);
  }

  async function replaceWith(slot: string, exerciseId: string) {
    if (!loaded || loaded === "nogym") return;
    const lo = loaded;
    const slotEx = lo.slots.find((s) => s.exerciseId === slot);
    if (!slotEx) return;
    const cur = makeDisp(slotEx, exState[slot]);
    setPickFor(null);
    if (exerciseId === slot) {
      await applyReplace(lo, slot, cur, null, false);
      return;
    }
    Alert.alert(t("workout.replace.scope.title"), t("workout.replace.scope.body"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("workout.replace.scope.today"), onPress: () => void applyReplace(lo, slot, cur, exerciseId, false) },
      { text: t("workout.replace.scope.program"), onPress: () => void applyReplace(lo, slot, cur, exerciseId, true) },
    ]);
  }

  async function restore(slot: string) {
    if (!loaded || loaded === "nogym") return;
    await workout.patchExerciseState(loaded.sessionId, slot, { removed: false });
    const st = { ...(exState[slot] ?? NO_STATE(slot)), removed: false };
    setState(slot, st);
    await showSlot(loaded, slot, st);
  }

  async function addExerciseToday(exerciseId: string) {
    if (!loaded || loaded === "nogym") return;
    setAddOpen(false);
    try {
      const r = await workout.addExercise(loaded.sessionId, exerciseId);
      const ad = await repos.adHocDayExercise(exerciseId);
      if (!ad) return;
      const states = await workout.listExerciseState(loaded.sessionId);
      const mine = states.find((x) => x.slot === exerciseId) ?? NO_STATE(exerciseId);
      const lo: Loaded = { ...loaded, slots: loaded.slots.some((x) => x.exerciseId === exerciseId) ? loaded.slots : [...loaded.slots, ad] };
      setLoaded(lo);
      setState(exerciseId, mine);
      await showSlot(lo, exerciseId, mine);
      if (r.restored) await reload(loaded.sessionId);
    } catch {
      Alert.alert(t("workout.add.blocked"));
    }
  }

  /** Superset: the chosen exercises are saved with the same group, shown next to each other, and rest after the last one. */
  async function applySuperset(change: Record<string, string | null>) {
    if (!loaded || loaded === "nogym") return;
    await workout.setSuperset(loaded.sessionId, change);
    setExState((cur) => {
      const next = { ...cur };
      for (const [slot, g] of Object.entries(change)) next[slot] = { ...(next[slot] ?? NO_STATE(slot)), superset: g };
      return next;
    });
  }

  if (loaded === null && loadError) {
    return (
      <View style={{ flex: 1, padding: space.lg, paddingTop: insets.top + space.lg, gap: space.md, backgroundColor: p.bg }}>
        <ErrorState
          title={t("workout.loadError.title")}
          body={t("workout.loadError.body")}
          retryLabel={t("today.error.retry")}
          onRetry={() => {
            setLoadError(false);
            setAttempt((n) => n + 1);
          }}
        />
        <BigButton variant="secondary" label={t("common.close")} onPress={() => navigation.goBack()} />
      </View>
    );
  }
  if (loaded === null) return <LoadingState />;
  if (loaded === "nogym") return <View style={{ flex: 1, backgroundColor: p.bg }}><Notice kind="error">{t("workout.noGym")}</Notice></View>;

  const timerRunning = timer.endsAt !== null;
  const unlogged = Object.values(rows).reduce((n, list) => n + unloggedFilled(list), 0);
  const unsavedRows = Object.values(rows).reduce((n, list) => n + pendingCount(list), 0);
  const statusKind = saveStatusKind({ failed: saveError, saving: busy !== null, pending: unsavedRows, resumedNote: resumeNote, savedSets: sets.length });
  const status =
    statusKind === "failed" ? ({ kind: "error", icon: "alert", text: t("workout.status.failed") } as const)
    : statusKind === "saving" ? ({ kind: "info", icon: "phone", text: t("workout.status.saving") } as const)
    : statusKind === "unsaved" ? ({ kind: "info", icon: "edit", text: t("workout.status.unsaved", { n: unsavedRows }) } as const)
    : statusKind === "resumed" ? ({ kind: "success", icon: "check", text: t("workout.resumed") } as const)
    : statusKind === "saved" ? ({ kind: "info", icon: "phone", text: savedAt ? t("workout.saved", { time: clock(savedAt) }) : t("status.savedLocal") } as const)
    : ({ kind: "info", icon: "why", text: t("workout.notSaved") } as const);
  const programmeIds = loaded.slots.filter((s) => !exState[s.exerciseId]?.added).map((s) => s.exerciseId);
  const order = orderSlots(programmeIds, exState);
  const ssLabel = supersetLabels(order, exState);
  const shown: Disp[] = order.flatMap((slot) => {
    const s = loaded.slots.find((x) => x.exerciseId === slot);
    return s ? [makeDisp(s, exState[slot])] : [];
  });
  const removedSlots = loaded.slots.filter((s) => exState[s.exerciseId]?.removed);
  const reorderGroups = reorderBlocks(order, exState);
  const namesBySlot = new Map(shown.map(ex => [ex.slot, exerciseLabels(ex, lang).primary]));

  async function commitReorder(ids: string[]) {
    if (reorderSaving || !loaded || loaded === "nogym") return;
    const byId = new Map(reorderGroups.map(block => [block.id, block.slots]));
    if (ids.length !== reorderGroups.length || new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) return;
    const reordered = ids.flatMap(id => byId.get(id)!);
    setReorderSaving(true);
    try {
      await workout.reorderWorkoutExercises(loaded.sessionId, reordered);
      setExState(current => {
        const updated = { ...current };
        reordered.forEach((slot, i) => { updated[slot] = { ...(updated[slot] ?? NO_STATE(slot)), position: i + 1 }; });
        return updated;
      });
      setReorderOpen(false);
    } catch (e) {
      diagnostics.record("error", "reorder workout", e);
      Alert.alert(t("workout.reorder.failed"));
    } finally {
      setReorderSaving(false);
    }
  }

  /** Finishing never throws out of the handler: on failure the workout stays open (sets are already saved) and a retry is offered. */
  async function doFinish(lo: Loaded) {
    setFinishing(true);
    setFinishFailed(false);
    const r = await attemptFinish(
      () => workout.finishSession(lo.sessionId),
      () => navigation.dispatch(StackActions.replace("Finish", { sessionId: lo.sessionId })),
      (e) => diagnostics.record("error", "finish workout", e),
    );
    if (r === "failed") {
      setFinishing(false);
      setFinishFailed(true);
    }
  }

  async function doDiscard(lo: Loaded) {
    setFinishing(true);
    try {
      if (!(await workout.discardEmptySession(lo.sessionId))) throw new Error("not empty");
      navigation.goBack();
    } catch (e) {
      diagnostics.record("error", "discard empty workout", e);
      setFinishing(false);
      Alert.alert(t("workout.discard.failed"));
    }
  }

  function askFinish(lo: Loaded) {
    if (finishing) return;
    const choice = finishChoice(sets.length, unlogged);
    if (choice === "finish") return void doFinish(lo);
    if (choice === "discard-empty") {
      // Android shows the last button as the primary one: "Discard empty workout" is primary, "Finish anyway" is the quiet alternative.
      return Alert.alert(t("workout.discard.title"), t("workout.discard.body"), [
        { text: t("workout.finish.anyway"), onPress: () => void doFinish(lo) },
        { text: t("common.cancel"), style: "cancel" },
        { text: t("workout.discard.go"), onPress: () => void doDiscard(lo) },
      ]);
    }
    Alert.alert(t("workout.finish.title"), t("workout.unlogged", { n: unlogged }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("workout.finish.go"), onPress: () => void doFinish(lo) },
    ]);
  }

  const focus = focusedExercise(shown.map(ex => ex.exerciseId), rows, preferredExercise);

  const replacing = shown.find(ex => ex.slot === pickFor);
  const source = replacing ? library.find(ex => ex.id === replacing.exerciseId) : undefined;
  const alternatives = source ? substitutionCandidates(source, library, loaded.gym.loads.map(spec => spec.equipment), shown.map(ex => ex.exerciseId)) : [];

  const renderExercise = (ex: Disp, position: number) => {
    const info = loaded.info[ex.exerciseId];
    if (!info) return null;
    const list = rows[ex.exerciseId] ?? [];
    const candidate = liveCards[ex.exerciseId];
    const currentCandidate = candidate && candidate.snapshot === JSON.stringify(list) && candidate.performance === livePerformanceKey(sets, ex.exerciseId) ? candidate : undefined;
    const card = currentCandidate && liveDismissed[ex.exerciseId] !== currentCandidate.performance
      && livePromptVisible(currentCandidate.decision.action, ex.exerciseId === focus) ? currentCandidate : undefined;
    const detailKey = card ? `${ex.exerciseId}:${card.performance}:${card.key}` : null;
    return (
      <WorkoutExerciseSection key={ex.id} active={ex.exerciseId === focus} onFocus={() => setPreferredExercise(ex.exerciseId)}
        liveDetailsOpen={detailKey !== null && liveDetails === detailKey} onLiveDetails={() => setLiveDetails(current => current === detailKey ? null : detailKey)} ex={ex} position={position} info={info} list={list}
        st={exState[ex.slot] ?? NO_STATE(ex.slot)} gym={loaded.gym} exSets={setsByEx.get(ex.exerciseId) ?? []}
        outliers={outliers} candidate={currentCandidate} card={card} expanded={!!whyOpen[ex.exerciseId]}
        supersetLabel={ssLabel[ex.slot]} restDurationMs={timer.durationMs} busy={busy !== null}
        warmOpen={warmOpen === ex.exerciseId} warmDone={!!warmDone[ex.exerciseId]}
        onToggleRest={() => void toggleRest(ex.slot)} onMenu={() => setMenuFor(ex.slot)}
        onWhy={() => info.stored ? navigation.dispatch(StackActions.push("Why", { targetId: info.stored.id })) : setWhyOpen(w => ({ ...w, [ex.exerciseId]: !whyOpen[ex.exerciseId] }))}
        onWhyLong={() => setWhyOpen(w => ({ ...w, [ex.exerciseId]: !whyOpen[ex.exerciseId] }))}
        onPatch={(key, change) => patch(ex.exerciseId, key, change)}
        onKind={row => setKindFor({ exId: ex.exerciseId, key: row.key })}
        onAskDelete={row => askDrop(ex, row)} onDelete={row => void dropRow(ex, row)}
        onLog={row => { setPreferredExercise(ex.exerciseId); void logRow(ex, row); }} onUntick={row => void untick(ex, row)}
        onLiveApply={() => {
          if (!card) return;
          setRows(r => ({ ...r, [ex.exerciseId]: applyLiveLoad(r[ex.exerciseId] ?? [], card.key, card.decision.suggestedWeightKg) }));
          setLiveDismissed(d => ({ ...d, [ex.exerciseId]: card.performance }));
        }}
        onLiveReport={symptom => {
          if (!card) return;
          setReportedSymptoms(s => ({ ...s, [ex.exerciseId]: reportedSymptomDecision(card.decision, symptom) }));
          setLiveDismissed(d => { const { [ex.exerciseId]: _dismissed, ...rest } = d; return rest; });
        }}
        onLiveKeep={() => { if (card) setLiveDismissed(d => ({ ...d, [ex.exerciseId]: card.performance })); }}
        onOutlierConfirm={async set => {
          await workout.setOutlierStatus(set.id, "confirmed");
          await reload(loaded.sessionId);
        }}
        onOutlierReject={async set => {
          await workout.setOutlierStatus(set.id, "rejected");
          setRows(r => ({ ...r, [ex.exerciseId]: removeRow(r[ex.exerciseId] ?? [], set.id) }));
          await reload(loaded.sessionId);
        }}
        onWarmOpen={() => setWarmOpen(ex.exerciseId)} onWarmClose={() => setWarmOpen(null)}
        onWarmConfirm={async steps => {
          setBusy("warm");
          try {
            await workout.addWarmups(loaded.sessionId, ex.exerciseId, steps, { gym: loaded.gym, equipment: ex.equipment, setup: ex.setup });
            await reload(loaded.sessionId);
            setWarmOpen(null);
            setWarmDone(d => ({ ...d, [ex.exerciseId]: true }));
          } finally { setBusy(null); }
        }}
        onAddSet={() => setRows(r => ({ ...r, [ex.exerciseId]: addRow(r[ex.exerciseId] ?? [], info.prefill, () => Crypto.randomUUID()) }))}
      />
    );
  };

  const menuEx = menuFor ? shown.find((e) => e.slot === menuFor) : undefined;
  const machineEx = machineFor ? shown.find((e) => e.slot === machineFor) : undefined;
  const machineChoice = machineEx ? library.find(e => e.id === machineEx.exerciseId) : undefined;
  async function chooseMachineStep(ex: Disp, kind: MachineLoadKind, step?: PinMachineStep) {
    if (busy || !loaded || loaded === "nogym") return;
    setBusy("machine-weights");
    try {
      await programmes.setMachineLoadKind(ex.exerciseId, kind, step);
      const updatedLibrary = await programmes.listExercises();
      libRef.current = updatedLibrary;
      setLibrary(updatedLibrary);
      const spec = (await repos.getExerciseLoads(ex.exerciseId))?.spec ?? null;
      const slots = loaded.slots.map(slot => slot.exerciseId === ex.exerciseId ? { ...slot, loadSpec: spec } : slot);
      const currentSlot = slots.find(slot => slot.exerciseId === ex.slot);
      if (!currentSlot) return;
      const updatedEx = makeDisp(currentSlot, exState[ex.slot]);
      const info = await buildInfo(updatedEx, loaded.sessionId, loaded.gym);
      setLoaded(prev => prev && prev !== "nogym" ? { ...prev, slots, info: { ...prev.info, [ex.exerciseId]: info } } : prev);
      setRows(prev => ({ ...prev, [ex.exerciseId]: (prev[ex.exerciseId] ?? []).map(row => row.saved || row.load !== null ? row : { ...row, ghostLoad: info.prefill.load, ghostReps: row.reps === null ? info.prefill.reps : row.ghostReps }) }));
      setLiveDismissed(prev => { const { [ex.exerciseId]: _old, ...rest } = prev; return rest; });
    } catch (e) {
      diagnostics.record("error", "machine weight steps", e);
      Alert.alert(t("loads.preset.failed"));
    } finally { setBusy(null); }
  }
  const dockVisible = timerOpen || timerRunning || restOver;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {/* Compact header: back, title, rest timer, Finish. The numbers live in the stats row below, in the scroll. */}
      <View style={{ paddingTop: insets.top + space.xs, paddingBottom: space.xs, paddingHorizontal: space.xs, flexDirection: "row", alignItems: "center", gap: space.xs, backgroundColor: p.bg }}>
        <IconButton icon="chevron" back label={t("workout.collapse")} onPress={() => navigation.goBack()} />
        <AppText accessibilityRole="header" style={{ flex: 1, fontSize: ty.body, fontWeight: "600" }}>{t("workout.header")}</AppText>
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
        <InlineStatus compact kind={status.kind} icon={status.icon} text={status.text} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: (dockVisible ? space.lg : insets.bottom) + space.xxl }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets={adjustKeyboardInsets}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.xl, rowGap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xs }}>
          <Stat label={t("workout.stat.duration")}>
            <LiveDuration startedAt={loaded.startedAt} color={p.accent} />
          </Stat>
          <Stat label={t("workout.stat.sets")}>
            <AppText ltr style={{ fontSize: 20, fontWeight: "600" }}>{summary.sets}</AppText>
          </Stat>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: summaryOpen }} onPress={() => setSummaryOpen(open => !open)} style={{ minHeight: 48, justifyContent: "center" }}>
            <AppText style={{ color: p.muted }}>{t("workout.summary")}</AppText>
          </Pressable>
          {summaryOpen ? <Stat label={t("workout.stat.volume")}>
            <AppText ltr style={{ fontSize: 20, fontWeight: "600" }}>{volumeText(summary.volumeKg, unit)} {unitText}</AppText>
          </Stat> : null}
        </View>

        {finishFailed ? (
          <View accessibilityLiveRegion="assertive" style={{ marginHorizontal: space.md, marginBottom: space.sm }}>
            <Notice kind="error" title={t("workout.finishFailed.title")} actionLabel={t("workout.finishFailed.retry")} onAction={() => void doFinish(loaded)}>
              {t("workout.finishFailed.body")}
            </Notice>
          </View>
        ) : null}

        {shown.length > 1 ? (
          <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm }}>
            <QuietAction icon="drag" label={t("workout.reorder.button")} onPress={() => setReorderOpen(true)} />
          </View>
        ) : null}

        {shown.map((ex, i) => renderExercise(ex, i))}

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
      </ScrollView>

      {/* Rest dock: sticky under the list (a layout child, not an overlay), so it never covers a row. Exercise, countdown, -15 / +30, start / stop. */}
      {dockVisible ? (
        <View style={{ backgroundColor: p.card, borderTopWidth: 1, borderColor: p.line, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, gap: space.xs }}>
          {restFor ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
              <Icon name="timer" color={p.muted} size={16} />
              <AppText style={{ color: p.muted, fontSize: 13, flexShrink: 1 }}>{restFor}</AppText>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: space.sm, rowGap: space.sm }}>
            <RestClock timer={timer} style={{ fontSize: 36, fontWeight: "600", minWidth: 110, color: restOver && !timerRunning ? p.accent : p.text }} />
            <View style={{ flexDirection: "row", gap: space.sm, flexGrow: 1, flexBasis: 220 }}>
              {[-15, 30].map((d) => (
                <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${d > 0 ? "+" : "−"}${Math.abs(d)} ${t("qty.s")}`} onPress={() => setTimer((tm) => adjustTimer(tm, d, Date.now()))} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.button, borderWidth: 1.5, borderColor: p.edge, backgroundColor: pressed ? p.line : p.field, alignItems: "center", justifyContent: "center" })}>
                  <AppText ltr style={{ fontWeight: "600", fontSize: 16 }}>{d > 0 ? `+${d}` : `−${-d}`}</AppText>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setRestOver(false);
                  setTimer((tm) => (tm.endsAt === null ? startTimer(tm, Date.now()) : stopTimer(tm)));
                }}
                style={({ pressed }) => ({ flex: 1.4, minHeight: 48, borderRadius: radius.button, backgroundColor: pressed ? p.fillPressed : p.fill, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm })}
              >
                <AppText style={{ color: p.onFill, fontWeight: "600", textAlign: "center" }}>{timerRunning ? t("workout.rest.stop") : t("workout.rest.start")}</AppText>
              </Pressable>
            </View>
          </View>
          {restOver && !timerRunning ? <AppText accessibilityLiveRegion="polite" style={{ color: p.accent, fontWeight: "600" }}>{t("workout.rest.done")}</AppText> : null}
        </View>
      ) : null}

      <ExerciseReorderModal
        visible={reorderOpen}
        title={t("workout.reorder.title")}
        busy={reorderSaving}
        items={reorderGroups.map(block => ({ id: block.id, name: block.slots.map(slot => namesBySlot.get(slot) ?? slot).join(" + ") }))}
        onCancel={() => setReorderOpen(false)}
        onDone={(ids) => void commitReorder(ids)}
      />
      <WorkoutHelp visible={helpOpen} onClose={() => setHelpOpen(false)} />
      <MenuSheet
        visible={jumpAsk !== null}
        wrapTitle
        title={jumpAsk ? t("jump.title", { pct: jumpAsk.check.pct, prev: formatLoad(jumpAsk.prev, lang, unit), next: formatLoad(jumpAsk.load, lang, unit) }) : ""}
        onClose={() => setJumpAsk(null)}
        items={
          jumpAsk
            ? jumpOptions(jumpAsk.check, { load: jumpAsk.load, reps: jumpAsk.reps }, (k, params) => t(k, params), (kg) => formatLoad(kg, lang, unit)).map((o) => ({
                label: o.label,
                onPress: () => {
                  const { ex, row } = jumpAsk;
                  if (o.kind === "anyway") {
                    okJumps.current.add(`${ex.exerciseId}:${o.load}`);
                    void logRow(ex, row);
                  } else {
                    // A smaller step replaces the numbers in the row; the lifter ticks it when ready.
                    patch(ex.exerciseId, row.key, { load: o.load, reps: o.reps });
                  }
                },
              }))
            : []
        }
      />
      <MenuSheet
        visible={menuEx !== undefined}
        title={menuEx ? exerciseLabels(menuEx, lang).primary : ""}
        onClose={() => setMenuFor(null)}
        items={
          menuEx
            ? [
                { label: t("workout.menu.notes"), onPress: () => setTimeout(() => noteInputs.current[menuEx.slot]?.focus(), 150) },
                ...(menuEx.equipment === "machine" ? [{ label: t("workout.menu.machineSteps"), onPress: () => setMachineFor(menuEx.slot) }] : []),
                ...(exState[menuEx.slot]?.added ? [] : [{ label: t("workout.menu.replace"), onPress: () => startReplace(menuEx) }]),
                ...(shown.length > 1 ? [{ label: t("workout.menu.superset"), onPress: () => setSsFor(menuEx.slot) }] : []),
                ...(ssLabel[menuEx.slot] ? [{ label: t("workout.menu.supersetLeave"), onPress: () => void applySuperset(leaveSuperset(menuEx.slot)) }] : []),
                { label: t("workout.menu.remove"), danger: true, onPress: () => askRemove(menuEx, exerciseLabels(menuEx, lang).primary) },
              ]
            : []
        }
      />
      <MenuSheet
        visible={machineEx !== undefined}
        title={t("workout.menu.machineSteps")}
        onClose={() => setMachineFor(null)}
        items={machineEx ? ([
          { kind: "pin" as const, step: 2.5 as const, label: t("workout.machine.pin", { step: 2.5 }) },
          { kind: "pin" as const, step: 5 as const, label: t("workout.machine.pin", { step: 5 }) },
          { kind: "plate" as const, step: undefined, label: t("workout.machine.plate") },
        ]).map(choice => ({
          label: choice.label,
          selected: machineChoice?.machineLoadKind === choice.kind && (choice.kind === "plate" || machineChoice?.machinePinStep === choice.step),
          onPress: () => void chooseMachineStep(machineEx, choice.kind, choice.step),
        })) : []}
      />
      <MenuSheet
        visible={kindFor !== null}
        title={t("workout.kind.title")}
        onClose={() => setKindFor(null)}
        items={SET_KINDS.map((k: SetKind) => {
          const cur = kindFor ? (rows[kindFor.exId] ?? []).find((r) => r.key === kindFor.key) : undefined;
          const on = cur ? kindOf(cur) === k : false;
          return {
            label: t(`workout.kind.${k}` as never),
            selected: on,
            onPress: () => {
              if (!kindFor || !cur) return;
              patch(kindFor.exId, kindFor.key, kindPatch(k, cur.tags));
            },
          };
        })}
      />
      <MenuSheet
        visible={ssFor !== null}
        title={t("workout.superset.pick")}
        onClose={() => setSsFor(null)}
        items={shown
          .filter((e) => e.slot !== ssFor)
          .map((e) => ({
            label: exerciseLabels(e, lang).primary,
            onPress: () => ssFor && void applySuperset(joinSuperset(exState, ssFor, e.slot)),
          }))}
      />
      <ExercisePicker
        visible={addOpen}
        exercises={library}
        exclude={[...loaded.slots.map((e) => e.exerciseId), ...Object.values(exState).flatMap((x) => (x.replacedBy ? [x.replacedBy] : []))]}
        onClose={() => setAddOpen(false)}
        onPick={(id) => void addExerciseToday(id)}
        onCreate={async (input) => {
          const id = await programmes.createExercise(input);
          libRef.current = await programmes.listExercises();
          setLibrary(libRef.current);
          return id;
        }}
      />
      <ExercisePicker
        visible={pickFor !== null}
        exercises={library}
        suggested={alternatives}
        exclude={shown.map((e) => e.exerciseId)}
        onClose={() => setPickFor(null)}
        onPick={(id) => pickFor && void replaceWith(pickFor, id)}
        onCreate={async (input) => {
          const id = await programmes.createExercise(input);
          libRef.current = await programmes.listExercises();
          setLibrary(libRef.current);
          return id;
        }}
      />
    </View>
  );
}
