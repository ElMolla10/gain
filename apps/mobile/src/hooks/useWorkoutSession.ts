import { useWorkoutSuggestions } from "./useWorkoutSuggestions";
import type { LoadedWorkout as Loaded } from "../logic/workoutTypes";
import { useWorkoutRest } from "./useWorkoutRest";
import { StackActions, useNavigation, useRoute } from "@react-navigation/native";
import { estimateStartingLoad, findSpec, nextLoadAbove, parseReadiness, sessionOrderFatigue, type GymFingerprint, type GymLoadSpec, type LoggedSet, type OutlierResult, type ReadinessFlag } from "@gain/engine";
import * as Crypto from "expo-crypto";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, TextInput } from "react-native";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { WorkoutExerciseSection } from "../components/WorkoutExerciseSection";
import { PREVIOUS_SOURCE_KEY, parsePreviousSource, type PreviousSource } from "../components/PreviousSourceToggle";
import type { LibraryExercise } from "../db/programmeRepo";
import { DEFAULT_EXERCISE_REST_OFF, type ExerciseState, type SetRow } from "../db/workoutRepo";
import { exerciseLabels } from "../i18n/format";
import { weightText } from "../logic/units";
import type { MachineLoadKind, PinMachineStep } from "../logic/machineLoadKind";
import { useI18n } from "../i18n";
import { orderSlots, reorderBlocks, restAfterSet, supersetLabels } from "../logic/superset";
import { initialDraft } from "../logic/draft";
import { upgradeLegacyKgDumbbells } from "../logic/defaultGym";
import { finishChoice } from "../logic/finishChoice";
import { attemptFinish } from "../logic/loadState";
import { checkJump, JUMP_SETTING_KEY, parseJumpThreshold, type JumpCheck } from "../logic/jumpGuard";
import { isTimed, quantityFields, setQuantity } from "../logic/quantity";
import { replacementDisplay } from "../logic/replacement";
import { substitutionCandidates } from "../logic/substitutions";
import { focusedExercise, livePromptVisible } from "../logic/workoutFocus";
import { liveSummary } from "../logic/liveSummary";
import { acceptGhost, addRow, backoffPrefill, editRow, effectiveOf, initialRows, isDropRow, markSaved, mergeRows, pendingCount, removeRow, rowCanLog, unloggedFilled, unlogRow, type SetRowDraft } from "../logic/workoutRows";
import { takeLiveTarget, clearLiveTarget, livePerformanceKey, reportedSymptomDecision, trustedWorkingSet } from "../logic/liveAdaptation";
import { specWithJump, buildLoads, specValues, emptyLoadsForm } from "../logic/exerciseLoads";
import { muscleGroupOf } from "../logic/muscleVolume";
import { RESUMED_NOTE_MS, saveStatusKind } from "../logic/saveStatus";
import { LIVE_MODEL_VERSION, resumeEvaluationTarget } from "../logic/mlEvaluation";
import { staleOffGridTarget } from "../logic/targetRefresh";
import { startTimer } from "../logic/restTimer";
import { pauseClock, resumeClock } from "../logic/workoutClock";
import { attachLoads, resolveLoads } from "../db/exerciseGrid";
import type { DayEx, Disp, ExInfo } from "../logic/workoutTypes";

const clock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// For a timed exercise the row's "reps" box holds seconds or metres (the database stores reps = 1 plus duration_s / distance_m).
const toSaved = (s: SetRow) => ({ id: s.id, load: s.load, reps: s.durationS ?? s.distanceM ?? s.reps, rir: s.rir, warmup: s.warmup, tags: s.tags });
const NO_STATE = (slot: string): ExerciseState => ({ slot, removed: false, replacedBy: null, note: "", restOff: DEFAULT_EXERCISE_REST_OFF, added: false, position: null, superset: null });

/** Owns the active session, persistence, and exercise actions. */
export function useWorkoutSession() {
  const { repos, gyms, workout, finish, programmes, restAlerts, mlEvaluation, achievements, db } = useServices();
  const { t, lang, unit, unitText, fmt } = useI18n();
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
  const [focusRow, setFocusRow] = useState<{ exId: string; key: string; nonce: number } | null>(null);
  const [cardListText, setCardListText] = useState<Record<string, string>>({});
  const [sets, setSets] = useState<SetRow[]>([]);
  const [previousSource, setPreviousSource] = useState<PreviousSource>("any");
  const [strengthPr, setStrengthPr] = useState<{ setId: string; version: number } | null>(null);
  const prPreviewVersion = useRef(0);
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
  /** Replace-with sheet: program slot plus optional "feels off" filter. Null until the lifter asks. */
  const [subFor, setSubFor] = useState<{ slot: string; fatigue: boolean } | null>(null);
  /** The row whose type (normal / warm-up / drop / failure) is being chosen. */
  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  /** The exercise for which "Superset with ..." is being chosen. */
  const [ssFor, setSsFor] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessFlag | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [kindFor, setKindFor] = useState<{ exId: string; key: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const { timer, setTimer, timerOpen, setTimerOpen, restFor, setRestFor, rest, restOver, setRestOver } = useWorkoutRest();
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

  const { liveCards, reportedSymptoms, setReportedSymptoms, liveDismissed, setLiveDismissed, liveManual, setLiveManual } = useWorkoutSuggestions({ loaded, rows, setRows, sets, exState, makeDisp, readiness });

  /** Target, reason, last performance and prefill for one shown exercise. A swapped-in exercise has no stored target (it is not in the program). */
  const buildInfo = useCallback(
    async (ex: Disp, sessionId: string, gym: GymFingerprint): Promise<ExInfo> => {
      const { proposal, lineId, line } = await workout.liveProposal(
        { exerciseId: ex.exerciseId, name: ex.nameEn, measure: ex.measure, equipment: ex.equipment, setup: ex.setup, repMin: ex.repMin, repMax: ex.repMax, programmeRepMin: ex.programmeRepMin, programmeRepMax: ex.programmeRepMax, repCeiling: ex.repCeiling, repCeilingIsCustom: ex.repCeilingIsCustom, isGoalLift: ex.isGoalLift, trackEffort: ex.trackEffort, sets: ex.sets, topSets: ex.topSets },
        gym,
      );
      const personalHistory = await workout.getHistory(line, lineId);
      const previous = await workout.previousPerformances(ex.exerciseId, dayId);
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
      const history = personalHistory.map((h) => ({ performedAt: h.performedAt, sets: h.sets }));
      if (d.load !== null || isTimed(m)) return { proposal, line, lineId, last, previous, stored, personalHistory: history, prefill: { load: d.load, reps: d.reps } };
      const bwRaw = await repos.getSetting("bodyweight_kg");
      const bw = bwRaw ? Number(bwRaw) : NaN;
      const est = estimateStartingLoad({
        pattern: ex.pattern,
        equipment: ex.equipment,
        setup: ex.setup,
        bodyweightKg: Number.isFinite(bw) ? bw : null,
        spec: ex.loadSpec ?? findSpec(gym, ex.equipment),
      });
      return { proposal, line, lineId, last, previous, stored, personalHistory: history, prefill: est ? { load: est.load, reps: ex.repMin, estimated: true } : { load: d.load, reps: d.reps } };
    },
    [workout, finish, repos, dayId],
  );

  // Open (or resume) the session exactly once; leaving and coming back never creates a second one. A failed open is an error with a
  // retry (`attempt`), not "no gym".
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const gymId = await repos.getActiveGymId();
      if (!gymId) return setLoaded("nogym");
      let gym = await repos.loadGymFingerprint(gymId);
      if (unit === "kg") {
        const upgraded = upgradeLegacyKgDumbbells(gym.loads);
        if (upgraded) {
          const detail = await gyms.getGym(gymId);
          if (detail && !detail.isSample) {
            await gyms.updateGym(gymId, { name: detail.name, loads: upgraded });
            gym = await repos.loadGymFingerprint(gymId);
          }
        }
      }
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
      const slots = await attachLoads(db, gym, [...programmeSlots, ...addedSlots]);
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
      setPreviousSource(parsePreviousSource(await repos.getSetting(PREVIOUS_SOURCE_KEY)));
      const flag = parseReadiness(session?.readiness);
      setReadiness(flag === "fatigued" || flag === "returning" ? flag : null);
      setExState(states);
      setSets(all);
      setRows(initial);
      setLoaded({ sessionId: id, resumed, startedAt: session?.started_at ?? Date.now(), pausedMs: session?.paused_ms ?? 0, pausedAt: session?.paused_at ?? null, gym, slots, info });
      if (resumed) setResumeNote(true);
    })().catch((e) => {
      diagnostics.record("error", "open workout", e);
      startedRef.current = false;
      setLoadError(true);
    });
  }, [repos, gyms, workout, programmes, mlEvaluation, db, dayId, unit, makeDisp, buildInfo, attempt]);

  useEffect(() => {
    if (!resumeNote) return;
    const h = setTimeout(() => setResumeNote(false), RESUMED_NOTE_MS);
    return () => clearTimeout(h);
  }, [resumeNote]);

  // Static feedback also respects reduced motion. No celebration is consumed here.
  useEffect(() => {
    if (!strengthPr) return;
    const handle = setTimeout(() => setStrengthPr(null), 4000);
    return () => clearTimeout(handle);
  }, [strengthPr]);
  useEffect(() => () => { prPreviewVersion.current++; }, []);

  function clearStrengthPr() {
    prPreviewVersion.current++;
    setStrengthPr(null);
  }

  async function choosePreviousSource(source: PreviousSource) {
    try {
      await repos.setSetting(PREVIOUS_SOURCE_KEY, source);
      setPreviousSource(source);
    } catch (e) {
      diagnostics.record("warn", "save Previous source", e);
      Alert.alert(t("workout.saveFailed.title"), t("workout.saveFailed.body"));
    }
  }

  useEffect(() => {
    void repos.getSetting(JUMP_SETTING_KEY).then((v) => setJumpThreshold(parseJumpThreshold(v)));
  }, [repos]);

  // Leaving the logger drops the in-app timer, so drop its alert too (no stray buzz after the workout). Pending notes are saved.
  useEffect(
    () => () => {
      const sid = sessionRef.current;
      if (!sid) return;
      for (const [slot, text] of Object.entries(notesPending.current)) {
        clearTimeout(noteTimers.current[slot]);
        void workout.patchExerciseState(sid, slot, { note: text }).catch(() => undefined);
      }
    },
    [workout],
  );

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

  const patch = (exId: string, key: string, change: Parameters<typeof editRow>[2]) => {
    clearStrengthPr();
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
    setLiveManual(m => { const { [ex.exerciseId]: _own, ...rest } = m; return rest; });
    setBusy(row.key);
    clearStrengthPr();
    const previewVersion = prPreviewVersion.current;
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
      // The save and next-set flow never wait for achievement evaluation.
      void achievements.previewStrengthPr(loaded.sessionId, row.key).then(qualified => {
        if (qualified && prPreviewVersion.current === previewVersion) setStrengthPr({ setId: row.key, version: previewVersion });
      }).catch(e => diagnostics.record("warn", "preview strength PR", e));
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
    clearStrengthPr();
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
    clearStrengthPr();
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

  const durationBusy = useRef(false);
  async function toggleDurationPause() {
    if (!loaded || loaded === "nogym" || durationBusy.current) return;
    durationBusy.current = true;
    const nowMs = Date.now();
    const next = loaded.pausedAt != null ? resumeClock(loaded.pausedMs, loaded.pausedAt, nowMs) : pauseClock(loaded.pausedMs, loaded.pausedAt, nowMs);
    setLoaded({ ...loaded, ...next });
    try {
      if (loaded.pausedAt != null) await workout.resumeDuration(loaded.sessionId);
      else await workout.pauseDuration(loaded.sessionId);
    } catch (e) {
      diagnostics.record("warn", "pause duration", e);
      const s = await workout.getSession(loaded.sessionId).catch(() => null);
      if (s) setLoaded((cur) => (cur && cur !== "nogym" ? { ...cur, pausedMs: s.paused_ms ?? 0, pausedAt: s.paused_at ?? null } : cur));
    } finally {
      durationBusy.current = false;
    }
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
    setSubFor({ slot: ex.slot, fatigue: false });
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
      const next: Loaded = { ...lo, slots: await attachLoads(db, lo.gym, [...programmeSlots, ...addedSlots]) };
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
    setSubFor(null);
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
      const attached = (await attachLoads(db, loaded.gym, [ad]))[0]!;
      const lo: Loaded = { ...loaded, slots: loaded.slots.some((x) => x.exerciseId === exerciseId) ? loaded.slots : [...loaded.slots, attached] };
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

  if (loaded === null && loadError) return { phase: "error", retry: () => { setLoadError(false); setAttempt(n => n + 1); }, navigation } as const;
  if (loaded === null) return { phase: "loading", navigation } as const;
  if (loaded === "nogym") return { phase: "nogym", navigation } as const;

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
  const fatigueSlots = shown.map((ex) => ({
    exerciseId: ex.exerciseId,
    name: exerciseLabels(ex, lang).primary,
    muscle: muscleGroupOf({ seedKey: ex.seedKey ?? null, pattern: ex.pattern, equipment: ex.equipment }),
    done: sets.some((s) => s.exerciseId === ex.exerciseId && trustedWorkingSet(s)),
  }));
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
      () => workout.finishSession(lo.sessionId).then(() => void achievements.sync().catch((e) => diagnostics.record("warn", "achievements after finish", e))),
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
  const alternatives = source ? substitutionCandidates({
    current: source,
    library,
    gymEquipment: loaded.gym.loads.map((spec) => spec.equipment),
    exclude: shown.map((row) => row.exerciseId),
  }) : [];

  const exerciseProps = (ex: Disp, position: number): React.ComponentProps<typeof WorkoutExerciseSection> | null => {
    const info = loaded.info[ex.exerciseId];
    if (!info) return null;
    const list = rows[ex.exerciseId] ?? [];
    const candidate = liveCards[ex.exerciseId];
    const currentCandidate = candidate && candidate.snapshot === JSON.stringify(list) && candidate.performance === livePerformanceKey(sets, ex.exerciseId) ? candidate : undefined;
    const fatigue = sessionOrderFatigue(fatigueSlots, ex.exerciseId);
    const protectFirst = !currentCandidate && info.proposal.currency === "load";
    const afterExercise = fatigue && !protectFirst ? fatigue.earlierName : null;
    const whyReadiness = !protectFirst && (readiness === "fatigued" || readiness === "returning") ? readiness : null;
    const card = currentCandidate && liveDismissed[ex.exerciseId] !== currentCandidate.performance
      && livePromptVisible(currentCandidate.decision.action, ex.exerciseId === focus) ? currentCandidate : undefined;
    const detailKey = card ? `${ex.exerciseId}:${card.performance}:${card.key}` : null;
    return {
      active: ex.exerciseId === focus,
      previousSource: previousSource,
      strengthPrSetId: strengthPr?.setId,
      liveDetailsOpen: detailKey !== null && liveDetails === detailKey,
      onLiveDetails: () => setLiveDetails(current => current === detailKey ? null : detailKey),
      ex: ex,
      position: position,
      info: info,
      list: list,
      st: exState[ex.slot] ?? NO_STATE(ex.slot),
      gym: loaded.gym,
      exSets: setsByEx.get(ex.exerciseId) ?? [],
      outliers: outliers,
      candidate: currentCandidate,
      card: card,
      expanded: !!whyOpen[ex.exerciseId],
      supersetLabel: ssLabel[ex.slot],
      afterExercise: afterExercise,
      readiness: whyReadiness,
      restDurationMs: timer.durationMs,
      busy: busy !== null,
      warmOpen: warmOpen === ex.exerciseId,
      warmDone: !!warmDone[ex.exerciseId],
      onOpenProgress: () => navigation.dispatch(StackActions.push("LiftTrend", { lineId: info.lineId })),
      onToggleRest: () => void toggleRest(ex.slot),
      onMenu: () => setMenuFor(ex.slot),
      onOpenTrend: () => (navigation as { navigate: (name: string, params?: object) => void }).navigate("LiftTrend", { lineId: info.lineId }),
      onWhy: () => info.stored ? navigation.dispatch(StackActions.push("Why", { targetId: info.stored.id })) : setWhyOpen(w => ({ ...w, [ex.exerciseId]: !whyOpen[ex.exerciseId] })),
      onWhyLong: () => setWhyOpen(w => ({ ...w, [ex.exerciseId]: !whyOpen[ex.exerciseId] })),
      onPatch: (key, change) => patch(ex.exerciseId, key, change),
      onKind: row => setKindFor({ exId: ex.exerciseId, key: row.key }),
      onAskDelete: row => askDrop(ex, row),
      onDelete: row => void dropRow(ex, row),
      onLog: row => { setPreferredExercise(ex.exerciseId); void logRow(ex, row); },
      onUntick: row => void untick(ex, row),
      onLiveApply: () => {
          if (!card || card.decision.action === "stop") return;
          setLiveManual(m => { const { [ex.exerciseId]: _own, ...rest } = m; return rest; });
          setRows(r => ({ ...r, [ex.exerciseId]: takeLiveTarget(r[ex.exerciseId] ?? [], card.key, card.decision.suggestedWeightKg, card.decision.suggestedReps) }));
          setPreferredExercise(ex.exerciseId);
          setFocusRow({ exId: ex.exerciseId, key: card.key, nonce: Date.now() });
        },
      onLiveOwn: () => {
          if (!card) return;
          setLiveManual(m => ({ ...m, [ex.exerciseId]: true }));
          setRows(r => ({ ...r, [ex.exerciseId]: clearLiveTarget(r[ex.exerciseId] ?? [], card.key) }));
          setPreferredExercise(ex.exerciseId);
          setFocusRow({ exId: ex.exerciseId, key: card.key, nonce: Date.now() });
        },
      onPickJump: kg => void persistCardLoads(ex, specWithJump(ex.equipment, kg, ex.loadSpec, findSpec(loaded.gym, ex.equipment))),
      listText: cardListText[ex.exerciseId] ?? (ex.loadSpec?.loads?.length ? ex.loadSpec.loads.map(x => weightText(x, unit)).join(", ") : ""),
      onListChange: text => setCardListText(cur => ({ ...cur, [ex.exerciseId]: text })),
      onSaveList: () => {
          const listText = cardListText[ex.exerciseId] ?? "";
          const built = buildLoads({ ...emptyLoadsForm(), mode: "list", listText }, ex.equipment, unit, specValues(ex.loadSpec));
          if (built.problems.length > 0) {
            const pr = built.problems[0]!;
            Alert.alert(t(`loads.problem.${pr.code}` as never, { bad: (pr.detail ?? []).join(" ") }));
            return;
          }
          if (built.spec) void persistCardLoads(ex, built.spec);
        },
      focusRow: focusRow?.exId === ex.exerciseId ? { key: focusRow.key, nonce: focusRow.nonce } : null,
      onLiveReport: symptom => {
          if (!card) return;
          setReportedSymptoms(s => ({ ...s, [ex.exerciseId]: reportedSymptomDecision(card.decision, symptom) }));
          setLiveDismissed(d => { const { [ex.exerciseId]: _dismissed, ...rest } = d; return rest; });
        },
      onLiveKeep: () => { if (card) setLiveDismissed(d => ({ ...d, [ex.exerciseId]: card.performance })); },
      onOutlierConfirm: async set => {
          await workout.setOutlierStatus(set.id, "confirmed");
          await reload(loaded.sessionId);
        },
      onOutlierReject: async set => {
          await workout.setOutlierStatus(set.id, "rejected");
          setRows(r => ({ ...r, [ex.exerciseId]: removeRow(r[ex.exerciseId] ?? [], set.id) }));
          await reload(loaded.sessionId);
        },
      onWarmOpen: () => setWarmOpen(ex.exerciseId),
      onWarmClose: () => setWarmOpen(null),
      onWarmConfirm: async steps => {
          setBusy("warm");
          try {
            await workout.addWarmups(loaded.sessionId, ex.exerciseId, steps, { gym: loaded.gym, equipment: ex.equipment, setup: ex.setup });
            await reload(loaded.sessionId);
            setWarmOpen(null);
            setWarmDone(d => ({ ...d, [ex.exerciseId]: true }));
          } finally { setBusy(null); }
        },
      onAddSet: () => setRows(r => ({ ...r, [ex.exerciseId]: addRow(r[ex.exerciseId] ?? [], info.prefill, () => Crypto.randomUUID()) }))
    };
  };

  const menuEx = menuFor ? shown.find((e) => e.slot === menuFor) : undefined;
  const subEx = subFor ? shown.find((e) => e.slot === subFor.slot) : undefined;
  const subLib = subEx ? library.find((l) => l.id === subEx.exerciseId) : undefined;
  const subCands = subEx
    ? substitutionCandidates({
        current: { id: subEx.exerciseId, pattern: subEx.pattern, equipment: subEx.equipment, seedKey: subLib?.seedKey ?? null, measure: subEx.measure, setup: subEx.setup },
        library,
        gymEquipment: loaded.gym.loads.map((l) => l.equipment),
        fatigue: subFor?.fatigue,
        exclude: shown.map((e) => e.exerciseId),
      }).slice(0, 8)
    : [];
  const machineEx = machineFor ? shown.find((e) => e.slot === machineFor) : undefined;
  const machineChoice = machineEx ? library.find(e => e.id === machineEx.exerciseId) : undefined;
  async function persistCardLoads(ex: Disp, spec: GymLoadSpec) {
    if (busy || !loaded || loaded === "nogym") return;
    setBusy("machine-weights");
    try {
      await programmes.setLineLoads(ex.exerciseId, loaded.gym.gymId, ex.setup, spec);
      const resolved = await resolveLoads(db, loaded.gym, ex.exerciseId, ex.equipment, ex.setup);
      const slots = loaded.slots.map(slot => slot.exerciseId === ex.exerciseId ? { ...slot, loadSpec: resolved.spec, loadSource: resolved.source } : slot);
      const currentSlot = slots.find(slot => slot.exerciseId === ex.slot);
      if (!currentSlot) return;
      const updatedEx = makeDisp(currentSlot, exState[ex.slot]);
      const info = await buildInfo(updatedEx, loaded.sessionId, loaded.gym);
      setLoaded(prev => prev && prev !== "nogym" ? { ...prev, slots, info: { ...prev.info, [ex.exerciseId]: info } } : prev);
      setLiveManual(m => { const { [ex.exerciseId]: _own, ...rest } = m; return rest; });
    } catch (e) {
      diagnostics.record("error", "card load steps", e);
      Alert.alert(t("loads.preset.failed"));
    } finally { setBusy(null); }
  }
  async function chooseMachineStep(ex: Disp, kind: MachineLoadKind, step?: PinMachineStep) {
    if (busy || !loaded || loaded === "nogym") return;
    setBusy("machine-weights");
    try {
      await programmes.setMachineLoadKind(ex.exerciseId, kind, step);
      const updatedLibrary = await programmes.listExercises();
      libRef.current = updatedLibrary;
      setLibrary(updatedLibrary);
      const resolved = await resolveLoads(db, loaded.gym, ex.exerciseId, ex.equipment, ex.setup);
      const slots = loaded.slots.map(slot => slot.exerciseId === ex.exerciseId ? { ...slot, loadSpec: resolved.spec, loadSource: resolved.source } : slot);
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
  return { phase: "ready",
    timerOpen, timerRunning, restOver, navigation, setHelpOpen,
    setRestOver, setTimerOpen, timer, finishing, askFinish,
    loaded, status, toggleDurationPause, summary, sets,
    summaryOpen, setSummaryOpen, readiness, setReadiness, workout,
    source, previousSource, choosePreviousSource, finishFailed, doFinish,
    shown, setReorderOpen, exerciseProps, setAddOpen, removedSlots,
    restore, unlogged, restFor, setTimer, reorderOpen,
    t, busy, reorderSaving, reorderGroups, namesBySlot,
    commitReorder, helpOpen, jumpAsk, lang, unit,
    setJumpAsk, okJumps, logRow, patch, menuEx,
    setMenuFor, noteInputs, focus, setMachineFor, exState,
    startReplace, setSsFor, ssLabel, applySuperset, askRemove,
    machineEx, machineChoice, chooseMachineStep, kindFor, setKindFor,
    rows, ssFor, subFor, subCands, setSubFor,
    replaceWith, setPickFor, addOpen, library, addExerciseToday,
    programmes, libRef, setLibrary, pickFor, alternatives,
    reload,
  } as const;
}

export type WorkoutSession = Extract<ReturnType<typeof useWorkoutSession>, { phase: "ready" }>;
