import { StackActions, useNavigation, useRoute } from "@react-navigation/native";
import { findSpec, renderReason, type GymFingerprint, type LineIdentity, type LoggedSet, type OutlierResult, type Proposal } from "@gain/engine";
import * as Crypto from "expo-crypto";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Vibration, View } from "react-native";
import { useServices } from "../AppContext";
import { NumField } from "../components/NumField";
import type { TargetRow } from "../db/finishRepo";
import type { SetRow } from "../db/workoutRepo";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { localizeReason, weightText } from "../logic/units";
import { useI18n } from "../i18n";
import { defaultRestSettings, loadRestSettings, syncRestAlert, type RestSettings } from "../logic/restAlert";
import { warmupOffer } from "../logic/warmups";
import { initialDraft, stepLoad, stepReps } from "../logic/draft";
import { parseLoadInput, parseRepsInput, parseRirInput } from "../logic/setInput";
import { addRow, editRow, initialRows, markSaved, mergeRows, removeRow, rowLabels, rowReady, unloggedFilled, type Prefill, type SetRowDraft } from "../logic/workoutRows";
import { adjustTimer, formatClock, isDone, newTimer, remainingMs, startTimer, stopTimer, type RestTimer } from "../logic/restTimer";
import { MIN_TOUCH, space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip } from "../ui";

type DayEx = Awaited<ReturnType<ReturnType<typeof useServices>["repos"]["listDayExercises"]>>[number];
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
  gym: GymFingerprint;
  exercises: DayEx[];
  info: Record<string, ExInfo>;
}

const clock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const toSaved = (s: SetRow) => ({ id: s.id, load: s.load, reps: s.reps, rir: s.rir, warmup: s.warmup });

/** Small optional − / + next to a typed field. Secondary: typing is the main way in. */
function Mini(props: { label: string; onPress: () => void; hint: string }) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={props.hint} onPress={props.onPress} style={{ flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, alignItems: "center", justifyContent: "center" }}>
      <AppText ltr style={{ fontSize: 22, fontWeight: "700" }}>{props.label}</AppText>
    </Pressable>
  );
}

/**
 * The active workout: ONE scrolling list of every exercise. Each shows today's target (with the reason) and its sets as rows with typed
 * weight and reps, a warm-up toggle, log / update and remove per row, and add set per exercise. Finish is at the bottom. A row is saved on
 * the phone the moment it is logged (offline); nothing waits for the finish.
 */
export function WorkoutScreen() {
  const { repos, workout, finish, restAlerts } = useServices();
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = usePalette();
  const route = useRoute();
  const navigation = useNavigation();
  const dayId = (route.params as { dayId: string }).dayId;

  const [loaded, setLoaded] = useState<Loaded | null | "nogym">(null);
  const [rows, setRows] = useState<Record<string, SetRowDraft[]>>({});
  const [sets, setSets] = useState<SetRow[]>([]);
  const [outliers, setOutliers] = useState<Record<string, OutlierResult>>({});
  const [steppers, setSteppers] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [warmOpen, setWarmOpen] = useState<string | null>(null);
  const [warmDone, setWarmDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [timer, setTimer] = useState<RestTimer>(() => newTimer());
  const [rest, setRest] = useState<RestSettings>(defaultRestSettings());
  const [now, setNow] = useState(Date.now());
  const [restOver, setRestOver] = useState(false);
  const startedRef = useRef(false);

  // Open (or resume) the session exactly once; leaving and coming back never creates a second one.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const gymId = await repos.getActiveGymId();
      if (!gymId) return setLoaded("nogym");
      const gym = await repos.loadGymFingerprint(gymId);
      const { id, resumed } = await workout.startOrResumeSession(dayId, gymId);
      const exercises = await repos.listDayExercises(dayId);
      const info: Record<string, ExInfo> = {};
      for (const e of exercises) {
        const { proposal, lineId, line } = await workout.liveProposal(
          { exerciseId: e.exerciseId, name: e.nameEn, equipment: e.equipment, setup: e.setup, repMin: e.repMin, repMax: e.repMax, repCeiling: e.repCeiling, isGoalLift: e.isGoalLift, trackEffort: e.trackEffort, sets: e.sets },
          gym,
        );
        const last = await workout.lastPerformance(line, lineId);
        const stored = await finish.getTargetForExercise(id, e.exerciseId);
        const lastTop = last?.sets.reduce<LoggedSet | null>((a, s) => (a === null || s.load > a.load ? s : a), null) ?? null;
        // Never invented: today's target, else last time's top set, else empty.
        const d = initialDraft({
          today: [],
          target: stored ? (stored.effectiveLoad !== null && stored.reps !== null && stored.status !== "rejected" ? { load: stored.effectiveLoad, reps: stored.reps } : null) : proposal.status === "proposed" ? { load: proposal.load, reps: proposal.reps } : null,
          last: lastTop ? { load: lastTop.load, reps: lastTop.reps } : null,
        });
        info[e.exerciseId] = { proposal, line, last, stored, prefill: { load: d.load, reps: d.reps } };
      }
      const all = await workout.listSessionSets(id);
      const initial: Record<string, SetRowDraft[]> = {};
      for (const e of exercises) initial[e.exerciseId] = initialRows(all.filter((s) => s.exerciseId === e.exerciseId).map(toSaved), e.sets, info[e.exerciseId]!.prefill, () => Crypto.randomUUID());
      setSets(all);
      setRows(initial);
      setLoaded({ sessionId: id, resumed, gym, exercises, info });
    })().catch(() => setLoaded("nogym"));
  }, [repos, workout, finish, dayId]);

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

  // Leaving the logger drops the in-app timer, so drop its alert too (no stray buzz after the workout).
  useEffect(() => () => void restAlerts.cancel().catch(() => undefined), [restAlerts]);

  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, []);

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

  async function logRow(ex: DayEx, row: SetRowDraft) {
    if (!loaded || loaded === "nogym" || busy || !rowReady(row)) return;
    setBusy(row.key);
    const ctx = { gym: loaded.gym, equipment: ex.equipment, setup: ex.setup };
    try {
      if (!row.saved) {
        const r = await workout.logSet({ id: row.key, sessionId: loaded.sessionId, exerciseId: ex.exerciseId, load: row.load, reps: row.reps, rir: row.rir, warmup: row.warmup }, ctx);
        if (r.outlier?.verdict === "unconfirmed") setOutliers((o) => ({ ...o, [r.id]: r.outlier! }));
        if (!row.warmup) {
          setRestOver(false);
          setTimer((tm) => startTimer(tm, Date.now()));
        }
      } else if (row.dirty) {
        const r = await workout.updateLiveSet(row.key, { load: row.load, reps: row.reps, rir: row.rir, warmup: row.warmup }, ctx);
        if (r.outlier?.verdict === "unconfirmed") setOutliers((o) => ({ ...o, [row.key]: r.outlier! }));
      }
      setRows((r) => ({ ...r, [ex.exerciseId]: markSaved(r[ex.exerciseId] ?? [], row.key) }));
      await reload(loaded.sessionId);
      setSavedAt(Date.now());
    } finally {
      setBusy(null);
    }
  }

  async function dropRow(ex: DayEx, row: SetRowDraft) {
    if (!loaded || loaded === "nogym") return;
    if (row.saved) {
      await workout.deleteSet(row.key);
      setRows((r) => ({ ...r, [ex.exerciseId]: removeRow(r[ex.exerciseId] ?? [], row.key) }));
      await reload(loaded.sessionId);
    } else {
      setRows((r) => ({ ...r, [ex.exerciseId]: removeRow(r[ex.exerciseId] ?? [], row.key) }));
    }
  }

  if (loaded === null) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  if (loaded === "nogym") return <AppText style={{ padding: space.lg }}>{t("workout.noGym")}</AppText>;

  const timerRunning = timer.endsAt !== null;
  const unlogged = Object.values(rows).reduce((n, list) => n + unloggedFilled(list), 0);

  const renderExercise = (ex: DayEx, exIdx: number) => {
    const info = loaded.info[ex.exerciseId]!;
    const list = rows[ex.exerciseId] ?? [];
    const labels = exerciseLabels(ex, lang);
    const pr = info.proposal;
    const spec = findSpec(loaded.gym, ex.equipment);
    const exSets = setsByEx.get(ex.exerciseId) ?? [];
    const numbering = rowLabels(list);
    const lastText = info.last ? info.last.sets.map((s) => `${isolateLtr(weightText(s.load, unit))} × ${isolateLtr(`${s.reps}`)}`).join("  ·  ") : null;
    const workingLoad = info.stored ? (info.stored.status === "rejected" ? null : info.stored.effectiveLoad) : pr.status === "proposed" ? pr.load : null;
    const offer = warmupOffer({ workingLoad, spec, setup: ex.setup, loggedToday: exSets.length });
    const pending = exSets.filter((s) => s.outlierStatus === "unconfirmed");

    return (
      <Card key={ex.id}>
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("workout.exercise", { i: exIdx + 1, n: loaded.exercises.length })}</AppText>
        <AppText style={{ fontSize: 24, fontWeight: "800" }}>{labels.primary}</AppText>
        <AppText style={{ color: p.muted }}>{labels.secondary}</AppText>
        <AppText style={{ fontWeight: "700", marginTop: space.xs }}>{t("workout.target")}</AppText>
        {info.stored ? (
          info.stored.status === "rejected" ? (
            <AppText>{t("finish.rejectedNote")}</AppText>
          ) : info.stored.effectiveLoad !== null && info.stored.reps !== null ? (
            <AppText style={{ fontSize: 20, fontWeight: "700" }}>
              {formatLoad(info.stored.effectiveLoad, lang, unit)} × {isolateLtr(String(info.stored.reps))}
            </AppText>
          ) : (
            <AppText>{t("workout.targetNone")}</AppText>
          )
        ) : pr.status === "proposed" && pr.load !== null && pr.reps !== null ? (
          <AppText style={{ fontSize: 20, fontWeight: "700" }}>
            {formatLoad(pr.load, lang, unit)} × {isolateLtr(String(pr.reps))}
          </AppText>
        ) : (
          <AppText>{t("workout.targetNone")}</AppText>
        )}
        <AppText style={{ color: p.muted }}>{renderReason(localizeReason(info.stored ? info.stored.reason : pr.reason, unit, lang), lang)}</AppText>
        <AppText style={{ color: p.muted, fontSize: 13 }}>
          {t("workout.last")}: {lastText ?? t("workout.lastNone")}
        </AppText>
        {info.stored ? (
          <BigButton label={t("finish.why")} selected={false} onPress={() => navigation.dispatch(StackActions.push("Why", { targetId: info.stored!.id }))} />
        ) : null}

        {pending.map((s) => {
          const o = outliers[s.id];
          return (
            <Card key={s.id} style={{ borderColor: "#c77700", borderWidth: 2 }}>
              <AppText style={{ fontWeight: "800" }}>⚠ {t("workout.outlier.title")}</AppText>
              <AppText>
                {isolateLtr(`${weightText(s.load, unit)} ${unitText} × ${s.reps}`)} · {t("workout.outlier.body", { load: o?.expected ? fmt(o.expected.medianLoad) : "?", reps: o?.expected?.medianReps ?? "?" })}
              </AppText>
              <AppText style={{ color: p.muted }}>{t("workout.outlier.note")}</AppText>
              <BigButton
                label={t("workout.outlier.confirm")}
                onPress={async () => {
                  await workout.setOutlierStatus(s.id, "confirmed");
                  await reload(loaded.sessionId);
                }}
              />
              <BigButton
                label={t("workout.outlier.reject")}
                selected={false}
                onPress={async () => {
                  await workout.setOutlierStatus(s.id, "rejected");
                  setRows((r) => ({ ...r, [ex.exerciseId]: removeRow(r[ex.exerciseId] ?? [], s.id) }));
                  await reload(loaded.sessionId);
                }}
              />
            </Card>
          );
        })}

        {offer.kind === "offer" ? (
          warmOpen === ex.exerciseId ? (
            <View style={{ gap: space.sm }}>
              <AppText style={{ fontWeight: "700" }}>{t("warm.title", { load: fmt(offer.workingLoad) })}</AppText>
              {offer.sets.map((w, i) => (
                <AppText key={i} style={{ fontSize: 18 }}>{fmt(w.load)} × {isolateLtr(String(w.reps))}</AppText>
              ))}
              <AppText style={{ color: p.muted, fontSize: 13 }}>{t("warm.note")}</AppText>
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
              <BigButton label={t("warm.cancel")} selected={false} onPress={() => setWarmOpen(null)} />
            </View>
          ) : (
            <BigButton label={t("warm.add")} selected={false} onPress={() => setWarmOpen(ex.exerciseId)} />
          )
        ) : warmDone[ex.exerciseId] ? null : exSets.length === 0 && offer.reason !== "already_started" ? (
          <AppText style={{ color: p.muted, fontSize: 13 }}>{t(`warm.none.${offer.reason}` as never)}</AppText>
        ) : null}
        {warmDone[ex.exerciseId] ? <AppText style={{ color: p.muted }}>✓ {t("warm.added")}</AppText> : null}

        {!spec ? <AppText style={{ color: p.muted, fontSize: 13 }}>{t("workout.stepFallback")}</AppText> : null}
        {list.map((row, i) => (
          <View key={row.key} style={{ gap: space.xs, paddingTop: space.sm, borderTopWidth: 1, borderColor: p.border }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
              <AppText ltr style={{ width: 30, fontSize: 20, fontWeight: "800", paddingBottom: space.sm }}>{numbering[i]}</AppText>
              <View style={{ flex: 1.3 }}>
                <NumField<number>
                  label={`${t("workout.load")} (${unitText})`}
                  value={row.load}
                  format={(v) => weightText(v, unit)}
                  parse={(txt, cur) => parseLoadInput(txt, unit, cur)}
                  onValue={(v) => patch(ex.exerciseId, row.key, { load: v })}
                  decimal
                />
              </View>
              <View style={{ flex: 1 }}>
                <NumField<number> label={t("workout.reps")} value={row.reps} format={(v) => String(v)} parse={(txt) => parseRepsInput(txt)} onValue={(v) => patch(ex.exerciseId, row.key, { reps: v })} />
              </View>
            </View>
            {steppers ? (
              <View style={{ flexDirection: "row", gap: space.sm, paddingStart: 30 + space.sm }}>
                <View style={{ flex: 1.3, flexDirection: "row", gap: space.xs }}>
                  <Mini label="−" hint={`${t("workout.load")} ${t("workout.less")}`} onPress={() => patch(ex.exerciseId, row.key, { load: stepLoad(spec, row.load, -1, ex.setup, unit).load })} />
                  <Mini label="+" hint={`${t("workout.load")} ${t("workout.more")}`} onPress={() => patch(ex.exerciseId, row.key, { load: stepLoad(spec, row.load, 1, ex.setup, unit).load })} />
                </View>
                <View style={{ flex: 1, flexDirection: "row", gap: space.xs }}>
                  <Mini label="−" hint={`${t("workout.reps")} ${t("workout.less")}`} onPress={() => patch(ex.exerciseId, row.key, { reps: stepReps(row.reps, -1) })} />
                  <Mini label="+" hint={`${t("workout.reps")} ${t("workout.more")}`} onPress={() => patch(ex.exerciseId, row.key, { reps: stepReps(row.reps, 1) })} />
                </View>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
              <Chip label={t("workout.warmup")} selected={row.warmup} onPress={() => patch(ex.exerciseId, row.key, { warmup: !row.warmup })} />
              {ex.trackEffort ? (
                <View style={{ width: 96 }}>
                  <NumField<number>
                    label={t("workout.rir")}
                    value={row.rir}
                    format={(v) => String(v)}
                    parse={(txt) => parseRirInput(txt)}
                    onValue={(v) => patch(ex.exerciseId, row.key, { rir: v })}
                    fontSize={18}
                  />
                </View>
              ) : null}
              <View style={{ flex: 1, minWidth: 120 }}>
                <BigButton
                  label={row.saved ? (row.dirty ? t("workout.updateSet") : `✓ ${t("workout.logged")}`) : t("workout.logSet")}
                  selected={!row.saved || row.dirty}
                  disabled={!rowReady(row) || busy !== null || (row.saved && !row.dirty)}
                  onPress={() => void logRow(ex, row)}
                />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t("workout.removeSet")} onPress={() => void dropRow(ex, row)} style={{ minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 2, borderColor: p.border }}>
                <AppText style={{ fontSize: 20 }}>✕</AppText>
              </Pressable>
            </View>
          </View>
        ))}
        <BigButton label={t("workout.addSet")} selected={false} onPress={() => setRows((r) => ({ ...r, [ex.exerciseId]: addRow(r[ex.exerciseId] ?? [], info.prefill, () => Crypto.randomUUID()) }))} />
      </Card>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 3 }} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[0]}>
      <View style={{ backgroundColor: p.card, borderColor: p.border, borderWidth: 1, borderRadius: 16, padding: space.sm, gap: space.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <AppText ltr style={{ fontSize: 32, fontWeight: "800", minWidth: 96 }}>{formatClock(remainingMs(timer, now))}</AppText>
          <View style={{ flex: 1, flexDirection: "row", gap: space.xs }}>
            <Mini label="−15" hint="−15" onPress={() => setTimer((tm) => adjustTimer(tm, -15, Date.now()))} />
            <Mini label="+15" hint="+15" onPress={() => setTimer((tm) => adjustTimer(tm, 15, Date.now()))} />
          </View>
          <View style={{ flex: 1.2 }}>
            <BigButton
              label={timerRunning ? t("workout.rest.stop") : t("workout.rest.start")}
              selected={false}
              onPress={() => {
                setRestOver(false);
                setTimer((tm) => (tm.endsAt === null ? startTimer(tm, Date.now()) : stopTimer(tm)));
              }}
            />
          </View>
        </View>
        {restOver && !timerRunning ? <AppText>{t("workout.rest.done")}</AppText> : null}
      </View>
      {loaded.resumed ? <AppText style={{ color: p.muted }}>{t("workout.resumed")}</AppText> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Chip label={t("workout.steppers")} selected={steppers} onPress={() => setSteppers((s) => !s)} />
        <AppText accessibilityLiveRegion="polite" style={{ color: p.muted, flex: 1 }}>
          {savedAt ? `✓ ${t("workout.saved", { time: clock(savedAt) })}` : t("workout.notSaved")}
        </AppText>
      </View>
      {loaded.exercises.map(renderExercise)}
      <AppText style={{ color: p.muted, fontSize: 13 }}>{t("workout.finishNote")}</AppText>
      {unlogged > 0 ? <AppText style={{ fontWeight: "600" }}>{t("workout.unlogged", { n: unlogged })}</AppText> : null}
      <BigButton
        label={t("workout.finish")}
        disabled={finishing}
        onPress={async () => {
          setFinishing(true);
          try {
            await workout.finishSession(loaded.sessionId);
            navigation.dispatch(StackActions.replace("Finish", { sessionId: loaded.sessionId }));
          } catch (e) {
            setFinishing(false);
            throw e;
          }
        }}
      />
    </ScrollView>
  );
}
