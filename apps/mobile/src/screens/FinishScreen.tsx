import { isTimed, quantityText, targetPhrase, targetQuantity } from "../logic/quantity";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useNavigation, useRoute } from "@react-navigation/native";
import { findSpec, nextLoadAbove, renderReason, type GymFingerprint } from "@gain/engine";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Share, View } from "react-native";
import { useServices } from "../AppContext";
import type { SessionSummary, TargetRow } from "../db/finishRepo";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { useI18n } from "../i18n";
import { stepLoad } from "../logic/draft";
import { buildCardModel, cardHtml, cardPaceLine, toCoachPayload } from "../logic/coachCard";
import { jumpKindText } from "../logic/jumpText";
import type { StringKey } from "../i18n/strings";
import { localizeReason, weightText } from "../logic/units";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";
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
      <View style={{ padding: space.lg, gap: space.md }}>
        <AppText style={{ fontSize: 20, fontWeight: "700" }}>{t("finish.error.title")}</AppText>
        <BigButton
          label={t("finish.error.retry")}
          onPress={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      </View>
    );
  }
  if (!summary || next === null) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;

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

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      <AppText style={{ fontSize: 28, fontWeight: "800" }}>{t("finish.title")}</AppText>
      <AppText style={{ color: p.muted }}>✓ {t("finish.saved")}</AppText>

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("finish.counted")}</AppText>
        <AppText>{t("finish.countedLine", { n: summary.totals.counted })}</AppText>
        {summary.totals.warmups + summary.totals.unconfirmed > 0 ? (
          <AppText style={{ color: p.muted }}>{t("finish.excludedNote", { warmups: summary.totals.warmups, unconfirmed: summary.totals.unconfirmed })}</AppText>
        ) : null}
        <AppText style={{ fontWeight: "700", marginTop: space.sm }}>{t("finish.records")}</AppText>
        {summary.exercises.flatMap((e) => {
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
          return lines.map((l) => <AppText key={`${e.exerciseId}-${l}`}>{l}</AppText>);
        })}
        {summary.totals.records === 0 && !summary.exercises.some((e) => e.firstTime) ? <AppText>{t("finish.noRecords")}</AppText> : null}
      </Card>

      {next === "none" ? (
        <Card><AppText>{t("finish.noNext")}</AppText></Card>
      ) : (
        <>
          <AppText style={{ fontSize: 20, fontWeight: "800" }}>{t("finish.next", { day: next.dayName })}</AppText>
          <AppText style={{ color: p.muted }}>{t("finish.nextHint")}</AppText>
          {error ? <AppText style={{ color: p.danger }}>{error}</AppText> : null}
          {next.targets.map((tg) => {
            const info = next.equipment[tg.exerciseId];
            const spec = info ? findSpec(next.gym, info.equipment) : null;
            const isEditing = editing?.targetId === tg.id;
            return (
              <Card key={tg.id}>
                <AppText style={{ fontSize: 20, fontWeight: "800" }}>{lang === "ar" ? tg.nameAr : tg.nameEn}</AppText>
                {tg.currency === "none" || tg.effectiveLoad === null && tg.status !== "rejected" ? (
                  <AppText>{t("finish.noTarget")}</AppText>
                ) : tg.status === "rejected" ? (
                  <AppText>{t("finish.rejectedNote")}</AppText>
                ) : (
                  <AppText style={{ fontSize: 20, fontWeight: "800" }}>
                    {isTimed(tg.measure)
                      ? isolateLtr(targetPhrase(tg.effectiveLoad ?? 0, targetQuantity(tg, tg.measure) ?? 0, tg.measure, (kg) => formatLoad(kg, lang, unit), { s: t("qty.s"), m: t("qty.m") }))
                      : <>{formatLoad(tg.effectiveLoad ?? 0, lang, unit)} × {isolateLtr(String(tg.reps ?? ""))}</>}
                  </AppText>
                )}
                <AppText style={{ color: p.muted }}>{renderReason(localizeReason(tg.reason, unit, lang), lang)}</AppText>
                <AppText style={{ color: p.muted }}>{t(`finish.status.${tg.status}` as never)}</AppText>
                {notices[tg.id] ? <AppText style={{ fontWeight: "700" }}>{notices[tg.id]}</AppText> : null}

                {isEditing && editing ? (
                  <View style={{ gap: space.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                      <View style={{ width: 72 }}>
                        <BigButton label="−" selected={false} onPress={() => setEditing({ ...editing, load: stepLoad(spec, editing.load, -1, (info?.setup as "free") ?? "free", unit).load })} />
                      </View>
                      <AppText ltr style={{ flex: 1, textAlign: "center", fontSize: 32, fontWeight: "800" }}>{weightText(editing.load, unit)} {unitText}</AppText>
                      <View style={{ width: 72 }}>
                        <BigButton label="+" selected={false} onPress={() => setEditing({ ...editing, load: stepLoad(spec, editing.load, 1, (info?.setup as "free") ?? "free", unit).load })} />
                      </View>
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
                    <BigButton label={t("finish.cancel")} selected={false} onPress={() => setEditing(null)} />
                  </View>
                ) : (
                  <View style={{ gap: space.sm }}>
                    {tg.currency !== "none" && tg.load !== null ? (
                      <>
                        <BigButton
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
                        {jumpFor?.targetId === tg.id && tg.effectiveLoad !== null ? (
                          <View accessibilityLiveRegion="polite" style={{ gap: space.sm }}>
                            <AppText style={{ fontWeight: "700", color: p.warn }}>{t("jump.title", { pct: jumpFor.check.pct, prev: formatLoad(jumpFor.prev, lang, unit), next: formatLoad(tg.effectiveLoad, lang, unit) })}</AppText>
                            {jumpOptions(jumpFor.check, { load: tg.effectiveLoad, reps: tg.reps ?? 1 }, (k, params) => t(k, params), (kg) => formatLoad(kg, lang, unit)).map((o) => (
                              <BigButton
                                key={o.kind}
                                label={o.label}
                                selected={o.kind === "anyway"}
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
                            <BigButton label={t("finish.cancel")} selected={false} onPress={() => setJumpFor(null)} />
                          </View>
                        ) : null}
                        <BigButton label={t("finish.edit")} selected={false} onPress={() => setEditing({ targetId: tg.id, load: tg.effectiveLoad ?? tg.load ?? 0 })} />
                        <BigButton label={t("finish.reject")} selected={false} disabled={tg.status === "rejected"} onPress={() =>
                          act(async () => {
                            const o = await finish.rejectTarget(tg.id);
                            if (!o) return;
                            const jump = jumpKindText(o.jumpKind, unit, t as never);
                            setNotices((n) => ({ ...n, [tg.id]: o.blocked ? t("stop.notice.stopped", { jump, count: o.count }) : t("stop.notice.counting", { jump, count: o.count, max: o.max }) }));
                          })
                        }
                      />
                      </>
                    ) : null}
                    <BigButton label={t("finish.why")} selected={false} onPress={() => navigation.navigate("Why", { targetId: tg.id })} />
                  </View>
                )}
              </Card>
            );
          })}
        </>
      )}
      <BigButton label={sharing ? t("card.sharing") : t("card.share")} selected={false} disabled={sharing} onPress={shareCard} />
      {askLink ? (
        <Card>
          <AppText style={{ fontWeight: "700" }} accessibilityRole="header">{t("link.consent.title")}</AppText>
          <AppText>{t("link.consent.body")}</AppText>
          <BigButton label={linking ? t("link.sharing") : t("link.consent.ok")} disabled={linking} onPress={shareLink} />
          <BigButton label={t("link.consent.cancel")} selected={false} disabled={linking} onPress={() => setAskLink(false)} />
        </Card>
      ) : link ? (
        <Card>
          <AppText style={{ fontWeight: "700" }}>✓ {t("link.ready")}</AppText>
          <BigButton label={t("link.again")} selected={false} onPress={() => void Share.share({ message: t("link.message", { url: link.url }) })} />
          <BigButton label={t("link.stop")} selected={false} onPress={stopLink} />
        </Card>
      ) : (
        <>
          <BigButton label={t("link.share")} selected={false} onPress={() => setAskLink(true)} />
          {notices.link ? <AppText style={{ color: p.muted }}>{notices.link}</AppText> : null}
        </>
      )}
      <BigButton label={t("finish.done")} onPress={() => navigation.popToTop()} />
      <HealthNote />
    </ScrollView>
  );
}
