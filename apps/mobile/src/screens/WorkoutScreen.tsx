import { StackActions, useNavigation, useRoute } from "@react-navigation/native";
import { findSpec, nextLoadAbove, renderReason, type GymFingerprint, type LineIdentity, type LoggedSet, type Measure, type OutlierResult, type Proposal } from "@gain/engine";
import * as Crypto from "expo-crypto";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { CellInput, ChevronDown, Dots, MenuSheet, Stopwatch, SwipeRow, Tick } from "../components/LogParts";
import { ExercisePicker } from "../components/ExercisePicker";
import { WorkoutHelp } from "../components/WorkoutHelp";
import type { TargetRow } from "../db/finishRepo";
import type { LibraryExercise } from "../db/programmeRepo";
import type { ExerciseState, SetRow } from "../db/workoutRepo";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { localizeReason, weightText } from "../logic/units";
import { useI18n } from "../i18n";
import { defaultRestSettings, loadRestSettings, syncRestAlert, type RestSettings } from "../logic/restAlert";
import { warmupOffer } from "../logic/warmups";
import { joinSuperset, leaveSuperset, orderSlots, restAfterSet, supersetLabels } from "../logic/superset";
import { initialDraft } from "../logic/draft";
import { finishChoice } from "../logic/finishChoice";
import { attemptFinish } from "../logic/loadState";
import { checkJump, jumpOptions, JUMP_SETTING_KEY, parseJumpThreshold, type JumpCheck } from "../logic/jumpGuard";
import { isTimed, parseQuantityInput, previousQuantityText, quantityFields, quantityText, setQuantity } from "../logic/quantity";
import { formatDuration, liveSummary, previousText, volumeText, workingIndexes } from "../logic/liveSummary";
import { parseLoadInput, parseRepsInput, parseRirInput } from "../logic/setInput";
import { acceptGhost, addRow, editRow, effectiveOf, initialRows, isDropRow, kindOf, kindPatch, markSaved, mergeRows, removeRow, rowCanLog, rowLabels, SET_KINDS, type SetKind, unloggedFilled, unlogRow, type Prefill, type SetRowDraft } from "../logic/workoutRows";
import { adjustTimer, formatClock, isDone, newTimer, remainingMs, startTimer, stopTimer, type RestTimer } from "../logic/restTimer";
import { useLogPalette } from "../theme";
import { AppText } from "../ui";

type DayEx = Awaited<ReturnType<ReturnType<typeof useServices>["repos"]["listDayExercises"]>>[number];
/** What is shown for one programme slot today: the programme's exercise, or the one swapped in for today. `slot` = the programme's exercise id. */
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

/** Ticks once a second on its own, so the rest of the screen does not re-render every second. */
function LiveDuration({ startedAt, color }: { startedAt: number; color: string }) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  return (
    <AppText ltr style={{ fontSize: 19, fontWeight: "700", color }}>
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
  const [rest, setRest] = useState<RestSettings>(defaultRestSettings());
  const [now, setNow] = useState(Date.now());
  const [restOver, setRestOver] = useState(false);
  const [jumpThreshold, setJumpThreshold] = useState(10);
  const startedRef = useRef(false);
  const libRef = useRef<LibraryExercise[]>([]);
  const noteInputs = useRef<Record<string, TextInput | null>>({});
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const notesPending = useRef<Record<string, string>>({});
  const sessionRef = useRef<string | null>(null);

  /** The exercise shown for a programme slot today. */
  const makeDisp = useCallback((slotEx: DayEx, st?: ExerciseState): Disp => {
    const lib = st?.replacedBy ? libRef.current.find((l) => l.id === st.replacedBy) : undefined;
    if (lib) return { ...slotEx, exerciseId: lib.id, nameEn: lib.nameEn, nameAr: lib.nameAr, aliasesAr: lib.aliasesAr, equipment: lib.equipment, setup: lib.setup, measure: lib.measure, isGoalLift: false, repCeilingIsCustom: false, slot: slotEx.exerciseId };
    return { ...slotEx, slot: slotEx.exerciseId };
  }, []);

  /** Target, reason, last performance and prefill for one shown exercise. A swapped-in exercise has no stored target (it is not in the programme). */
  const buildInfo = useCallback(
    async (ex: Disp, sessionId: string, gym: GymFingerprint): Promise<ExInfo> => {
      const { proposal, lineId, line } = await workout.liveProposal(
        { exerciseId: ex.exerciseId, name: ex.nameEn, measure: ex.measure, equipment: ex.equipment, setup: ex.setup, repMin: ex.repMin, repMax: ex.repMax, repCeiling: ex.repCeiling, isGoalLift: ex.isGoalLift, trackEffort: ex.trackEffort, sets: ex.sets },
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
      // Exercises added to this workout earlier (the workout was resumed) come back after the programme's own.
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
        initial[ex.exerciseId] = initialRows(all.filter((s) => s.exerciseId === ex.exerciseId).map(toSaved), ex.sets, info[ex.exerciseId]!.prefill, () => Crypto.randomUUID());
      }
      const session = await workout.getSession(id);
      setExState(states);
      setSets(all);
      setRows(initial);
      setLoaded({ sessionId: id, resumed, startedAt: session?.started_at ?? Date.now(), gym, slots, info });
    })().catch((e) => {
      diagnostics.record("error", "open workout", e);
      startedRef.current = false;
      setLoadError(true);
    });
  }, [repos, workout, programmes, dayId, makeDisp, buildInfo, attempt]);

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

  // The clock only runs while a rest is counting down.
  useEffect(() => {
    if (timer.endsAt === null) return;
    setNow(Date.now());
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, [timer.endsAt]);

  // When the rest timer reaches zero: buzz once, remember it, stop.
  useEffect(() => {
    if (timer.endsAt !== null && isDone(timer, now)) {
      if (rest.vibrate) Vibration.vibrate(400);
      setRestOver(true);
      setTimer((tm) => stopTimer(tm));
    }
  }, [now, timer, rest.vibrate]);

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
        const spec0 = findSpec(loaded.gym, ex.equipment);
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
        if (!row.warmup && !isDropRow(row) && !exState[ex.slot]?.restOff && restAfterSet(order, exState, ex.slot)) {
          setRestOver(false);
          setTimer((tm) => startTimer(tm, Date.now()));
        }
      } else if (row.dirty) {
        const r = await workout.updateLiveSet(row.key, { load, ...qf, rir: isTimed(ex.measure) ? null : row.rir, warmup: row.warmup, tags: row.tags }, ctx);
        if (r.outlier?.verdict === "unconfirmed") setOutliers((o) => ({ ...o, [row.key]: r.outlier! }));
      }
      setRows((r) => ({ ...r, [ex.exerciseId]: markSaved(r[ex.exerciseId] ?? [], row.key) }));
      await reload(loaded.sessionId);
      setSavedAt(Date.now());
    } catch (e) {
      // Storage full or the database failed: the row stays un-ticked (nothing half-saved) and the lifter is told, never left guessing.
      diagnostics.record("error", "save set", e);
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
    setRows((r) => ({ ...r, [ex.exerciseId]: initialRows(saved, ex.sets, info.prefill, () => Crypto.randomUUID()) }));
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
      <View style={{ flex: 1, padding: 24, paddingTop: insets.top + 24, gap: 12, backgroundColor: p.bg }}>
        <AppText style={{ fontSize: 20, fontWeight: "700" }}>{t("workout.loadError.title")}</AppText>
        <AppText style={{ color: p.muted }}>{t("workout.loadError.body")}</AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setLoadError(false);
            setAttempt((n) => n + 1);
          }}
          style={{ minHeight: 52, borderRadius: 12, backgroundColor: p.blueFill, alignItems: "center", justifyContent: "center" }}
        >
          <AppText style={{ color: p.onBlue, fontWeight: "800", fontSize: 16 }}>{t("today.error.retry")}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={{ minHeight: 52, borderRadius: 12, borderWidth: 2, borderColor: p.edge, alignItems: "center", justifyContent: "center" }}>
          <AppText style={{ fontWeight: "700" }}>{t("common.close")}</AppText>
        </Pressable>
      </View>
    );
  }
  if (loaded === null) return <AppText style={{ padding: 24 }}>{t("common.loading")}</AppText>;
  if (loaded === "nogym") return <AppText style={{ padding: 24 }}>{t("workout.noGym")}</AppText>;

  const timerRunning = timer.endsAt !== null;
  const unlogged = Object.values(rows).reduce((n, list) => n + unloggedFilled(list), 0);
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

  const circle = { width: 40, height: 40, borderRadius: 20, backgroundColor: p.field, alignItems: "center" as const, justifyContent: "center" as const };

  const renderExercise = (ex: Disp) => {
    const info = loaded.info[ex.exerciseId];
    if (!info) return null;
    const list = rows[ex.exerciseId] ?? [];
    const st = exState[ex.slot] ?? NO_STATE(ex.slot);
    const labels = exerciseLabels(ex, lang);
    const pr = info.proposal;
    const spec = findSpec(loaded.gym, ex.equipment);
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

    const colSet = { width: 40, alignItems: "center" as const };
    const colTick = { width: 44, alignItems: "center" as const };
    const head = { color: p.muted, fontSize: 12, fontWeight: "700" as const, textAlign: "center" as const };

    return (
      <View key={ex.id} style={{ gap: 8, paddingTop: 18, borderStartWidth: ssLabel[ex.slot] ? 4 : 0, borderStartColor: p.blueFill }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 }}>
          <View style={{ flex: 1 }}>
            {ssLabel[ex.slot] ? (
              <AppText style={{ color: p.blue, fontSize: 12, fontWeight: "800" }}>{t("workout.superset.label", { letter: ssLabel[ex.slot]! })}</AppText>
            ) : null}
            <AppText style={{ fontSize: 19, fontWeight: "700", color: p.blue }}>{labels.primary}</AppText>
            {labels.secondary ? <AppText style={{ color: p.muted, fontSize: 13 }}>{labels.secondary}</AppText> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t("workout.menu.title")}: ${labels.primary}`} onPress={() => setMenuFor(ex.slot)} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
            <Dots color={p.muted} />
          </Pressable>
        </View>

        <TextInput
          ref={(r) => {
            noteInputs.current[ex.slot] = r;
          }}
          accessibilityLabel={`${t("workout.menu.notes")}: ${labels.primary}`}
          defaultValue={st.note}
          onChangeText={(txt) => saveNote(ex.slot, txt)}
          onEndEditing={(e) => saveNote(ex.slot, e.nativeEvent.text, true)}
          placeholder={t("workout.notes.placeholder")}
          placeholderTextColor={p.muted}
          multiline
          style={{ paddingHorizontal: 14, paddingVertical: 4, fontSize: 15, color: p.text, textAlign: lang === "ar" ? "right" : "left" }}
        />

        <Pressable accessibilityRole="button" accessibilityLabel={st.restOff ? t("workout.restLineOff") : t("workout.restLine", { time: formatClock(timer.durationMs) })} hitSlop={{ top: 8, bottom: 8 }} onPress={() => void toggleRest(ex.slot)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, minHeight: 32 }}>
          <Stopwatch size={14} color={p.blue} />
          <AppText style={{ color: p.blue, fontWeight: "600", fontSize: 15 }}>{st.restOff ? t("workout.restLineOff") : t("workout.restLine", { time: formatClock(timer.durationMs) })}</AppText>
        </Pressable>

        {/* Compact target line: "Next: 75 kg × 7 · Why". It wraps onto a second line when it is long and is never cut off. */}
        <View style={{ marginHorizontal: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: p.field, borderStartWidth: 3, borderStartColor: p.blueFill, gap: 4 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 2 }}>
            <AppText style={{ flexShrink: 1, fontSize: 15, fontWeight: "700" }}>
              {t("workout.nextTarget")}: {targetText}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t("workout.whyShort")}: ${labels.primary}`}
              onPress={() => (info.stored ? navigation.dispatch(StackActions.push("Why", { targetId: info.stored!.id })) : setWhyOpen((w) => ({ ...w, [ex.exerciseId]: !expanded })))}
              onLongPress={() => setWhyOpen((w) => ({ ...w, [ex.exerciseId]: !expanded }))}
              hitSlop={{ top: 8, bottom: 8 }}
              style={{ minHeight: 32, justifyContent: "center" }}
            >
              <AppText style={{ fontSize: 14, fontWeight: "700", color: p.blue }}>· {t("workout.whyShort")} ›</AppText>
            </Pressable>
          </View>
          {expanded ? <AppText style={{ fontSize: 14, color: p.muted }}>{reasonText}</AppText> : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingTop: 4 }}>
          <View style={colSet}><AppText style={head}>{t("workout.col.set").toUpperCase()}</AppText></View>
          <View style={{ flex: 1.3 }}><AppText style={head}>{t("workout.col.prev").toUpperCase()}</AppText></View>
          <View style={{ flex: 1 }}><AppText style={head}>{unitText.toUpperCase()}</AppText></View>
          <View style={{ flex: 1 }}><AppText style={head}>{(timed ? (ex.measure === "time" ? t("workout.col.sec") : t("workout.col.metres")) : t("workout.col.reps")).toUpperCase()}</AppText></View>
          {ex.trackEffort ? <View style={{ width: 52 }}><AppText style={head}>{t("workout.col.rir").toUpperCase()}</AppText></View> : null}
          <View style={colTick}><Tick size={11} color={p.muted} /></View>
        </View>

        <View>
          {list.map((row, i) => {
            const done = row.saved && !row.dirty;
            const canTick = rowCanLog(row);
            const bg = done ? p.doneBg : p.bg;
            return (
              <SwipeRow key={row.key} background={bg} deleteLabel={t("workout.deleteSet")} onDelete={() => void dropRow(ex, row)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <View style={colSet}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t("workout.kind.title")}: ${t(`workout.kind.${kindOf(row)}` as never)} (${numbering[i]})`}
                      accessibilityState={{ selected: kindOf(row) !== "normal" }}
                      onPress={() => setKindFor({ exId: ex.exerciseId, key: row.key })}
                      onLongPress={() => askDrop(ex, row)}
                      hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}
                      style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: p.field, alignItems: "center", justifyContent: "center" }}
                    >
                      <AppText ltr style={{ fontWeight: "800", fontSize: 15, color: row.warmup ? p.warn : kindOf(row) === "normal" ? p.text : p.blue }}>{numbering[i]}</AppText>
                    </Pressable>
                  </View>
                  <View style={{ flex: 1.3 }}>
                    <AppText ltr numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: p.muted, fontSize: 14, textAlign: "center" }}>
                      {isolateLtr(timed ? previousQuantityText(info.last?.sets ?? null, widx[i] ?? null, ex.measure, (kg) => `${weightText(kg, unit)}${unitText}`, qUnits) : previousText(info.last?.sets ?? null, widx[i] ?? null, unit, unitText))}
                    </AppText>
                  </View>
                  <CellInput<number>
                    a11y={`${t("workout.load")} (${unitText})`}
                    value={row.load}
                    format={(v) => weightText(v, unit)}
                    parse={(txt, cur) => parseLoadInput(txt, unit, cur)}
                    onValue={(v) => patch(ex.exerciseId, row.key, { load: v })}
                    placeholder={row.ghostLoad !== null ? weightText(row.ghostLoad, unit) : undefined}
                    decimal
                  />
                  <CellInput<number>
                    a11y={timed ? (ex.measure === "time" ? t("workout.seconds") : t("workout.metres")) : t("workout.reps")}
                    value={row.reps}
                    format={(v) => String(v)}
                    parse={(txt) => (timed ? parseQuantityInput(txt, ex.measure) : parseRepsInput(txt))}
                    decimal={ex.measure === "distance"}
                    onValue={(v) => patch(ex.exerciseId, row.key, { reps: v })}
                    placeholder={row.ghostReps !== null ? String(row.ghostReps) : undefined}
                  />
                  {ex.trackEffort ? (
                    <CellInput<number> a11y={t("workout.rir")} style={{ flex: 0, width: 52 }} value={row.rir} format={(v) => String(v)} parse={(txt) => parseRirInput(txt)} onValue={(v) => patch(ex.exerciseId, row.key, { rir: v })} />
                  ) : null}
                  <View style={colTick}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done, disabled: !done && !canTick }}
                      accessibilityLabel={done ? t("workout.untick") : row.saved ? t("workout.tickUpdate") : t("workout.tick")}
                      disabled={busy !== null || (!row.saved && !canTick)}
                      onPress={() => (done ? void untick(ex, row) : void logRow(ex, row))}
                      hitSlop={{ top: 5, bottom: 5, left: 4, right: 4 }}
                      style={{ width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: done ? p.blueFill : p.field, borderWidth: row.saved && row.dirty ? 2 : 0, borderColor: p.blue, opacity: !done && !row.saved && !canTick ? 0.5 : 1 }}
                    >
                      {row.saved && row.dirty ? <AppText style={{ color: p.blue, fontWeight: "800", fontSize: 18 }}>↻</AppText> : <Tick size={13} color={done ? p.onBlue : p.muted} />}
                    </Pressable>
                  </View>
                </View>
              </SwipeRow>
            );
          })}
        </View>

        {pending.map((s) => {
          const o = outliers[s.id];
          return (
            <View key={s.id} style={{ marginHorizontal: 12, padding: 12, gap: 6, borderRadius: 12, borderWidth: 2, borderColor: p.warn, backgroundColor: p.card }}>
              <AppText style={{ fontWeight: "800" }}>⚠ {t("workout.outlier.title")}</AppText>
              <AppText>
                {timed
                  ? isolateLtr(quantityText(setQuantity(s, ex.measure), ex.measure, qUnits))
                  : isolateLtr(`${weightText(s.load, unit)} ${unitText} × ${s.reps}`)} · {timed ? t("workout.outlier.bodyTimed") : t("workout.outlier.body", { load: o?.expected ? fmt(o.expected.medianLoad) : "?", reps: o?.expected?.medianReps ?? "?" })}
              </AppText>
              <AppText style={{ color: p.muted }}>{t("workout.outlier.note")}</AppText>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={async () => {
                    await workout.setOutlierStatus(s.id, "confirmed");
                    await reload(loaded.sessionId);
                  }}
                  style={{ flex: 1, minHeight: 48, borderRadius: 10, backgroundColor: p.blueFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}
                >
                  <AppText style={{ color: p.onBlue, fontWeight: "700", textAlign: "center" }}>{t("workout.outlier.confirm")}</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={async () => {
                    await workout.setOutlierStatus(s.id, "rejected");
                    setRows((r) => ({ ...r, [ex.exerciseId]: removeRow(r[ex.exerciseId] ?? [], s.id) }));
                    await reload(loaded.sessionId);
                  }}
                  style={{ flex: 1, minHeight: 48, borderRadius: 10, borderWidth: 2, borderColor: p.blueFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}
                >
                  <AppText style={{ fontWeight: "700", textAlign: "center" }}>{t("workout.outlier.reject")}</AppText>
                </Pressable>
              </View>
            </View>
          );
        })}

        {offer.kind === "offer" ? (
          warmOpen === ex.exerciseId ? (
            <View style={{ marginHorizontal: 12, padding: 12, gap: 6, borderRadius: 12, backgroundColor: p.card }}>
              <AppText style={{ fontWeight: "700" }}>{t("warm.title", { load: fmt(offer.workingLoad) })}</AppText>
              {offer.sets.map((w, i) => (
                <AppText key={i} style={{ fontSize: 17 }}>{fmt(w.load)} × {isolateLtr(String(w.reps))}</AppText>
              ))}
              <AppText style={{ color: p.muted, fontSize: 13 }}>{t("warm.note")}</AppText>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
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
                  style={{ flex: 1, minHeight: 48, borderRadius: 10, backgroundColor: p.blueFill, alignItems: "center", justifyContent: "center" }}
                >
                  <AppText style={{ color: p.onBlue, fontWeight: "700" }}>{t("warm.confirm")}</AppText>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setWarmOpen(null)} style={{ flex: 1, minHeight: 48, borderRadius: 10, borderWidth: 2, borderColor: p.edge, alignItems: "center", justifyContent: "center" }}>
                  <AppText style={{ fontWeight: "700" }}>{t("warm.cancel")}</AppText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setWarmOpen(ex.exerciseId)} style={{ paddingHorizontal: 14, minHeight: 48, justifyContent: "center" }}>
              <AppText style={{ color: p.blue, fontWeight: "600", fontSize: 15 }}>{t("warm.add")}</AppText>
            </Pressable>
          )
        ) : null}
        {warmDone[ex.exerciseId] ? <AppText style={{ color: p.muted, paddingHorizontal: 14 }}>✓ {t("warm.added")}</AppText> : null}
        {!spec ? <AppText style={{ color: p.muted, fontSize: 13, paddingHorizontal: 14 }}>{t("workout.stepFallback")}</AppText> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("workout.addSet")}: ${labels.primary}`}
          onPress={() => setRows((r) => ({ ...r, [ex.exerciseId]: addRow(r[ex.exerciseId] ?? [], info.prefill, () => Crypto.randomUUID()) }))}
          style={{ marginHorizontal: 12, minHeight: 48, borderRadius: 10, backgroundColor: p.field, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
        >
          <AppText style={{ fontWeight: "700", fontSize: 16 }}>+ {t("workout.addSet")}</AppText>
        </Pressable>
      </View>
    );
  };

  const menuEx = menuFor ? shown.find((e) => e.slot === menuFor) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: p.bg }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("workout.collapse")} onPress={() => navigation.goBack()} style={circle}>
          <ChevronDown color={p.text} />
        </Pressable>
        <AppText numberOfLines={1} style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" }}>{t("workout.header")}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={t("workout.help.button")} onPress={() => setHelpOpen(true)} style={circle}>
          <AppText style={{ fontWeight: "800", fontSize: 18 }}>?</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("workout.restTimerBtn")} accessibilityState={{ expanded: timerOpen }} hitSlop={{ top: 4, bottom: 4 }} onPress={() => setTimerOpen((o) => !o)} style={timerRunning ? { height: 40, minWidth: 40, paddingHorizontal: 12, flexDirection: "row", gap: 6, borderRadius: 20, backgroundColor: p.field, alignItems: "center", justifyContent: "center" } : circle}>
          <Stopwatch size={16} color={timerRunning ? p.blue : p.text} />
          {timerRunning ? <AppText ltr style={{ color: p.blue, fontWeight: "700", fontSize: 15 }}>{formatClock(remainingMs(timer, now))}</AppText> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("workout.finishBtn")} disabled={finishing} hitSlop={{ top: 4, bottom: 4 }} onPress={() => askFinish(loaded)} style={{ minHeight: 40, paddingHorizontal: 20, borderRadius: 20, backgroundColor: finishing ? p.line : p.blueFill, alignItems: "center", justifyContent: "center" }}>
          <AppText style={{ color: p.onBlue, fontWeight: "800", fontSize: 16 }}>{t("workout.finishBtn")}</AppText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={{ flexDirection: "row", gap: 18, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Stat label={t("workout.stat.duration")}>
            <LiveDuration startedAt={loaded.startedAt} color={p.blue} />
          </Stat>
          <Stat label={t("workout.stat.volume")}>
            <AppText ltr style={{ fontSize: 19, fontWeight: "700" }}>{volumeText(summary.volumeKg, unit)} {unitText}</AppText>
          </Stat>
          <Stat label={t("workout.stat.sets")}>
            <AppText ltr style={{ fontSize: 19, fontWeight: "700" }}>{summary.sets}</AppText>
          </Stat>
        </View>

        {finishFailed ? (
          <View accessibilityLiveRegion="assertive" style={{ marginHorizontal: 12, marginBottom: 8, padding: 12, gap: 8, borderRadius: 12, borderWidth: 2, borderColor: p.danger, backgroundColor: p.card }}>
            <AppText style={{ fontWeight: "800" }}>{t("workout.finishFailed.title")}</AppText>
            <AppText style={{ color: p.muted }}>{t("workout.finishFailed.body")}</AppText>
            <Pressable accessibilityRole="button" disabled={finishing} onPress={() => void doFinish(loaded)} style={{ minHeight: 52, borderRadius: 10, backgroundColor: p.blueFill, alignItems: "center", justifyContent: "center" }}>
              <AppText style={{ color: p.onBlue, fontWeight: "800" }}>{t("workout.finishFailed.retry")}</AppText>
            </Pressable>
          </View>
        ) : null}

        {timerOpen ? (
          <View style={{ marginHorizontal: 12, marginBottom: 6, padding: 12, gap: 8, borderRadius: 12, backgroundColor: p.card }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText ltr style={{ fontSize: 34, fontWeight: "800", minWidth: 92 }}>{formatClock(remainingMs(timer, now))}</AppText>
              {[-15, 15].map((d) => (
                <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${d > 0 ? "+" : "−"}${Math.abs(d)}`} onPress={() => setTimer((tm) => adjustTimer(tm, d, Date.now()))} style={{ flex: 1, minHeight: 48, borderRadius: 10, backgroundColor: p.field, alignItems: "center", justifyContent: "center" }}>
                  <AppText ltr style={{ fontWeight: "700", fontSize: 18 }}>{d > 0 ? `+${d}` : `−${-d}`}</AppText>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setRestOver(false);
                  setTimer((tm) => (tm.endsAt === null ? startTimer(tm, Date.now()) : stopTimer(tm)));
                }}
                style={{ flex: 1.3, minHeight: 48, borderRadius: 10, backgroundColor: p.blueFill, alignItems: "center", justifyContent: "center" }}
              >
                <AppText style={{ color: p.onBlue, fontWeight: "700" }}>{timerRunning ? t("workout.rest.stop") : t("workout.rest.start")}</AppText>
              </Pressable>
            </View>
            {restOver && !timerRunning ? <AppText>{t("workout.rest.done")}</AppText> : null}
          </View>
        ) : restOver && !timerRunning ? (
          <AppText style={{ paddingHorizontal: 14, color: p.blue, fontWeight: "700" }}>{t("workout.rest.done")}</AppText>
        ) : null}

        <View style={{ paddingHorizontal: 14, gap: 2 }}>
          {loaded.resumed ? <AppText style={{ color: p.muted, fontSize: 13 }}>{t("workout.resumed")}</AppText> : null}
          <AppText accessibilityLiveRegion="polite" style={{ color: p.muted, fontSize: 13 }}>
            {savedAt ? `✓ ${t("workout.saved", { time: clock(savedAt) })}` : t("workout.notSaved")}
          </AppText>
        </View>

        {shown.map(renderExercise)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("workout.add.button")}
          onPress={() => setAddOpen(true)}
          style={{ marginHorizontal: 12, marginTop: 22, minHeight: 50, borderRadius: 10, backgroundColor: p.blueFill, alignItems: "center", justifyContent: "center" }}
        >
          <AppText style={{ color: p.onBlue, fontWeight: "800", fontSize: 16 }}>+ {t("workout.add.button")}</AppText>
        </Pressable>

        {removedSlots.length > 0 ? (
          <View style={{ paddingHorizontal: 14, paddingTop: 22, gap: 6 }}>
            <AppText style={{ color: p.muted, fontSize: 13, fontWeight: "700" }}>{t("workout.removed")}</AppText>
            {removedSlots.map((s) => (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <AppText style={{ flex: 1, color: p.muted }}>{exerciseLabels(s, lang).primary}</AppText>
                <Pressable accessibilityRole="button" onPress={() => void restore(s.exerciseId)} style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: 10, backgroundColor: p.field, justifyContent: "center" }}>
                  <AppText style={{ fontWeight: "700", color: p.blue }}>{t("workout.restore")}</AppText>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 14, paddingTop: 22, gap: 4 }}>
          {unlogged > 0 ? <AppText style={{ fontWeight: "600" }}>{t("workout.unlogged", { n: unlogged })}</AppText> : null}
        </View>
      </ScrollView>

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
            label: `${on ? "✓ " : ""}${t(`workout.kind.${k}` as never)}`,
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
