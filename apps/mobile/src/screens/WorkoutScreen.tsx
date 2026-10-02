import { StackActions, useNavigation, useRoute } from "@react-navigation/native";
import { findSpec, renderReason, type GymFingerprint, type LineIdentity, type LoggedSet, type OutlierResult, type Proposal } from "@gain/engine";
import * as Crypto from "expo-crypto";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Vibration, View } from "react-native";
import { useServices } from "../AppContext";
import type { TargetRow } from "../db/finishRepo";
import type { SetRow } from "../db/workoutRepo";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { localizeReason, weightText } from "../logic/units";
import { useI18n } from "../i18n";
import { defaultRestSettings, loadRestSettings, syncRestAlert, type RestSettings } from "../logic/restAlert";
import { warmupOffer } from "../logic/warmups";
import { canLog, initialDraft, repeatLast, RIR_CHOICES, stepLoad, stepReps, type SetDraft } from "../logic/draft";
import { adjustTimer, formatClock, isDone, newTimer, remainingMs, startTimer, stopTimer, type RestTimer } from "../logic/restTimer";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";

type DayEx = Awaited<ReturnType<ReturnType<typeof useServices>["repos"]["listDayExercises"]>>[number];
interface ExInfo {
  proposal: Proposal;
  line: LineIdentity;
  last: { performedAt: string; sets: LoggedSet[] } | null;
  /** The target written when the previous workout was finished, if any. */
  stored: TargetRow | null;
}
interface Loaded {
  sessionId: string;
  resumed: boolean;
  gym: GymFingerprint;
  exercises: DayEx[];
  info: Record<string, ExInfo>;
}
interface Pending {
  setId: string;
  load: number;
  reps: number;
  outlier: OutlierResult;
}

const clock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function Stepper(props: { label: string; value: string; onLess: () => void; onMore: () => void; lessLabel: string; moreLabel: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: space.xs }}>
      <AppText style={{ color: p.muted }}>{props.label}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ width: 72 }}>
          <BigButton label="−" onPress={props.onLess} accessibilityHint={props.lessLabel} selected={false} />
        </View>
        <AppText ltr style={{ flex: 1, textAlign: "center", fontSize: 40, fontWeight: "800" }}>
          {props.value}
        </AppText>
        <View style={{ width: 72 }}>
          <BigButton label="+" onPress={props.onMore} accessibilityHint={props.moreLabel} selected={false} />
        </View>
      </View>
    </View>
  );
}

export function WorkoutScreen() {
  const { repos, workout, finish, restAlerts } = useServices();
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = usePalette();
  const route = useRoute();
  const navigation = useNavigation();
  const dayId = (route.params as { dayId: string }).dayId;

  const [loaded, setLoaded] = useState<Loaded | null | "nogym">(null);
  const [idx, setIdx] = useState(0);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [draft, setDraft] = useState<SetDraft>({ load: null, reps: null, rir: null, warmup: false });
  const [draftId, setDraftId] = useState(() => Crypto.randomUUID());
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [warmOpen, setWarmOpen] = useState(false);
  const [warmDone, setWarmDone] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
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
        info[e.exerciseId] = { proposal, line, last: await workout.lastPerformance(line, lineId), stored: await finish.getTargetForExercise(id, e.exerciseId) };
      }
      setSets(await workout.listSessionSets(id));
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

  const ex = loaded && loaded !== "nogym" ? loaded.exercises[idx] : undefined;
  const info = ex && loaded && loaded !== "nogym" ? loaded.info[ex.exerciseId] : undefined;
  const exSets = useMemo(() => (ex ? sets.filter((s) => s.exerciseId === ex.exerciseId) : []), [sets, ex]);
  const spec = ex && loaded && loaded !== "nogym" ? findSpec(loaded.gym, ex.equipment) : null;

  // Reset the draft when the exercise changes or a set is logged / undone.
  const lastSetKey = exSets.map((s) => s.id).join(",");
  useEffect(() => {
    if (!ex || !info) return;
    const lastTop = info.last?.sets.reduce<LoggedSet | null>((a, s) => (a === null || s.load > a.load ? s : a), null) ?? null;
    setDraft(
      initialDraft({
        today: exSets.map((s) => ({ load: s.load, reps: s.reps, rir: s.rir, warmup: s.warmup })),
        target: info.stored
          ? info.stored.effectiveLoad !== null && info.stored.reps !== null
            ? { load: info.stored.effectiveLoad, reps: info.stored.reps }
            : null
          : info.proposal.status === "proposed"
            ? { load: info.proposal.load, reps: info.proposal.reps }
            : null,
        last: lastTop ? { load: lastTop.load, reps: lastTop.reps } : null,
      }),
    );
    setDraftId(Crypto.randomUUID());
    setWarmOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex?.exerciseId, lastSetKey, info]);

  const save = useCallback(
    async (d: SetDraft) => {
      if (!loaded || loaded === "nogym" || !ex || !canLog(d) || saving) return;
      setSaving(true);
      try {
        const r = await workout.logSet(
          { id: draftId, sessionId: loaded.sessionId, exerciseId: ex.exerciseId, load: d.load, reps: d.reps, rir: d.rir, warmup: d.warmup },
          { gym: loaded.gym, equipment: ex.equipment, setup: ex.setup },
        );
        setSets(await workout.listSessionSets(loaded.sessionId));
        setSavedAt(Date.now());
        if (r.outlier?.verdict === "unconfirmed") setPending({ setId: r.id, load: d.load, reps: d.reps, outlier: r.outlier });
        if (!d.warmup) {
          setRestOver(false);
          setTimer((tm) => startTimer(tm, Date.now()));
        }
      } finally {
        setSaving(false);
      }
    },
    [loaded, ex, saving, workout, draftId],
  );

  if (loaded === null) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  if (loaded === "nogym") return <AppText style={{ padding: space.lg }}>{t("workout.noGym")}</AppText>;
  if (!ex || !info) return null;

  const labels = exerciseLabels(ex, lang);
  const pr = info.proposal;
  const lastText = info.last
    ? info.last.sets.map((s) => `${isolateLtr(weightText(s.load, unit))} × ${isolateLtr(`${s.reps}`)}`).join("  ·  ")
    : null;
  const stepSetup = ex.setup;
  const loadStep = (dir: 1 | -1) => setDraft((d) => ({ ...d, load: stepLoad(spec, d.load, dir, stepSetup, unit).load }));
  const workingLoad = info.stored ? (info.stored.status === "rejected" ? null : info.stored.effectiveLoad) : pr.status === "proposed" ? pr.load : null;
  const offer = warmupOffer({ workingLoad, spec, setup: ex.setup, loggedToday: exSets.length });
  const timerRunning = timer.endsAt !== null;
  const last = repeatLast(exSets.map((s) => ({ load: s.load, reps: s.reps, rir: s.rir, warmup: s.warmup })));

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }} keyboardShouldPersistTaps="handled">
      {loaded.resumed ? <AppText style={{ color: p.muted }}>{t("workout.resumed")}</AppText> : null}
      <AppText style={{ color: p.muted }}>{t("workout.exercise", { i: idx + 1, n: loaded.exercises.length })}</AppText>

      <Card>
        <AppText style={{ fontSize: 26, fontWeight: "800" }}>{labels.primary}</AppText>
        <AppText style={{ color: p.muted }}>{labels.secondary}</AppText>
        <AppText style={{ fontWeight: "700", marginTop: space.sm }}>{t("workout.last")}</AppText>
        <AppText>{lastText ?? t("workout.lastNone")}</AppText>
        <AppText style={{ fontWeight: "700", marginTop: space.sm }}>{t("workout.target")}</AppText>
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
        {info.stored ? (
          <>
            <AppText style={{ color: p.muted }}>{t(`finish.status.${info.stored.status}` as never)}</AppText>
            <BigButton label={t("finish.why")} selected={false} onPress={() => navigation.dispatch(StackActions.push("Why", { targetId: info.stored!.id }))} />
          </>
        ) : null}
      </Card>

      {pending ? (
        <Card style={{ borderColor: "#c77700", borderWidth: 2 }}>
          <AppText style={{ fontWeight: "800" }}>⚠ {t("workout.outlier.title")}</AppText>
          <AppText>
            {t("workout.outlier.body", { load: pending.outlier.expected ? fmt(pending.outlier.expected.medianLoad) : "?", reps: pending.outlier.expected?.medianReps ?? "?" })}
          </AppText>
          <AppText style={{ color: p.muted }}>{t("workout.outlier.note")}</AppText>
          <BigButton
            label={t("workout.outlier.confirm")}
            onPress={async () => {
              await workout.setOutlierStatus(pending.setId, "confirmed");
              setPending(null);
              setSets(await workout.listSessionSets(loaded.sessionId));
            }}
          />
          <BigButton
            label={t("workout.outlier.reject")}
            selected={false}
            onPress={async () => {
              await workout.setOutlierStatus(pending.setId, "rejected");
              setPending(null);
              setSets(await workout.listSessionSets(loaded.sessionId));
            }}
          />
        </Card>
      ) : null}

      <Card>
        {offer.kind === "offer" ? (
          warmOpen ? (
            <View style={{ gap: space.sm }}>
              <AppText style={{ fontWeight: "700" }}>{t("warm.title", { load: fmt(offer.workingLoad) })}</AppText>
              {offer.sets.map((w, i) => (
                <AppText key={i} style={{ fontSize: 18 }}>{fmt(w.load)} × {isolateLtr(String(w.reps))}</AppText>
              ))}
              <AppText style={{ color: p.muted, fontSize: 13 }}>{t("warm.note")}</AppText>
              <BigButton
                label={t("warm.confirm")}
                disabled={saving}
                onPress={async () => {
                  setSaving(true);
                  try {
                    await workout.addWarmups(loaded.sessionId, ex.exerciseId, offer.sets, { gym: loaded.gym, equipment: ex.equipment, setup: ex.setup });
                    setSets(await workout.listSessionSets(loaded.sessionId));
                    setWarmOpen(false);
                    setWarmDone(ex.exerciseId);
                  } finally {
                    setSaving(false);
                  }
                }}
              />
              <BigButton label={t("warm.cancel")} selected={false} onPress={() => setWarmOpen(false)} />
            </View>
          ) : (
            <BigButton label={t("warm.add")} selected={false} onPress={() => setWarmOpen(true)} />
          )
        ) : warmDone === ex.exerciseId ? null : exSets.length === 0 && offer.reason !== "already_started" ? (
          <AppText style={{ color: p.muted, fontSize: 13 }}>{t(`warm.none.${offer.reason}` as never)}</AppText>
        ) : null}
        {warmDone === ex.exerciseId ? <AppText style={{ color: p.muted }}>✓ {t("warm.added")}</AppText> : null}
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <BigButton label={t("workout.working")} selected={!draft.warmup} onPress={() => setDraft((d) => ({ ...d, warmup: false }))} />
          </View>
          <View style={{ flex: 1 }}>
            <BigButton label={t("workout.warmup")} selected={draft.warmup} onPress={() => setDraft((d) => ({ ...d, warmup: true }))} />
          </View>
        </View>
        <Stepper
          label={`${t("workout.load")} (${unitText})`}
          value={draft.load === null ? "—" : weightText(draft.load, unit)}
          onLess={() => loadStep(-1)}
          onMore={() => loadStep(1)}
          lessLabel={t("workout.less")}
          moreLabel={t("workout.more")}
        />
        {!spec ? <AppText style={{ color: p.muted, fontSize: 13 }}>{t("workout.stepFallback")}</AppText> : null}
        <Stepper
          label={t("workout.reps")}
          value={draft.reps === null ? "—" : String(draft.reps)}
          onLess={() => setDraft((d) => ({ ...d, reps: stepReps(d.reps, -1) }))}
          onMore={() => setDraft((d) => ({ ...d, reps: stepReps(d.reps, 1) }))}
          lessLabel={t("workout.less")}
          moreLabel={t("workout.more")}
        />
        <AppText style={{ color: p.muted }}>{t("workout.effort")}</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {RIR_CHOICES.map((c) => (
            <View key={String(c)} style={{ minWidth: 88 }}>
              <BigButton label={c === null ? t("workout.effort.none") : t("workout.effort.n", { n: c })} selected={draft.rir === c} onPress={() => setDraft((d) => ({ ...d, rir: c }))} />
            </View>
          ))}
        </View>
        <BigButton label={t("workout.log")} disabled={!canLog(draft) || saving} onPress={() => void save(draft)} />
        <BigButton label={t("workout.repeat")} selected={false} disabled={!last || saving} onPress={() => last && void save({ ...last })} />
        <AppText accessibilityLiveRegion="polite" style={{ color: p.muted }}>
          {savedAt ? `✓ ${t("workout.saved", { time: clock(savedAt) })}` : t("workout.notSaved")}
        </AppText>
      </Card>

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("workout.setsToday")}</AppText>
        {exSets.map((s) => (
          <AppText key={s.id} ltr={false}>
            {isolateLtr(`${s.position}.`)} {formatLoad(s.load, lang, unit)} × {isolateLtr(String(s.reps))}
            {s.rir !== null ? ` · ${t("workout.effort.n", { n: s.rir })}` : ""}
            {s.warmup ? ` · ${t("workout.warmupTag")}` : ""}
            {s.outlierStatus === "unconfirmed" ? ` · ${t("workout.unconfirmedTag")}` : ""} ✓
          </AppText>
        ))}
        <BigButton
          label={t("workout.undo")}
          selected={false}
          disabled={exSets.length === 0}
          onPress={async () => {
            const lastSet = exSets[exSets.length - 1];
            if (!lastSet) return;
            await workout.deleteSet(lastSet.id);
            setSets(await workout.listSessionSets(loaded.sessionId));
          }}
        />
      </Card>

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("workout.rest")}</AppText>
        <AppText ltr style={{ fontSize: 44, fontWeight: "800", textAlign: "center" }}>
          {formatClock(remainingMs(timer, now))}
        </AppText>
        {restOver && !timerRunning ? <AppText>{t("workout.rest.done")}</AppText> : null}
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <BigButton label="−15" selected={false} onPress={() => setTimer((tm) => adjustTimer(tm, -15, Date.now()))} />
          </View>
          <View style={{ flex: 1 }}>
            <BigButton label="+15" selected={false} onPress={() => setTimer((tm) => adjustTimer(tm, 15, Date.now()))} />
          </View>
        </View>
        <BigButton
          label={timerRunning ? t("workout.rest.stop") : t("workout.rest.start")}
          selected={false}
          onPress={() => {
            setRestOver(false);
            setTimer((tm) => (tm.endsAt === null ? startTimer(tm, Date.now()) : stopTimer(tm)));
          }}
        />
      </Card>

      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <BigButton label={t("workout.prev")} selected={false} disabled={idx === 0} onPress={() => setIdx((i) => Math.max(0, i - 1))} />
        </View>
        <View style={{ flex: 1 }}>
          <BigButton label={t("workout.next")} selected={false} disabled={idx >= loaded.exercises.length - 1} onPress={() => setIdx((i) => i + 1)} />
        </View>
      </View>
      <BigButton
        label={t("workout.finish")}
        onPress={async () => {
          await workout.finishSession(loaded.sessionId);
          navigation.dispatch(StackActions.replace("Finish", { sessionId: loaded.sessionId }));
        }}
      />
    </ScrollView>
  );
}
