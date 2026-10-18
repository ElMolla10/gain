import { renderReason, type GymFingerprint, type SessionSummary } from "@gain/engine";
import { PersonalProgressCard } from "../components/PersonalProgressCard";
import { leadTarget } from "../logic/nextTarget";
import { plannedScheme, targetRowText } from "../logic/bidiText";
import { formatDay } from "../logic/dateText";
import { localizeReason } from "../logic/units";
import { todayHero } from "../logic/todayHero";
import { todayRows, type TodayRow } from "../logic/todayRows";
import { deltaChip, doneAround } from "../logic/todayCopy";
import { rackA11yLabel, stubLines, timeLine, writtenAfter } from "../logic/todayStub";
import { haptics } from "../haptics";
import { TodayBar } from "../components/today/TodayBar";
import { TodayHeader } from "../components/today/TodayHeader";
import { DoorStub } from "../components/today/DoorStub";
import { glyphFor, RackRow } from "../components/today/RackRow";
import type { DayLoadPreview, TargetRow } from "../db/finishRepo";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { describePace } from "../logic/paceText";
import type { StringKey } from "../i18n/strings";
import { WeeklyReviewCard } from "../components/WeeklyReviewCard";
import { MuscleVolumeCard } from "../components/MuscleVolumeCard";
import { DeloadCard } from "../components/DeloadCard";
import { PeriodizationCard } from "../components/PeriodizationCard";
import { useServices } from "../AppContext";
import { exerciseLabels } from "../i18n/format";
import { estimateDayMinutes } from "../logic/duration";
import { loadRestSettings } from "../logic/restAlert";
import { useI18n } from "../i18n";
import { MIN_TOUCH, radius, space, type as ty, usePalette } from "../theme";
import { Icon } from "../components/Icon";
import { dayLabel, initialSelection, markSuggested, dayNeedingPreview, sessionAction, startDay, type DayChoice } from "../logic/dayChoice";
import { AppText, BigButton, Card, ChoiceSheet, CollapsibleCard, EmptyState, ErrorState, InlineStatus, LoadingState, QuietAction, Screen, SectionTitle } from "../ui";
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
  /** Computed without creating a planned session, lazily: only for a day once it is on screen (17), cached until the next load. */
  previews: Record<string, DayLoadPreview[]>;
  activeGym: string | null;
  /** Which load these previews belong to: a late preview from an earlier focus is dropped. */
  loadId: number;
}

/** The hero extras for the day on screen, fetched lazily (never in the focus load) and cached per load + day (spec §10). */
interface DoorExtras {
  key: string;
  gym: GymFingerprint | null;
  /** Stored decision per target id: when it was written and the newest comparable session it used. */
  decisions: Record<string, { createdAt: number; last: SessionSummary | null }>;
  sessions: { dayName: string; finishedAt: number }[];
}

export function TodayScreen() {
  const { repos, goals, programmes, shortWeek, deload, weeklyPlan, finish, workout, history } = useServices();
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
  const [noteOpen, setNoteOpen] = useState(false);
  const [extras, setExtras] = useState<DoorExtras | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [xrayRow, setXrayRow] = useState<string | null>(null);
  const { fontScale } = useWindowDimensions();
  const loadSeq = useRef(0);
  const inflight = useRef(new Set<string>());

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const loadId = ++loadSeq.current;
      void runLoad<TodayData>(async () => {
        // A new training week has begun: the normal program returns (if the lifter has not already edited it).
        await shortWeek.endIfExpired(Date.now(), -new Date().getTimezoneOffset() * 60_000).catch(() => undefined);
        await deload.endIfExpired(Date.now(), -new Date().getTimezoneOffset() * 60_000).catch(() => undefined);
        await weeklyPlan.endIfExpired(Date.now()).catch(() => undefined);
        const shortActive = await shortWeek.getActive();
        if (alive) setShort(shortActive);
        const next = await repos.getNextDay();
        if (!next) return null; // no program at all: the genuinely empty state
        const dayList = await repos.listDays(next.versionId);
        const lists = await Promise.all(dayList.map((d) => repos.listDayExercises(d.id)));
        const marked = markSuggested(dayList.map((d, i) => ({ id: d.id, name: d.name, exercises: lists[i]!.length, sets: lists[i]!.reduce((n, e) => n + e.sets, 0) })), next.day.id);
        const open = await workout.getOpenSession();
        const targets: Record<string, TargetRow[]> = {};
        // Independent reads: run together. Existing edited/accepted targets win over previews.
        const planned = await Promise.all(dayList.map(async (d) => {
          const ps = await finish.getPlannedSession(d.id);
          return ps ? ([d.id, await finish.getTargets(ps.id)] as const) : null;
        }));
        for (const e of planned) if (e) targets[e[0]] = e[1];
        // Previews (one engine run per exercise) are computed only for the day on screen, below.
        const previews: Record<string, DayLoadPreview[]> = {};
        const activeGym = await repos.getActiveGymId();
        const active = await repos.getLatestProgrammeVersion();
        const pace = await goals.getPace(Date.now());
        const lib = pace.kind === "lift" ? await programmes.listExercises() : [];
        const ex = pace.kind === "lift" ? lib.find((e) => e.id === pace.goal.exerciseId) : undefined;
        if (alive) setPaceLine(pace.kind === "none" ? "" : describePace(pace, { t, fmt, exerciseName: ex ? exerciseLabels(ex, lang).primary : "", muscleName: (m) => t(`muscle.${m}` as StringKey) }).short);
        if (alive) setPicked((cur) => initialSelection(marked, next.day.id, open?.dayId ?? null, cur));
        return { programmeName: next.programmeName, isSample: active?.isSample ?? false, days: marked.map((d, i) => ({ ...d, list: lists[i]! })), suggestedId: next.day.id, openDayId: open?.dayId ?? null, restSeconds: (await loadRestSettings(repos)).seconds, targets, previews, activeGym, loadId };
      }, (e) => diagnostics.record("error", "today load", e)).then((r) => alive && setState(r));
      return () => {
        alive = false;
      };
    }, [repos, goals, programmes, shortWeek, deload, weeklyPlan, workout, finish, t, fmt, lang, attempt]),
  );

  // The day on screen gets its preview on demand; a late result is cached under its own day id (never shown for another day) and
  // dropped when a newer load replaced the data.
  const ready = state.kind === "ready" ? state.data : null;
  const viewId = ready ? (ready.days.find((d) => d.id === picked) ?? ready.days[0])?.id ?? null : null;
  const previewDay = ready ? dayNeedingPreview(viewId, !!ready.activeGym, ready.targets, ready.previews) : null;
  const previewGym = ready?.activeGym ?? null;
  const previewLoad = ready?.loadId ?? 0;
  useEffect(() => {
    if (!previewDay || !previewGym) return;
    const key = `${previewLoad}:${previewDay}`;
    if (inflight.current.has(key)) return;
    inflight.current.add(key);
    void finish.previewDayLoads(previewDay, previewGym)
      .catch((e) => {
        diagnostics.record("warn", "today preview", e);
        return [] as DayLoadPreview[];
      })
      .then((rows) => {
        inflight.current.delete(key);
        setState((s) => (s.kind === "ready" && s.data.loadId === previewLoad ? { ...s, data: { ...s.data, previews: { ...s.data.previews, [previewDay]: rows } } } : s));
      });
  }, [finish, previewDay, previewGym, previewLoad]);

  // The door extras (gym plates, decision records, the session the targets were written after) for the day on screen only.
  const viewTargets = ready && viewId ? ready.targets[viewId] ?? [] : [];
  const extrasKey = ready && viewId ? `${ready.loadId}:${viewId}:${viewTargets.map((x) => x.id).join(",")}` : null;
  useEffect(() => {
    if (!extrasKey || !ready) return;
    if (inflight.current.has(extrasKey)) return;
    inflight.current.add(extrasKey);
    const ids = viewTargets.map((x) => x.id);
    const gymId = ready.activeGym;
    void (async () => {
      const [gym, decs, sessions] = await Promise.all([
        gymId ? repos.loadGymFingerprint(gymId).catch(() => null) : Promise.resolve(null),
        Promise.all(ids.map((id) => finish.getDecision(id).catch(() => null))),
        ids.length > 0 ? history.listSessions(10).catch(() => []) : Promise.resolve([]),
      ]);
      const decisions: DoorExtras["decisions"] = {};
      ids.forEach((id, i) => {
        const d = decs[i];
        if (d) decisions[id] = { createdAt: d.createdAt, last: d.payload.inputs?.sessions?.[0] ?? null };
      });
      return { key: extrasKey, gym, decisions, sessions: sessions.map((x) => ({ dayName: x.dayName, finishedAt: x.finishedAt })) };
    })()
      .catch((e) => {
        diagnostics.record("warn", "today extras", e);
        return { key: extrasKey, gym: null, decisions: {}, sessions: [] } as DoorExtras;
      })
      .then((x) => {
        inflight.current.delete(extrasKey);
        setExtras(x);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extrasKey, repos, finish, history]);

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
  const rows = todayRows(exercises, data.targets[chosen.id] ?? [], data.previews[chosen.id] ?? []);
  const byRow = new Map(rows.map((r) => [r.exerciseId, r]));
  const anyWeight = rows.some((r) => r.status !== "rejected" && r.currency !== "none" && r.effectiveLoad !== null);
  const isPreview = rows.length > 0 && rows.every((r) => r.preview);
  const lead = leadTarget(rows, goalIds);
  const leadEx = lead ? exercises.find((e) => e.exerciseId === lead.exerciseId) ?? null : null;
  const letters = { s: t("qty.s"), m: t("qty.m") };
  const action = sessionAction(chosen.id, data.openDayId);
  const openDay = data.openDayId ? data.days.find((d) => d.id === data.openDayId) : undefined;
  const label = dayLabel(chosen, data.openDayId);
  const labelText = label === "inProgress" ? t("today.inProgress") : label === "suggested" ? t("today.suggestedToday") : t("today.yourChoice");
  const minutes = estimateDayMinutes({ exercises: chosen.exercises, sets: chosen.sets }, data.restSeconds);
  const buttonText = action.kind === "start" ? `${t("today.startDay", { day: chosen.name })} · ${t("today.footerMin", { min: minutes })}` : action.elsewhere && openDay ? t("today.resumeDay", { day: openDay.name }) : t("today.resume");
  const ex = extras && extras.key.startsWith(`${data.loadId}:${chosen.id}:`) ? extras : null;
  const now = Date.now();
  const lastOf = (r: TodayRow): SessionSummary | null => r.last ?? (r.targetId ? ex?.decisions[r.targetId]?.last ?? null : null);
  const reasonOf = (r: TodayRow): string | null => (r.reason ? renderReason(localizeReason(r.reason, unit, lang), lang) : null);
  const chipOf = (r: TodayRow) => deltaChip({ load: r.effectiveLoad, reps: r.reps, status: r.status }, lastOf(r), { lang, unit, t, lighterWeek: r.normalLoad !== null });
  const targetOf = (r: TodayRow | undefined) => (r && r.status !== "rejected" && r.currency !== "none" && r.effectiveLoad !== null ? targetRowText(r, lang, unit, letters) : null);

  // The hero: the lead lift drawn as the loaded object. Its plates need the gym (lazy): until then the number shows alone.
  const hero = lead && leadEx
    ? todayHero({
      target: { exerciseId: lead.exerciseId, load: lead.effectiveLoad, reps: lead.reps, measure: lead.measure, durationS: lead.durationS, distanceM: lead.distanceM },
      exercise: { exerciseId: leadEx.exerciseId, nameEn: leadEx.nameEn, nameAr: leadEx.nameAr, equipment: leadEx.equipment, setup: leadEx.setup, measure: leadEx.measure, pattern: leadEx.pattern, loadSpec: leadEx.loadSpec, isGoalLift: leadEx.isGoalLift },
      gym: ex?.gym ?? null,
      normalLoad: lead.normalLoad,
      position: exercises.findIndex((e) => e.exerciseId === lead.exerciseId),
    })
    : data.isSample && !anyWeight ? todayHero({ target: null, exercise: null, gym: null, isSample: true }) : null;
  const leadName = leadEx ? exerciseLabels(leadEx, lang).primary : "";
  const stub = lead
    ? stubLines(
      {
        preview: lead.preview,
        createdAt: lead.targetId ? ex?.decisions[lead.targetId]?.createdAt ?? null : null,
        afterDay: lead.targetId && ex?.decisions[lead.targetId] ? writtenAfter(ex.decisions[lead.targetId]!.createdAt, ex.sessions) : null,
        edited: lead.editedLoad !== null ? { load: lead.editedLoad } : null,
        last: lastOf(lead),
        chip: lastOf(lead) ? chipOf(lead).text : null,
        reason: reasonOf(lead),
      },
      { lang, unit, t, now },
    )
    : null;
  const stubLoading = !!lead && !lead.preview && !ex;

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      // Only a NEW workout gets its planned session and targets (planned sessions of other days are voided: missed days never stack).
      // An open workout is resumed as it is, whichever day is shown.
      // Planning never blocks training: a failure is recorded and the workout still opens.
      await startDay(action, {
        plan: async (dayId) => {
          const gymId = await repos.getActiveGymId();
          if (gymId) await finish.planDay(dayId, gymId);
        },
        navigate: (dayId) => navigation.navigate("Workout", { dayId }),
        record: (e) => diagnostics.record("error", "today start", e),
      });
    } finally {
      setStarting(false);
    }
  }

  const stack = fontScale > 1.3;
  const footer = <BigButton hero icon={action.kind === "start" ? "play" : undefined} label={buttonText} disabled={starting} loading={starting} onPress={() => void start()} />;
  return (
    <Screen tab footer={footer} footerInline={stack}>
      {/* The day name is the one title; the date, the label and Change sit around it (spec §0 row 0). */}
      <TodayHeader date={formatDay(now, lang, now)} dayName={chosen.name} label={labelText} dayIndex={data.days.findIndex((d) => d.id === chosen.id)} dayCount={data.days.length} onChange={() => setChangeOpen(true)} />
      {action.kind === "resume" ? <InlineStatus kind={action.elsewhere ? "warn" : "info"} text={action.elsewhere ? t("today.finishOpenFirst") : t("today.openWorkout")} /> : null}

      {/* Today's Bar: the lead lift as the real loaded object, on bg with no card. */}
      {hero ? (
        <View style={{ gap: space.sm }}>
          <TodayBar hero={hero} name={leadName} />
          {lead ? (
            <DoorStub
              provenance={stub?.provenance ?? null}
              lastTime={stub?.lastTime ?? null}
              loading={stubLoading}
              whyLabel={`${t("workout.whyShort")}: ${leadName}`}
              onWhy={lead.targetId ? () => navigation.navigate("Why", { targetId: lead.targetId! }) : undefined}
            />
          ) : null}
        </View>
      ) : null}

      {/* The rack: every other exercise, 64 dp rows. Planned vs preview is said once, in the header. */}
      <View style={{ gap: space.sm }}>
        <SectionTitle action={<QuietAction icon="why" label={t("workout.whyShort")} accessibilityLabel={t("today.previewNoteToggle")} expanded={noteOpen} onPress={() => setNoteOpen((o) => !o)} />}>{isPreview ? t("today.rack.preview") : t("today.rack.planned")}</SectionTitle>
        {noteOpen ? <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("today.previewNote")}</AppText> : null}
        {previewDay ? <AppText style={{ color: p.muted }}>{t("common.loading")}</AppText> : !anyWeight ? <AppText style={{ color: p.muted }}>{t("today.noTargetsYet")}</AppText> : null}
        <Card style={{ paddingVertical: space.xs }}>
          {exercises.filter((e) => !(lead && hero && e.exerciseId === lead.exerciseId)).map((e) => {
            const l = exerciseLabels(e, lang);
            const r = byRow.get(e.exerciseId);
            // Only the scheme is isolated; the tag and the other-language name follow the app's direction (T-2).
            const planned = plannedScheme(e.sets, e.repMin, e.repMax, e.measure, letters);
            const scheme = `${planned}${e.isGoalLift ? ` · ${t("today.goalTag")}` : ""}${l.secondary ? ` · ${l.secondary}` : ""}`;
            const target = targetOf(r);
            const chip = r && target ? chipOf(r).text : null;
            const last = r ? lastOf(r) : null;
            const reason = r ? reasonOf(r) : null;
            const plates = e.equipment === "barbell" && r && target && ex?.gym
              ? (() => { const h = todayHero({ target: { exerciseId: e.exerciseId, load: r.effectiveLoad, reps: r.reps, measure: r.measure }, exercise: { ...e, isGoalLift: e.isGoalLift }, gym: ex.gym }); return h && h.kind === "barbell" && h.calc.perSide.length > 0 ? h.calc.perSide : null; })()
              : null;
            return (
              <RackRow
                key={e.id}
                name={l.primary}
                scheme={scheme}
                target={target}
                noTarget={t("today.noWeightYet")}
                chip={chip}
                glyph={glyphFor(e.equipment, e.setup)}
                a11yLabel={rackA11yLabel({ name: l.primary, scheme: planned, target, chip }, t, lang)}
                expanded={openRow === e.id}
                onToggle={() => setOpenRow((o) => (o === e.id ? null : e.id))}
                xray={plates ? { perSide: plates, open: xrayRow === e.id, onOpen: () => { haptics.pickup(); setXrayRow((o) => (o === e.id ? null : e.id)); } } : null}
              >
                {last ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{stubLines({ preview: true, createdAt: null, afterDay: null, edited: null, last, chip: null, reason: null }, { lang, unit, t, now }).lastTime}</AppText> : null}
                {reason ? <AppText style={{ fontSize: ty.label }}>{reason}</AppText> : null}
                {r?.targetId ? <QuietAction label={t("workout.whyShort")} icon="why" accessibilityLabel={`${t("workout.whyShort")}: ${l.primary}`} onPress={() => navigation.navigate("Why", { targetId: r.targetId! })} /> : null}
              </RackRow>
            );
          })}
        </Card>
      </View>

      {/* The program name on its own line (14 muted), then the time line: no separator left dangling when a line wraps, and no bidi
          joint between a Latin program name and an Arabic sentence (T-3). */}
      <View style={{ gap: 2 }}>
        <AppText style={{ color: p.muted, fontSize: ty.label }}>{data.programmeName}</AppText>
        <AppText style={{ color: p.muted, fontSize: ty.label }}>{timeLine(chosen.exercises, chosen.sets, minutes, doneAround(now, minutes), lang, t)}</AppText>
      </View>
      {/* Goal pace in one line: a 48 dp link to Goals. */}
      {paceLine ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("goals.entry")}: ${paceLine}`}
          onPress={() => navigation.navigate("Goals")}
          style={({ pressed }) => ({ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.button, backgroundColor: pressed ? p.raised : "transparent" })}
        >
          <AppText style={{ flex: 1, fontSize: ty.label, color: p.muted }}>{paceLine}</AppText>
          <Icon name="chevron" color={p.muted} size={18} mirror />
        </Pressable>
      ) : null}
      {data.isSample ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("today.starterNote")}</AppText> : null}

      {/* Everything else about the week in ONE collapsed card instead of five stacked ones (T-5). Each section still loads itself and
          keeps its own actions; a section with nothing to say renders nothing, and with no sections the card is not drawn. */}
      <CollapsibleCard title={t("today.thisWeek")} note={t("today.thisWeekNote")}>
        <PersonalProgressCard />
        <WeeklyReviewCard />
        <MuscleVolumeCard />
        <DeloadCard />
        <PeriodizationCard />
      </CollapsibleCard>

      <View style={{ gap: space.xs }}>
        {short ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("short.active", { days: short.days })}</AppText> : null}
        <BigButton variant="quiet" label={t("short.entry")} onPress={() => navigation.navigate("ShortWeek")} />
      </View>
      <HealthNote />

      <ChoiceSheet
        visible={changeOpen}
        title={t("today.choose")}
        note={t("today.chooseNoteShort")}
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
