import { isTimed, quantityText, targetPhrase, targetQuantity } from "../logic/quantity";
import { shortReason, targetText } from "../logic/nextTarget";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useNavigation, useRoute } from "@react-navigation/native";
import { findSpec, nextLoadAbove, renderReason, type GymFingerprint } from "@gain/engine";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Share, View } from "react-native";
import { useServices } from "../AppContext";
import type { SessionSummary, TargetRow } from "../db/finishRepo";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { useI18n } from "../i18n";
import { stepLoad } from "../logic/draft";
import { buildCardModel, cardHtml, cardPaceLine, toCoachPayload } from "../logic/coachCard";
import { jumpKindText } from "../logic/jumpText";
import type { StringKey } from "../i18n/strings";
import { localizeReason, weightText } from "../logic/units";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, ErrorState, IconButton, InlineStatus, LoadingState, Notice, Screen, TargetStrip } from "../ui";
import { SaveStatusLine } from "../components/SaveStatusLine";
import { HealthNote } from "../components/HealthNote";
import { diagnostics } from "../diagnostics";
import { checkJump, jumpOptions, JUMP_SETTING_KEY, parseJumpThreshold, type JumpCheck } from "../logic/jumpGuard";

interface Next {
  sessionId: string;
  dayName: string;
  gym: GymFingerprint;
  targets: TargetRow[];
  equipment: Record<string, { equipment: Parameters<typeof findSpec>[1]; setup: "free" | "assisted" | "bodyweight" | string }>;
}

export function FinishScreen() {
  const { repos, workout, finish, goals, programmes, coachLinks, autoSync } = useServices();
  const { t, lang, unit, unitText } = useI18n();
  const p = usePalette();
  const navigation = useNavigation<{ navigate: (n: string, params?: object) => void; popToTop: () => void }>();
  const sessionId = (useRoute().params as { sessionId: string }).sessionId;
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [next, setNext] = useState<Next | null | "none">(null);
  const [editing, setEditing] = useState<{ targetId: string; load: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState(false);
  const [askLink, setAskLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  /** A proposed jump of more than 10% waiting for the lifter's decision (P04). */
  const [jumpFor, setJumpFor] = useState<{ targetId: string; check: JumpCheck; prev: number } | null>(null);
  const [threshold, setThreshold] = useState(10);
  const [attempt, setAttempt] = useState(0);
  const [showRecords, setShowRecords] = useState(false);
  const [finishedAt, setFinishedAt] = useState(0);

  const reload = useCallback(
    async (n: Next) => setNext({ ...n, targets: await finish.getTargets(n.sessionId) }),
    [finish],
  );

  // Write the next session's targets as soon as this screen opens (idempotent), then show them.
  useEffect(() => {
    void repos.getSetting(JUMP_SETTING_KEY).then((v) => setThreshold(parseJumpThreshold(v)));
  }, [repos]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const sess = await workout.getSession(sessionId);
      setFinishedAt(Number(sess?.finished_at ?? Date.now()));
      setSummary(await finish.summarizeSession(sessionId));
      const written = await finish.writeNextSessionTargets(sessionId);
      autoSync(true); // a finished workout is the moment to back up, if (and only if) the lifter turned that on
      if (!written) return setNext("none");
      const planned = await workout.getSession(written.sessionId);
      if (!planned) return setNext("none");
      const gym = await repos.loadGymFingerprint(planned.gym_id);
      const exs = await repos.listDayExercises(planned.programme_day_id);
      const equipment: Next["equipment"] = {};
      for (const e of exs) equipment[e.exerciseId] = { equipment: e.equipment, setup: e.setup };
      setNext({ sessionId: written.sessionId, dayName: written.dayName, gym, targets: await finish.getTargets(written.sessionId), equipment });
    })().catch((e) => {
      // The workout itself is already finished and saved; only the summary could not be built. Retry instead of loading forever.
      diagnostics.record("error", "finish summary", e);
      started.current = false;
      setFailed(true);
    });
  }, [finish, repos, workout, sessionId, autoSync, attempt]);

  if (failed && (!summary || next === null)) {
    return (
      <Screen>
        <ErrorState
          title={t("finish.error.title")}
          body={t("workout.finishFailed.body")}
          retryLabel={t("finish.error.retry")}
          onRetry={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      </Screen>
    );
  }
  if (!summary || next === null) return <LoadingState />;

  const act = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      if (next !== "none") await reload(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

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
    return buildCardModel({ lang, unit, date, summary, next: next === "none" ? null : { dayName: next.dayName, targets: next.targets }, paceLine });
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
  const recordLines = summary.exercises.flatMap((e) => {
    const name = lang === "ar" ? e.nameAr : e.nameEn;
    const lines: string[] = [];
    if (e.firstTime) lines.push(`${name}: ${t("finish.firstTime")}`);
    for (const r of e.records) {
      if (r === "load" && e.top) lines.push(`${name}: ${t("finish.record.load", { load: formatLoad(e.top.load, lang, unit) })}`);
      if (r === "quantity_at_load" && e.top && e.measure && e.top.quantity !== undefined) {
        const q = isolateLtr(quantityText(e.top.quantity, e.measure, { s: t("qty.s"), m: t("qty.m") }));
        lines.push(`${name}: ${e.top.load > 0 ? t("finish.record.quantity", { load: formatLoad(e.top.load, lang, unit), q }) : t("finish.record.quantityBare", { q })}`);
      }
      if (r === "reps_at_load" && e.top) lines.push(`${name}: ${t("finish.record.reps", { load: formatLoad(e.top.load, lang, unit), reps: e.top.reps })}`);
    }
    return lines;
  });

  return (
    <Screen footer={<BigButton hero label={t("finish.done")} onPress={() => navigation.popToTop()} />}>
      {/* 1. What happened: honest, quiet. An empty workout is not celebrated. */}
      <View style={{ gap: space.sm }}>
        <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>{t("finish.title")}</AppText>
        <SaveStatusLine since={finishedAt} />
      </View>

      <Card>
        {noSets ? (
          <AppText>{t("finish.noSets")}</AppText>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm, flexWrap: "wrap" }}>
              <AppText ltr style={{ fontSize: ty.load, fontWeight: "600" }}>{summary.totals.counted}</AppText>
              <AppText style={{ color: p.muted }}>{t("finish.countedLabel")}</AppText>
            </View>
            {summary.totals.warmups + summary.totals.unconfirmed > 0 ? (
              <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("finish.excludedNote", { warmups: summary.totals.warmups, unconfirmed: summary.totals.unconfirmed })}</AppText>
            ) : null}
          </>
        )}
        {/* Records are secondary: collapsed until asked for. */}
        {recordLines.length > 0 || summary.totals.records === 0 ? (
          <>
            <BigButton variant="quiet" icon={showRecords ? undefined : "chevron"} label={`${t("finish.records")}${recordLines.length > 0 ? ` (${recordLines.length})` : ""}`} onPress={() => setShowRecords((v) => !v)} />
            {showRecords ? (
              recordLines.length > 0 ? recordLines.map((l) => <AppText key={l}>{l}</AppText>) : <AppText>{t("finish.noRecords")}</AppText>
            ) : null}
          </>
        ) : null}
      </Card>

      {/* 2. What happens next: the targets are already written; accept, edit or reject each. */}
      {next === "none" ? (
        <Card><AppText>{t("finish.noNext")}</AppText></Card>
      ) : (
        <View style={{ gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("finish.next", { day: next.dayName })}</AppText>
            <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("finish.nextHint")}</AppText>
          </View>
          {error ? <Notice kind="error">{error}</Notice> : null}
          {next.targets.map((tg) => {
            const info = next.equipment[tg.exerciseId];
            const spec = info ? findSpec(next.gym, info.equipment) : null;
            const isEditing = editing?.targetId === tg.id;
            const hasTarget = !(tg.currency === "none" || (tg.effectiveLoad === null && tg.status !== "rejected")) && tg.status !== "rejected";
            return (
              <Card key={tg.id}>
                <AppText style={{ fontWeight: "600" }}>{lang === "ar" ? tg.nameAr : tg.nameEn}</AppText>
                {tg.currency === "none" || (tg.effectiveLoad === null && tg.status !== "rejected") ? (
                  <AppText style={{ color: p.muted }}>{t("finish.noTarget")}</AppText>
                ) : tg.status === "rejected" ? (
                  <AppText style={{ color: p.muted }}>{t("finish.rejectedNote")}</AppText>
                ) : (
                  <TargetStrip label={t("target.label")} value={isolateLtr(targetText(tg, (kg) => formatLoad(kg, lang, unit), { s: t("qty.s"), m: t("qty.m") }))} reason={shortReason(renderReason(localizeReason(tg.reason, unit, lang), lang))} />
                )}
                <InlineStatus kind={tg.status === "rejected" ? "warn" : tg.status === "proposed" ? "info" : "success"} text={t(`finish.status.${tg.status}` as never)} />
                {notices[tg.id] ? <AppText style={{ fontWeight: "600" }}>{notices[tg.id]}</AppText> : null}

                {isEditing && editing ? (
                  <View style={{ gap: space.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                      <IconButton icon="minus" label={`${t("finish.edit")} −`} onPress={() => setEditing({ ...editing, load: stepLoad(spec, editing.load, -1, (info?.setup as "free") ?? "free", unit).load })} />
                      <AppText ltr style={{ flex: 1, textAlign: "center", fontSize: ty.load, fontWeight: "600" }}>{weightText(editing.load, unit)} {unitText}</AppText>
                      <IconButton icon="plus" label={`${t("finish.edit")} +`} onPress={() => setEditing({ ...editing, load: stepLoad(spec, editing.load, 1, (info?.setup as "free") ?? "free", unit).load })} />
                    </View>
                    <BigButton
                      label={t("finish.editSave")}
                      onPress={() =>
                        act(async () => {
                          if (!info) return;
                          await finish.editTargetLoad(tg.id, editing.load, next.gym, info.equipment, info.setup as "free");
                          setEditing(null);
                        })
                      }
                    />
                    <BigButton variant="secondary" label={t("finish.cancel")} onPress={() => setEditing(null)} />
                  </View>
                ) : (
                  <View style={{ gap: space.sm }}>
                    {tg.currency !== "none" && tg.load !== null ? (
                      <>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                          <View style={{ flexGrow: 1, flexBasis: 150 }}>
                            <BigButton
                              icon={tg.status === "accepted" ? "check" : undefined}
                              label={t("finish.accept")}
                              disabled={tg.status === "accepted"}
                              onPress={() => {
                                // A load jump of more than 10% over last time is confirmed first, with smaller steps on offer.
                                const prev = Number(tg.reason.params.prevLoad);
                                const lastReps = Number(tg.reason.params.lastReps);
                                const micro = Number.isFinite(prev) ? (spec ? nextLoadAbove(spec, prev, false) : prev + 1.25) : null;
                                const check = isTimed(tg.measure) ? null : checkJump({ prevLoad: Number.isFinite(prev) ? prev : null, prevReps: Number.isFinite(lastReps) ? lastReps : null, targetLoad: tg.effectiveLoad, targetReps: tg.reps, setup: info?.setup ?? "free", thresholdPct: threshold, microLoad: micro });
                                if (check?.needsConfirm) return setJumpFor({ targetId: tg.id, check, prev });
                                void act(() => finish.acceptTarget(tg.id));
                              }}
                            />
                          </View>
                          <View style={{ flexGrow: 1, flexBasis: 150 }}>
                            <BigButton variant="secondary" icon="edit" label={t("finish.edit")} onPress={() => setEditing({ targetId: tg.id, load: tg.effectiveLoad ?? tg.load ?? 0 })} />
                          </View>
                        </View>
                        {jumpFor?.targetId === tg.id && tg.effectiveLoad !== null ? (
                          <View accessibilityLiveRegion="polite" style={{ gap: space.sm }}>
                            <Notice kind="warn">{t("jump.title", { pct: jumpFor.check.pct, prev: formatLoad(jumpFor.prev, lang, unit), next: formatLoad(tg.effectiveLoad, lang, unit) })}</Notice>
                            {jumpOptions(jumpFor.check, { load: tg.effectiveLoad, reps: tg.reps ?? 1 }, (k, params) => t(k, params), (kg) => formatLoad(kg, lang, unit)).map((o) => (
                              <BigButton
                                key={o.kind}
                                label={o.label}
                                variant={o.kind === "anyway" ? "primary" : "secondary"}
                                onPress={() => {
                                  setJumpFor(null);
                                  void act(async () => {
                                    if (o.kind === "anyway") return finish.acceptTarget(tg.id);
                                    if (!info) return;
                                    await finish.editTargetLoad(tg.id, o.load, next.gym, info.equipment, info.setup as "free", o.reps);
                                  });
                                }}
                              />
                            ))}
                            <BigButton variant="quiet" label={t("finish.cancel")} onPress={() => setJumpFor(null)} />
                          </View>
                        ) : null}
                      </>
                    ) : null}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                      <BigButton variant="quiet" icon="why" label={t("finish.why")} onPress={() => navigation.navigate("Why", { targetId: tg.id })} />
                      {tg.currency !== "none" && tg.load !== null ? (
                        <BigButton
                          variant="quiet"
                          label={t("finish.reject")}
                          disabled={tg.status === "rejected"}
                          onPress={() =>
                            act(async () => {
                              const o = await finish.rejectTarget(tg.id);
                              if (!o) return;
                              const jump = jumpKindText(o.jumpKind, unit, t as never);
                              setNotices((n) => ({ ...n, [tg.id]: o.blocked ? t("stop.notice.stopped", { jump, count: o.count }) : t("stop.notice.counting", { jump, count: o.count, max: o.max }) }));
                            })
                          }
                        />
                      ) : null}
                    </View>
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      {/* 3. Sharing is optional and secondary. */}
      <View style={{ gap: space.sm }}>
        <BigButton variant="secondary" icon="export" label={sharing ? t("card.sharing") : t("card.share")} disabled={sharing} onPress={shareCard} />
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
        ) : (
          <>
            <BigButton variant="secondary" icon="export" label={t("link.share")} onPress={() => setAskLink(true)} />
            {notices.link ? <AppText style={{ color: p.muted }}>{notices.link}</AppText> : null}
          </>
        )}
      </View>
      <HealthNote />
    </Screen>
  );
}
