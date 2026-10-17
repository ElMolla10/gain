import { liftPace } from "@gain/engine";
import { AchievementCard } from "../components/AchievementCard";
import { HeroAchievement } from "../components/HeroAchievement";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import { Share, View } from "react-native";
import { useServices } from "../AppContext";
import type { SessionSummary } from "../db/finishRepo";
import type { SessionDetail } from "../db/historyRepo";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { useI18n } from "../i18n";
import { buildCardModel, cardHtml, cardPaceLine, toCoachPayload } from "../logic/coachCard";
import { sessionMilestones, type Milestone } from "../logic/sessionMilestones";
import { pickHero, type SurfaceBadge } from "../logic/achievementSurface";
import { formatWorkoutShareText, improvementLines, personalBestLines, workoutRecapStats } from "../logic/workoutRecap";
import { volumeText } from "../logic/liveSummary";
import type { StringKey } from "../i18n/strings";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, ErrorState, InlineStatus, LoadingState, Notice, Screen } from "../ui";
import { FinishedDayForecast, type SameDayForecast } from "../components/FinishedDayForecast";
import { MenuSheet } from "../components/LogParts";
import { Icon } from "../components/Icon";
import { finishStatCells, resolveWhyTargets } from "../logic/finishLayout";
import { SaveStatusLine } from "../components/SaveStatusLine";
import { HealthNote } from "../components/HealthNote";
import { diagnostics } from "../diagnostics";
import { runFinishFlow } from "../logic/finishFlow";

export function FinishScreen() {
  const { workout, finish, history, goals, programmes, coachLinks, autoSync, achievements } = useServices();
  const { t, lang, unit, unitText } = useI18n();
  const p = usePalette();
  const navigation = useNavigation<{ navigate: (n: string, params?: object) => void; popToTop: () => void }>();
  const sessionId = (useRoute().params as { sessionId: string }).sessionId;
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [sharingText, setSharingText] = useState(false);
  const [next, setNext] = useState<SameDayForecast | null | "none">(null);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState(false);
  const [askLink, setAskLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(0);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [hero, setHero] = useState<SurfaceBadge | null>(null);
  const [heroRest, setHeroRest] = useState<SurfaceBadge[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [goalLiftId, setGoalLiftId] = useState<string | null>(null);
  const [whyTargets, setWhyTargets] = useState<Record<string, string>>({});
  // Saved decision records for the forecast exercises: those open the real Why screen (read-only lookup).
  useEffect(() => {
    if (next === null || next === "none") return;
    let alive = true;
    void resolveWhyTargets(next.dayId, next.exercises.map((e) => e.exerciseId), finish).then((m) => { if (alive) setWhyTargets(m); });
    return () => { alive = false; };
  }, [next, finish]);
  // The goal lift leads the next-workout block when it is in it (F-1). Read-only; a failure just leaves the first exercise leading.
  useEffect(() => {
    let alive = true;
    goals.getPace(Date.now()).then((pace) => { if (alive && pace.kind === "lift") setGoalLiftId(pace.goal.exerciseId); }).catch(() => undefined);
    return () => { alive = false; };
  }, [goals]);

  // Continue planning the rotation; preview this finished day separately.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let finishedMs = Date.now();
    void runFinishFlow({
      summarize: async () => {
        const sess = await workout.getSession(sessionId);
        finishedMs = Number(sess?.finished_at ?? Date.now());
        setFinishedAt(finishedMs);
        return finish.summarizeSession(sessionId);
      },
      onSummary: setSummary,
      extras: async (nextSummary) => {
        try {
          const recent = await history.listSessions(20);
          const pace = await goals.getPace(finishedMs);
          let monthHistory: import("@gain/engine").HistorySession[] | null = null;
          let monthSetup: import("@gain/engine").SetupType | null = null;
          let trainedGoalLift = false;
          let paceBefore = null as import("@gain/engine").PaceStatus | null;
          if (pace.kind === "lift") {
            trainedGoalLift = nextSummary.exercises.some((e) => e.exerciseId === pace.goal.exerciseId);
            const lift = (await history.listLifts()).find((l) => l.exerciseId === pace.goal.exerciseId);
            if (lift) {
              const trend = await history.getLiftTrend(lift.lineId);
              monthHistory = trend?.sessions ?? null;
              monthSetup = lift.setup;
            }
            const hist = await goals.liftExposures(pace.goal.exerciseId);
            if (hist.length >= 2) {
              paceBefore = liftPace({ targetLoad: pace.goal.targetLoad, targetReps: pace.goal.targetReps, targetDate: pace.goal.targetDate }, hist.slice(0, -1), finishedMs).status;
            }
          }
          const facts: Milestone[] = sessionMilestones({
            finishedAt: recent.map((s) => s.finishedAt),
            nowMs: finishedMs,
            monthHistory,
            monthSetup,
            trainedGoalLift,
            paceBefore,
            paceAfter: pace.kind === "none" ? null : pace.pace.status,
          });
          setMilestones(facts.map((f) => {
            if (f.kind === "goal_reached") return t("recap.goalReached");
            if (f.kind === "goal_improved") return t("recap.goalImproved", { status: t(`pace.status.${f.status}` as StringKey) });
            if (f.kind === "streak") return t("recap.streak", { n: f.streak ?? 0 });
            return t("recap.monthPct", { pct: String(f.pct ?? 0) });
          }));
        } catch (e) {
          diagnostics.record("warn", "finish milestones", e);
        }
        // Sharing is secondary: a history-read failure must never block finishing a workout.
        try { setDetail(await history.getSession(sessionId)); }
        catch (e) { diagnostics.record("warn", "finish recap detail", e); }
      },
      // Not fatal: Today's Start re-plans via finish.planDay.
      plan: () => finish.writeNextSessionTargets(sessionId),
      sync: () => autoSync(true),
      preview: () => finish.previewFinishedDay(sessionId),
      achievements: async () => {
        try {
          await achievements.sync();
          const fresh = await achievements.listForSession(sessionId);
          const picked = pickHero(fresh);
          setHero(picked.hero);
          setHeroRest(picked.rest);
          if (picked.hero) await achievements.markCelebrated(fresh.map((r) => r.id));
        } catch (e) {
          diagnostics.record("warn", "finish hero", e);
        }
      },
      onForecast: setNext,
      record: (level, label, e) => diagnostics.record(level, label, e),
    }).then((r) => {
      // The workout itself is already finished and saved; only the summary could not be built. Retry instead of loading forever.
      if (r === "failed") {
        started.current = false;
        setFailed(true);
      }
    });
  }, [achievements, finish, history, workout, sessionId, autoSync, attempt]);

  if (failed && !summary) {
    return (
      <Screen>
        <ErrorState
          title={t("finish.error.title")}
          body={t("finish.error.body")}
          retryLabel={t("finish.error.retry")}
          onRetry={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      </Screen>
    );
  }
  if (!summary) return <LoadingState />;

  // The coach card: session, next targets, pace line (no bodyweight). One model feeds the PDF and the private link.
  const makeModel = async () => {
    const session = await workout.getSession(sessionId);
    const ms = Number(session?.finished_at ?? Date.now());
    const date = new Date(ms - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10); // local calendar day
    const pace = await goals.getPace();
    let paceLine: string | null = null;
    if (pace.kind === "lift") {
      const ex = (await programmes.listExercises()).find((e) => e.id === pace.goal.exerciseId);
      paceLine = cardPaceLine(pace, { t, fmt: (kg) => formatLoad(kg, lang, unit), exerciseName: ex ? exerciseLabels(ex, lang).primary : "", muscleName: (m) => t(`muscle.${m}` as StringKey) });
    } else if (pace.kind === "muscle") {
      paceLine = cardPaceLine(pace, { t, fmt: (kg) => formatLoad(kg, lang, unit), exerciseName: "", muscleName: (m) => t(`muscle.${m}` as StringKey) });
    }
    return buildCardModel({
      lang, unit, date, summary, next: null,
      forecast: next === "none" || next === null ? null : {
        dayName: next.dayName,
        exercises: next.exercises.map(ex => ({ nameEn: ex.nameEn, nameAr: ex.nameAr, measure: ex.measure, proposal: ex.proposal })),
      },
      paceLine,
    });
  };

  // PDF through the system share sheet. Nothing is uploaded.
  const shareCard = async () => {
    setError(null);
    setSharing(true);
    try {
      const model = await makeModel();
      if (!(await Sharing.isAvailableAsync())) throw new Error(t("card.noSharing"));
      const { uri } = await Print.printToFileAsync({ html: cardHtml(model) });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: model.title });
    } catch (e) {
      setError(t("card.failed", { detail: e instanceof Error ? e.message : String(e) }));
    } finally {
      setSharing(false);
    }
  };

  // Native text share sheet: plain text from the saved workout. No file, image, cloud call, or account needed.
  const shareWorkoutText = async () => {
    if (!summary) return;
    setError(null);
    setSharingText(true);
    try {
      const latest = detail ?? await history.getSession(sessionId);
      if (!latest) throw new Error("Finished workout not found");
      await Share.share({ message: formatWorkoutShareText(latest, summary, lang, unit) });
    } catch (e) {
      diagnostics.record("warn", "share workout text", e);
      setError(t("recap.shareFailed"));
    } finally {
      setSharingText(false);
    }
  };

  // Private link: uploads this ONE card after the lifter agreed on screen. Needs internet; the PDF does not.
  const shareLink = async () => {
    setError(null);
    setLinking(true);
    try {
      const made = await coachLinks.create(toCoachPayload(await makeModel()), 7);
      if (!made.ok) return setError(t(`sync.err.${made.error}` as StringKey));
      setLink({ id: made.id, url: made.url });
      setAskLink(false);
      await Share.share({ message: t("link.message", { url: made.url }) });
    } catch (e) {
      setError(t("card.failed", { detail: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLinking(false);
    }
  };
  const stopLink = async () => {
    if (!link) return;
    const r = await coachLinks.revoke(link.id);
    if (!r.ok) return setError(t(`sync.err.${r.error}` as StringKey));
    setLink(null);
    setNotices((n) => ({ ...n, link: t("link.stopped") }));
  };

  const noSets = summary.totals.counted === 0 && summary.totals.warmups === 0 && summary.totals.unconfirmed === 0;
  const improvements = improvementLines(summary, lang, unit);
  const pbLines = personalBestLines(summary, lang, unit);
  const stats = detail ? workoutRecapStats(detail, summary) : null;
  const statCells = finishStatCells({
    sets: summary.totals.counted, exercises: summary.totals.exercises,
    volume: stats ? volumeText(stats.volumeKg, unit) : null, minutes: stats?.durationMinutes ?? null,
  }, { sets: t("workout.stat.sets"), exercises: t("recap.exercises"), volume: t("workout.stat.volume"), duration: t("workout.stat.duration"), unit: unitText, min: t("workout.dur.m") });

  return (
    <Screen footer={<BigButton hero label={t("finish.done")} onPress={() => navigation.popToTop()} />}>
      {/* 1. What happened: honest, quiet. An empty workout is not celebrated. */}
      <View style={{ gap: space.sm }}>
        <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>{t("finish.title")}</AppText>
        <SaveStatusLine since={finishedAt} />
      </View>

      {/* 2. The hand-off: the next workout's weights, right under the title (F-1). Forecast of the next occurrence of THIS day. */}
      {next === null
        ? <Card><AppText style={{ color: p.muted }}>{t("common.loading")}</AppText></Card>
        : <FinishedDayForecast value={next} leadExerciseId={goalLiftId} whyTargets={whyTargets} onWhy={(targetId) => navigation.navigate("Why", { targetId })} />}

      {/* 3. One row of stats: values 20/26, labels 13; only the next load is drawn at 36 (F-5). */}
      <Card>
        {noSets ? (
          <AppText>{t("finish.noSets")}</AppText>
        ) : (
          <>
            <View style={{ flexDirection: "row", columnGap: space.md, rowGap: space.sm, flexWrap: "wrap" }}>
              {statCells.map((c) => (
                <View key={c.key} style={{ flexGrow: 1, minWidth: 64 }}>
                  <AppText style={{ fontSize: ty.section, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{c.value}</AppText>
                  <AppText style={{ color: p.muted, fontSize: ty.caption }}>{c.label}</AppText>
                </View>
              ))}
            </View>
            {summary.totals.warmups + summary.totals.unconfirmed > 0 ? (
              <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("finish.excludedNote", { warmups: summary.totals.warmups, unconfirmed: summary.totals.unconfirmed })}</AppText>
            ) : null}
          </>
        )}
      </Card>

      {/* 4. Personal bests and achievements. */}
      {hero ? <HeroAchievement hero={hero} rest={heroRest} /> : null}
      <Card>
        <View style={{ gap: space.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            {/* A drawn trophy, not the emoji (renders differently per platform) (F-6). */}
            {pbLines.length > 0 ? <Icon name="trophy" color={p.accent} size={20} /> : null}
            <AppText accessibilityRole="header" style={{ flexShrink: 1, fontSize: ty.section, fontWeight: "600", color: pbLines.length ? p.accent : p.text }}>
              {t("recap.personalBests")}{pbLines.length ? ` (${pbLines.length})` : ""}
            </AppText>
          </View>
          {pbLines.length ? pbLines.map((line, i) => <AppText key={i}>{line}</AppText>) : <AppText style={{ color: p.muted }}>{t("recap.noPbs")}</AppText>}
          {milestones.map((line, i) => <AppText key={`m${i}`}>{line}</AppText>)}
        </View>
      </Card>

      <Card>
        <AppText accessibilityRole="header" style={{ fontWeight: "600" }}>{t("progress.improved")}</AppText>
        {improvements.length ? improvements.map((line, i) => <AppText key={i}>{line}</AppText>) : <AppText>{t("progress.steady")}</AppText>}
        <AppText style={{ color: p.muted }}>{t("progress.note")}</AppText>
      </Card>
      {detail ? <AchievementCard detail={detail} summary={summary} /> : null}

      {/* 3. Sharing is optional and secondary. */}
      {/* 5. One Share button; text, PDF and link are in a menu (F-7). The link still asks for consent before anything is uploaded. */}
      <View style={{ gap: space.sm }}>
        <BigButton variant="secondary" icon="export" label={sharingText ? t("common.loading") : sharing ? t("card.sharing") : t("finish.share")} loading={sharingText || sharing} disabled={sharingText || sharing} onPress={() => setShareOpen(true)} />
        <MenuSheet
          visible={shareOpen}
          title={t("finish.share")}
          onClose={() => setShareOpen(false)}
          items={[
            { label: t("recap.shareText"), onPress: () => void shareWorkoutText() },
            { label: t("card.share"), onPress: () => void shareCard() },
            ...(link ? [] : [{ label: t("link.share"), onPress: () => setAskLink(true) }]),
          ]}
        />
        {askLink ? (
          <Card>
            <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("link.consent.title")}</AppText>
            <AppText>{t("link.consent.body")}</AppText>
            <BigButton label={linking ? t("link.sharing") : t("link.consent.ok")} loading={linking} onPress={shareLink} />
            <BigButton variant="secondary" label={t("link.consent.cancel")} disabled={linking} onPress={() => setAskLink(false)} />
          </Card>
        ) : link ? (
          <Card>
            <InlineStatus kind="success" text={t("link.ready")} />
            <BigButton variant="secondary" label={t("link.again")} onPress={() => void Share.share({ message: t("link.message", { url: link.url }) })} />
            <BigButton variant="secondary" label={t("link.stop")} onPress={stopLink} />
          </Card>
        ) : notices.link ? <AppText style={{ color: p.muted }}>{notices.link}</AppText> : null}
      </View>
      <HealthNote />
    </Screen>
  );
}
