import { StackActions, useNavigation, useRoute } from "@react-navigation/native";
import { findSpec, nextLoadAbove, renderReason, type GymFingerprint, type LineIdentity, type LoggedSet, type Measure, type OutlierResult, type Proposal } from "@gain/engine";
import * as Crypto from "expo-crypto";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, useWindowDimensions, Vibration, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { adjustKeyboardInsets } from "../numberPad";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { CellInput, MenuSheet, RestToggle, SwipeRow, TargetLine } from "../components/LogParts";
import { Icon } from "../components/Icon";
import { ExercisePicker } from "../components/ExercisePicker";
import { WorkoutHelp } from "../components/WorkoutHelp";
import type { TargetRow } from "../db/finishRepo";
import type { LibraryExercise } from "../db/programmeRepo";
import type { ExerciseState, SetRow } from "../db/workoutRepo";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { localizeReason, weightText } from "../logic/units";
import { useI18n } from "../i18n";
import { defaultRestSettings, loadRestSettings, syncRestAlert, type RestSettings } from "../logic/restAlert";
import { warmupOffer, warmupsUsuallySkipped } from "../logic/warmups";
import { joinSuperset, leaveSuperset, orderSlots, restAfterSet, supersetLabels } from "../logic/superset";
import { initialDraft } from "../logic/draft";
import { finishChoice } from "../logic/finishChoice";
import { attemptFinish } from "../logic/loadState";
import { checkJump, jumpOptions, JUMP_SETTING_KEY, parseJumpThreshold, type JumpCheck } from "../logic/jumpGuard";
import { isTimed, parseQuantityInput, previousQuantityText, quantityFields, quantityText, setQuantity } from "../logic/quantity";
import { formatDuration, liveSummary, previousText, volumeText, workingIndexes } from "../logic/liveSummary";
import { parseLoadInput, parseRepsInput, parseRirInput } from "../logic/setInput";
import { acceptGhost, addRow, currentRowKey, editRow, effectiveOf, initialRows, isDropRow, kindOf, kindPatch, loggerGhosts, markSaved, mergeRows, pendingCount, removeRow, roleForWorkingIndex, rowCanLog, rowLabels, SET_KINDS, type SetKind, unloggedFilled, unlogRow, withRoleTag, workingIndexOf, type Prefill, type SetRowDraft } from "../logic/workoutRows";
import { RESUMED_NOTE_MS, saveStatusKind } from "../logic/saveStatus";
import { adjustTimer, formatClock, isDone, newTimer, remainingMs, startTimer, stopTimer, type RestTimer } from "../logic/restTimer";
import { radius, space, type as ty, useLogPalette } from "../theme";
import { AppText, BigButton, ErrorState, IconButton, InlineStatus, LoadingState, Notice } from "../ui";

type DayEx = Awaited<ReturnType<ReturnType<typeof useServices>["repos"]["listDayExercises"]>>[number];
/** What is shown for one program slot today: the program's exercise, or the one swapped in for today. `slot` = the program's exercise id. */
type Disp = DayEx & { slot: string };
interface ExInfo {
  proposal: Proposal;
  line: LineIdentity;
  last: { performedAt: string; sets: LoggedSet[] } | null;
  /** The target written when the previous workout was finished, if any. */
  stored: TargetRow | null;
  prefill: Prefill;
}
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
const NO_STATE = (slot: string): ExerciseState => ({ slot, removed: false, replacedBy: null, note: "", restOff: false, added: false, position: null, superset: null });

/**
 * The rest-timer readout. It ticks every 250 ms on its own (P27), so the logger screen is not re-rendered four times a second while a
 * rest counts down. The timer value (an end time) is owned by the screen; this only reads it.
 */
const RestClock = memo(function RestClock({ timer, style }: { timer: RestTimer; style: TextStyle }) {
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

/** Ticks once a second on its own, so the rest of the screen does not re-render every second. */
function LiveDuration({ startedAt, color }: { startedAt: number; color: string }) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  return (
    <AppText ltr style={{ fontSize: 20, fontWeight: "600", color }}>
      {formatDuration(now - startedAt, { h: t("workout.dur.h"), m: t("workout.dur.m"), s: t("workout.dur.s") })}
    </AppText>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  const p = useLogPalette();
  return (
    <View style={{ gap: 2, minWidth: 74 }}>
      <AppText style={{ color: p.muted, fontSize: 13 }}>{label}</AppText>
      {children}
    </View>
  );
}

/**
 * The active workout (v0.9.0 layout, after Hevy's "Log Workout"): a top bar with collapse, rest timer and Finish; a live Duration / Volume /
 * Sets row; then ONE scrolling list of every exercise. Each exercise has its name, a menu (notes / replace / remove), a notes field, its rest
 * timer line, GAIN's target with a one-line reason, and a SET | PREVIOUS | KG | REPS | tick table. KG and REPS are plain typed boxes whose ghost text is
 * today's target, so one tap on the tick accepts it. A set is saved on the phone the moment it is ticked (offline); nothing waits for the finish.
 */
export function WorkoutScreen() {
  const { repos, workout, finish, programmes, restAlerts } = useServices();
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = useLogPalette();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
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
  const [whyOpen, setWhyOpen] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  /** The row whose type (normal / warm-up / drop / failure) is being chosen. */
  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  /** The exercise for which "Superset with ..." is being chosen. */
  const [ssFor, setSsFor] = useState<string | null>(null);
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
    if (lib) return { ...slotEx, exerciseId: lib.id, nameEn: lib.nameEn, nameAr: lib.nameAr, aliasesAr: lib.aliasesAr, equipment: lib.equipment, setup: lib.setup, measure: lib.measure, isGoalLift: false, repCeilingIsCustom: false, slot: slotEx.exerciseId };
    return { ...slotEx, slot: slotEx.exerciseId };
  }, []);

  /** Target, reason, last performance and prefill for one shown exercise. A swapped-in exercise has no stored target (it is not in the program). */
  const buildInfo = useCallback(
    async (ex: Disp, sessionId: string, gym: GymFingerprint): Promise<ExInfo> => {
      const { proposal, lineId, line } = await workout.liveProposal(
        { exerciseId: ex.exerciseId, name: ex.nameEn, measure: ex.measure, equipment: ex.equipment, setup: ex.setup, repMin: ex.repMin, repMax: ex.repMax, programmeRepMin: ex.programmeRepMin, programmeRepMax: ex.programmeRepMax, repCeiling: ex.repCeiling, repCeilingIsCustom: ex.repCeilingIsCustom, isGoalLift: ex.isGoalLift, trackEffort: ex.trackEffort, sets: ex.sets, topSets: ex.topSets },
        gym,
      );
      const last = await workout.lastPerformance(line, lineId);
      const stored = ex.exerciseId === ex.slot ? await finish.getTargetForExercise(sessionId, ex.exerciseId) : null;
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
      return { proposal, line, last, stored, prefill: { load: d.load, reps: d.reps } };
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
        const ghosts = loggerGhosts({ timed: isTimed(ex.measure), topSets: ex.topSets, lastWorking: info[ex.exerciseId]!.last?.sets, stored: info[ex.exerciseId]!.stored, plannedSets: ex.sets });
        initial[ex.exerciseId] = initialRows(all.filter((s) => s.exerciseId === ex.exerciseId).map(toSaved), ex.sets, info[ex.exerciseId]!.prefill, () => Crypto.randomUUID(), ghosts.backoff, ghosts.perSet);
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
  }, [repos, workout, programmes, dayId, makeDisp, buildInfo, attempt]);

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

  const patch = (exId: string, key: string, change: Parameters<typeof editRow>[2]) => setRows((r) => ({ ...r, [exId]: editRow(r[exId] ?? [], key, change) }));

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
    const role = !isTimed(ex.measure) && !row.warmup && !isDropRow(row) ? roleForWorkingIndex(ex.topSets, workingIndexOf(rows[ex.exerciseId] ?? [], row.key)) : null;
    const tags = withRoleTag(row.tags, role);
    try {
      if (!row.saved) {
        const r = await workout.logSet({ id: row.key, sessionId: loaded.sessionId, exerciseId: ex.exerciseId, load, ...qf, rir: isTimed(ex.measure) ? null : row.rir, warmup: row.warmup, tags }, ctx);
        if (r.outlier?.verdict === "unconfirmed") setOutliers((o) => ({ ...o, [r.id]: r.outlier! }));
        // No rest timer after a warm-up or a drop set (the next set follows straight away).
        // In a superset the rest comes after the last exercise of the round only.
        if (!row.warmup && !isDropRow(row) && !exState[ex.slot]?.restOff && restAfterSet(order, exState, ex.slot)) {
          setRestOver(false);
          setRestFor(exerciseLabels(ex, lang).primary);
          setTimer((tm) => startTimer(tm, Date.now()));
        }
      } else if (row.dirty) {
        const r = await workout.updateLiveSet(row.key, { load, ...qf, rir: isTimed(ex.measure) ? null : row.rir, warmup: row.warmup, tags }, ctx);
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
    const off = !(exState[slot]?.restOff ?? false);
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
    const ghosts = loggerGhosts({ timed: isTimed(ex.measure), topSets: ex.topSets, lastWorking: info.last?.sets, stored: info.stored, plannedSets: ex.sets });
    setRows((r) => ({ ...r, [ex.exerciseId]: initialRows(saved, ex.sets, info.prefill, () => Crypto.randomUUID(), ghosts.backoff, ghosts.perSet) }));
  }

  async function replaceWith(slot: string, exerciseId: string) {
    if (!loaded || loaded === "nogym") return;
    const slotEx = loaded.slots.find((s) => s.exerciseId === slot);
    if (!slotEx) return;
    const cur = makeDisp(slotEx, exState[slot]);
    setPickFor(null);
    try {
      await workout.replaceExercise(loaded.sessionId, slot, cur.exerciseId, exerciseId === slot ? null : exerciseId);
    } catch {
      return void Alert.alert(t("workout.replace.blocked"));
    }
    const st: ExerciseState = { ...(exState[slot] ?? NO_STATE(slot)), replacedBy: exerciseId === slot ? null : exerciseId, removed: false };
    setState(slot, st);
    setRows((r) => {
      const { [cur.exerciseId]: _gone, ...others } = r;
      return others;
    });
    await showSlot(loaded, slot, st);
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

  const renderExercise = (ex: Disp, position: number) => {
    const info = loaded.info[ex.exerciseId];
    if (!info) return null;
    const list = rows[ex.exerciseId] ?? [];
    const st = exState[ex.slot] ?? NO_STATE(ex.slot);
    const labels = exerciseLabels(ex, lang);
    const pr = info.proposal;
    const spec = ex.loadSpec ?? findSpec(loaded.gym, ex.equipment);
    const exSets = setsByEx.get(ex.exerciseId) ?? [];
    const numbering = rowLabels(list);
    const widx = workingIndexes(list);
    const workingLoad = info.stored ? (info.stored.status === "rejected" ? null : info.stored.effectiveLoad) : pr.status === "proposed" ? pr.load : null;
    const timed = isTimed(ex.measure);
    const qUnits = { s: t("qty.s"), m: t("qty.m") };
    const offer = timed ? ({ kind: "none", reason: "already_started" } as unknown as ReturnType<typeof warmupOffer>) : warmupOffer({ workingLoad, spec, setup: ex.setup, loggedToday: exSets.length });
    const pending = exSets.filter((s) => s.outlierStatus === "unconfirmed");
    const expanded = !!whyOpen[ex.exerciseId];

    // GAIN's target for today and its reason, kept to one line until tapped.
    const storedQ = info.stored ? (ex.measure === "time" ? info.stored.durationS : ex.measure === "distance" ? info.stored.distanceM : info.stored.reps) : null;
    const proposedQ = ex.measure === "time" ? pr.durationS ?? null : ex.measure === "distance" ? pr.distanceM ?? null : pr.reps;
    const targetNone = info.stored ? info.stored.status === "rejected" || info.stored.effectiveLoad === null || storedQ === null : !(pr.status === "proposed" && pr.load !== null && proposedQ !== null);
    const tLoad = info.stored ? info.stored.effectiveLoad : pr.load;
    const tReps = info.stored ? storedQ : proposedQ;
    // A hold or carry target: "45 s" (or "24 kg × 45 s" when it is loaded); a reps target: "60 kg × 8".
    const targetText = targetNone ? t("workout.targetNone") : timed ? ((tLoad as number) > 0 ? `${formatLoad(tLoad as number, lang, unit)} × ${isolateLtr(quantityText(tReps as number, ex.measure, qUnits))}` : isolateLtr(quantityText(tReps as number, ex.measure, qUnits))) : `${formatLoad(tLoad as number, lang, unit)} × ${isolateLtr(String(tReps))}`;
    const reasonText = info.stored?.status === "rejected" ? t("finish.rejectedNote") : renderReason(localizeReason(info.stored ? info.stored.reason : pr.reason, unit, lang), lang);

    const colSet = { width: 48, alignItems: "center" as const };
    const colTick = { width: 48, alignItems: "center" as const };
    const head = { color: p.muted, fontSize: 13, fontWeight: "600" as const, textAlign: "center" as const };
    // At large font sizes the five columns no longer fit side by side: the row becomes two lines (set, previous, tick / weight, reps).
    const stacked = fontScale > 1.3;

    return (
      <View key={ex.id} style={{ paddingTop: space.md, borderStartWidth: ssLabel[ex.slot] ? 4 : 0, borderStartColor: p.fill }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, paddingStart: space.lg, paddingEnd: space.xs }}>
          <View style={{ flex: 1 }}>
            {ssLabel[ex.slot] ? (
              <AppText style={{ color: p.accent, fontSize: 13, fontWeight: "600" }}>{t("workout.superset.label", { letter: ssLabel[ex.slot]! })}</AppText>
            ) : null}
            <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{labels.primary}</AppText>
            {labels.secondary ? <AppText style={{ color: p.muted, fontSize: 13 }}>{labels.secondary}</AppText> : null}
          </View>
          {/* Rest control stays one tap away, in the exercise header: the length (or Off) beside the options menu, not a row of its own. */}
          <RestToggle off={st.restOff} text={st.restOff ? t("workout.restOffShort") : formatClock(timer.durationMs)} a11y={`${st.restOff ? t("workout.restLineOff") : t("workout.restLine", { time: formatClock(timer.durationMs) })}: ${labels.primary}`} onPress={() => void toggleRest(ex.slot)} />
          <IconButton icon="more" label={`${t("workout.menu.title")}: ${labels.primary}`} color={p.muted} onPress={() => setMenuFor(ex.slot)} />
        </View>

        {/* Tight vertical rhythm (spacing tokens): exercise block starts space.md below the previous one; heading, target line and set table sit directly on each other (the 48 dp controls already carry the breathing room), with space.xs above the column heads. */}
        {/* Compact target line: "Target 55 kg × 9 · Why". It wraps onto a second line when it is long and is never cut off. */}
        <View style={{ paddingHorizontal: space.lg }}>
          <TargetLine
            label={t("workout.nextTarget")}
            value={targetText}
            whyLabel={t("workout.whyShort")}
            whyA11y={`${t("workout.whyShort")}: ${labels.primary}`}
            expanded={info.stored ? undefined : expanded}
            reason={reasonText}
            onWhy={() => (info.stored ? navigation.dispatch(StackActions.push("Why", { targetId: info.stored!.id })) : setWhyOpen((w) => ({ ...w, [ex.exerciseId]: !expanded })))}
            onWhyLong={() => setWhyOpen((w) => ({ ...w, [ex.exerciseId]: !expanded }))}
          />
          {info.stored && expanded ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{reasonText}</AppText> : null}
          {ex.topSets && !timed ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("workout.topset.note", { n: ex.topSets })}</AppText> : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, marginTop: space.xs }}>
          <View style={colSet}><AppText style={head}>{t("workout.col.set").toUpperCase()}</AppText></View>
          <View style={{ flex: 1.3 }}><AppText style={head}>{t("workout.col.prev").toUpperCase()}</AppText></View>
          {stacked ? null : (
            <>
              <View style={{ flex: 1 }}><AppText style={head}>{unitText.toUpperCase()}</AppText></View>
              <View style={{ flex: 1 }}><AppText style={head}>{(timed ? (ex.measure === "time" ? t("workout.col.sec") : t("workout.col.metres")) : t("workout.col.reps")).toUpperCase()}</AppText></View>
              {ex.trackEffort ? <View style={{ width: 52 }}><AppText style={head}>{t("workout.col.rir").toUpperCase()}</AppText></View> : null}
            </>
          )}
          <View style={colTick}><Icon name="check" color={p.muted} size={16} /></View>
        </View>

        <View>
          {list.map((row, i) => {
            const done = row.saved && !row.dirty;
            const canTick = rowCanLog(row);
            const current = currentRowKey(list) === row.key;
            // Ticked rows get only a quiet wash (the muted green check says "done"; lime stays for the current set and primary actions); the set being worked on is the one with the strong wash, bar and outlined boxes.
            const bg = done ? p.doneBg : current ? p.activeBg : p.bg;
            // Every small control says which exercise and which set it belongs to (a screen reader hears a list of identical boxes otherwise).
            const ctx = t("workout.setContext", { exercise: labels.primary, n: numbering[i] ?? i + 1 });
            const setButton = (
              <View style={colSet}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("workout.kind.title")}: ${t(`workout.kind.${kindOf(row)}` as never)}. ${ctx}`}
                  accessibilityState={{ selected: kindOf(row) !== "normal" }}
                  onPress={() => setKindFor({ exId: ex.exerciseId, key: row.key })}
                  onLongPress={() => askDrop(ex, row)}
                  style={{ width: 48, height: 48, borderRadius: radius.button, backgroundColor: p.field, alignItems: "center", justifyContent: "center" }}
                >
                  <AppText ltr style={{ fontWeight: "600", fontSize: 14, color: row.warmup ? p.warn : kindOf(row) === "normal" ? p.text : p.accent }}>{numbering[i]}</AppText>
                </Pressable>
              </View>
            );
            // Previous performance wraps instead of shrinking or cutting off.
            const previous = (
              <View style={{ flex: 1.3 }}>
                <AppText ltr style={{ color: p.muted, fontSize: 14, textAlign: "center" }}>
                  {isolateLtr(timed ? previousQuantityText(info.last?.sets ?? null, widx[i] ?? null, ex.measure, (kg) => `${weightText(kg, unit)}${unitText}`, qUnits) : previousText(info.last?.sets ?? null, widx[i] ?? null, unit, unitText))}
                </AppText>
              </View>
            );
            const loadCell = (
              <CellInput<number>
                a11y={`${t("workout.load")} (${unitText}). ${ctx}`}
                value={row.load}
                format={(v) => weightText(v, unit)}
                parse={(txt, cur) => parseLoadInput(txt, unit, cur)}
                onValue={(v) => patch(ex.exerciseId, row.key, { load: v })}
                placeholder={row.ghostLoad !== null ? weightText(row.ghostLoad, unit) : undefined}
                unitLabel={stacked ? unitText : undefined}
                decimal
                done={done}
                current={current}
              />
            );
            const repsCell = (
              <CellInput<number>
                a11y={`${timed ? (ex.measure === "time" ? t("workout.seconds") : t("workout.metres")) : t("workout.reps")}. ${ctx}`}
                value={row.reps}
                format={(v) => String(v)}
                parse={(txt) => (timed ? parseQuantityInput(txt, ex.measure) : parseRepsInput(txt))}
                decimal={ex.measure === "distance"}
                onValue={(v) => patch(ex.exerciseId, row.key, { reps: v })}
                placeholder={row.ghostReps !== null ? String(row.ghostReps) : undefined}
                unitLabel={stacked ? (timed ? (ex.measure === "time" ? t("workout.col.sec") : t("workout.col.metres")) : t("workout.col.reps")) : undefined}
                done={done}
                current={current}
              />
            );
            const rirCell = ex.trackEffort ? (
              <CellInput<number> a11y={`${t("workout.rir")}. ${ctx}`} style={{ flex: 0, width: stacked ? 96 : 52 }} value={row.rir} format={(v) => String(v)} parse={(txt) => parseRirInput(txt)} onValue={(v) => patch(ex.exerciseId, row.key, { rir: v })} unitLabel={stacked ? t("workout.col.rir") : undefined} done={done} current={current} />
            ) : null;
            const bar = current ? <View pointerEvents="none" style={{ position: "absolute", start: 0, top: 6, bottom: 6, width: 4, borderRadius: 2, backgroundColor: p.accent }} /> : null;
            const tick = (
              <View style={colTick}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done, disabled: !done && !canTick }}
                  accessibilityLabel={`${done ? t("workout.untick") : row.saved ? t("workout.tickUpdate") : t("workout.tick")}. ${ctx}`}
                  disabled={busy !== null || (!row.saved && !canTick)}
                  onPress={() => (done ? void untick(ex, row) : void logRow(ex, row))}
                  style={{ width: 48, height: 48, borderRadius: radius.button, alignItems: "center", justifyContent: "center", backgroundColor: done ? p.doneFill : p.field, borderWidth: done ? 1.5 : current ? 2 : 1.5, borderColor: done ? p.doneEdge : (row.saved && row.dirty) || current ? p.accent : p.edge, opacity: !done && !row.saved && !canTick ? 0.5 : 1 }}
                >
                  {row.saved && row.dirty ? <Icon name="edit" color={p.accent} size={20} /> : <Icon name="check" color={done ? p.onDone : p.muted} size={22} />}
                </Pressable>
              </View>
            );
            return (
              <SwipeRow key={row.key} background={bg} deleteLabel={t("workout.deleteSet")} onDelete={() => void dropRow(ex, row)}>
                {stacked ? (
                  <View style={{ gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs }}>
                    {bar}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {setButton}
                      {previous}
                      {tick}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {loadCell}
                      {repsCell}
                      {rirCell}
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, paddingVertical: 2 }}>
                    {bar}
                    {setButton}
                    {previous}
                    {loadCell}
                    {repsCell}
                    {rirCell}
                    {tick}
                  </View>
                )}
              </SwipeRow>
            );
          })}
        </View>

        {pending.map((s) => {
          const o = outliers[s.id];
          return (
            <View key={s.id} style={{ marginHorizontal: space.md }}>
              <Notice kind="warn" title={t("workout.outlier.title")}>
                <AppText>
                  {timed
                    ? isolateLtr(quantityText(setQuantity(s, ex.measure), ex.measure, qUnits))
                    : isolateLtr(`${weightText(s.load, unit)} ${unitText} × ${s.reps}`)} · {timed ? t("workout.outlier.bodyTimed") : t("workout.outlier.body", { load: o?.expected ? fmt(o.expected.medianLoad) : "?", reps: o?.expected?.medianReps ?? "?" })}
                </AppText>
                <AppText style={{ color: p.muted }}>{t("workout.outlier.note")}</AppText>
                <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                  <View style={{ flexGrow: 1, flexBasis: 140 }}>
                    <BigButton
                      label={t("workout.outlier.confirm")}
                      onPress={async () => {
                        await workout.setOutlierStatus(s.id, "confirmed");
                        await reload(loaded.sessionId);
                      }}
                    />
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 140 }}>
                    <BigButton
                      variant="secondary"
                      label={t("workout.outlier.reject")}
                      onPress={async () => {
                        await workout.setOutlierStatus(s.id, "rejected");
                        setRows((r) => ({ ...r, [ex.exerciseId]: removeRow(r[ex.exerciseId] ?? [], s.id) }));
                        await reload(loaded.sessionId);
                      }}
                    />
                  </View>
                </View>
              </Notice>
            </View>
          );
        })}

        {offer.kind === "offer" ? (
          warmOpen === ex.exerciseId ? (
            <View style={{ marginHorizontal: space.md, padding: space.md, gap: space.sm, borderRadius: radius.card, backgroundColor: p.card, borderWidth: 1, borderColor: p.line }}>
              <AppText style={{ fontWeight: "600" }}>{t("warm.title", { load: fmt(offer.workingLoad) })}</AppText>
              {offer.sets.map((w, i) => (
                <AppText key={i} ltr style={{ fontSize: 16 }}>{fmt(w.load)} × {isolateLtr(String(w.reps))}</AppText>
              ))}
              <AppText style={{ color: p.muted, fontSize: 13 }}>{t("warm.note")}</AppText>
              <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                <View style={{ flexGrow: 1, flexBasis: 140 }}>
                  <BigButton
                    label={t("warm.confirm")}
                    disabled={busy !== null}
                    onPress={async () => {
                      setBusy("warm");
                      try {
                        await workout.addWarmups(loaded.sessionId, ex.exerciseId, offer.sets, { gym: loaded.gym, equipment: ex.equipment, setup: ex.setup });
                        await reload(loaded.sessionId);
                        setWarmOpen(null);
                        setWarmDone((d) => ({ ...d, [ex.exerciseId]: true }));
                      } finally {
                        setBusy(null);
                      }
                    }}
                  />
                </View>
                <View style={{ flexGrow: 1, flexBasis: 140 }}>
                  <BigButton variant="secondary" label={t("warm.cancel")} onPress={() => setWarmOpen(null)} />
                </View>
              </View>
            </View>
          ) : (
            <View style={{ paddingHorizontal: space.md, alignItems: "flex-start" }}>
              <BigButton variant="quiet" icon="plus" label={warmupsUsuallySkipped(position, ex.pattern) ? t("warm.addAnyway") : t("warm.add")} onPress={() => setWarmOpen(ex.exerciseId)} />
            </View>
          )
        ) : null}
        {warmDone[ex.exerciseId] ? <InlineStatus kind="success" text={t("warm.added")} /> : null}
        {!spec ? <AppText style={{ color: p.muted, fontSize: 13, paddingHorizontal: space.lg }}>{t("workout.stepFallback")}</AppText> : null}

        <View style={{ paddingHorizontal: space.md }}>
          <BigButton
            variant="secondary"
            icon="plus"
            label={t("workout.addSet")}
            onPress={() => setRows((r) => ({ ...r, [ex.exerciseId]: addRow(r[ex.exerciseId] ?? [], info.prefill, () => Crypto.randomUUID()) }))}
            accessibilityHint={labels.primary}
          />
        </View>
      </View>
    );
  };

  const menuEx = menuFor ? shown.find((e) => e.slot === menuFor) : undefined;
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
          <Stat label={t("workout.stat.volume")}>
            <AppText ltr style={{ fontSize: 20, fontWeight: "600" }}>{volumeText(summary.volumeKg, unit)} {unitText}</AppText>
          </Stat>
          <Stat label={t("workout.stat.sets")}>
            <AppText ltr style={{ fontSize: 20, fontWeight: "600" }}>{summary.sets}</AppText>
          </Stat>
        </View>

        {finishFailed ? (
          <View accessibilityLiveRegion="assertive" style={{ marginHorizontal: space.md, marginBottom: space.sm }}>
            <Notice kind="error" title={t("workout.finishFailed.title")} actionLabel={t("workout.finishFailed.retry")} onAction={() => void doFinish(loaded)}>
              {t("workout.finishFailed.body")}
            </Notice>
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
                ...(exState[menuEx.slot]?.added ? [] : [{ label: t("workout.menu.replace"), onPress: () => startReplace(menuEx) }]),
                ...(shown.length > 1 ? [{ label: t("workout.menu.superset"), onPress: () => setSsFor(menuEx.slot) }] : []),
                ...(ssLabel[menuEx.slot] ? [{ label: t("workout.menu.supersetLeave"), onPress: () => void applySuperset(leaveSuperset(menuEx.slot)) }] : []),
                { label: t("workout.menu.remove"), danger: true, onPress: () => askRemove(menuEx, exerciseLabels(menuEx, lang).primary) },
              ]
            : []
        }
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
