import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { WeeklyChange } from "@gain/engine";
import { useServices } from "../AppContext";
import { SessionInProgress } from "../db/programmeRepo";
import { ReviewDateInvalid, type StoredReview } from "../db/weeklyRepo";
import { isPlanKind, type ActivePlan, type PlanLine, type PlanPreview } from "../db/weeklyPlanRepo";
import { useI18n } from "../i18n";
import type { Lang } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { localDateText } from "../logic/trendChart";
import { space, usePalette } from "../theme";
import { DateSelect } from "./DateSelect";
import { AppText, BigButton, Card, Chip, InlineStatus, Sheet } from "../ui";

type T = (k: StringKey, p?: Record<string, string | number>) => string;

export const changeText = (c: WeeklyChange, t: T): string =>
  c.kind === "move_date" ? t("weekly.change.move_date", { date: c.newDate }) : t(`weekly.change.${c.kind}` as StringKey);

/** One line of a weekly program change, in the lifter's language. Loads go through `fmt` (isolated, in the lifter's unit). */
export function planLineText(l: PlanLine, t: T, lang: Lang, fmt: (kg: number) => string): string {
  if (l.kind === "add") {
    const p = { exercise: lang === "ar" ? l.nameAr : l.nameEn, day: l.dayName, scheme: `${l.sets} × ${l.reps}` };
    return l.load !== null ? t("weeklyPlan.line.add", { ...p, load: fmt(l.load) }) : t("weeklyPlan.line.addNoLoad", p);
  }
  if (l.kind === "swap") return t("weeklyPlan.line.swap", { from: lang === "ar" ? l.fromAr : l.fromEn, to: lang === "ar" ? l.toAr : l.toEn });
  return t("weeklyPlan.line.fewer_sets", { before: l.setsBefore, after: l.setsAfter });
}

const tz = () => -new Date().getTimezoneOffset() * 60_000;

/**
 * The weekly review on Today: what the logs show, one proposed change, and three taps (do it / another date / skip). Never edits without a tap.
 * A change to the program (easier week, one more exposure, variation) is shown in a preview first and only written on Apply; while it is on,
 * an Undo chip stays here until the period ends.
 */
export function WeeklyReviewCard() {
  const { weekly, weeklyPlan } = useServices();
  const { t, lang, fmt } = useI18n();
  const p = usePalette();
  const [due, setDue] = useState<StoredReview | null>(null);
  const [asking, setAsking] = useState(false);
  const [dateText, setDateText] = useState("");
  const [bad, setBad] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<PlanPreview, { kind: "apply" }> | null>(null);
  const [active, setActive] = useState<ActivePlan | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      weekly.getDue(Date.now(), tz()).then((d) => alive && setDue(d)).catch(() => alive && setDue(null));
      // The period is over: the original program comes back (unless the lifter edited it; then the chip asks).
      void weeklyPlan.endIfExpired(Date.now()).catch(() => undefined).then(() => weeklyPlan.getActive(Date.now())).then((a) => alive && setActive(a)).catch(() => alive && setActive(null));
      return () => {
        alive = false;
      };
    }, [weekly, weeklyPlan]),
  );

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNote(e instanceof SessionInProgress ? t("short.openWorkout") : String(e));
    } finally {
      setBusy(false);
    }
  };

  const conflictSheet = (
    <Sheet
      visible={conflictOpen}
      title={t("weeklyPlan.conflict.title")}
      onClose={() => setConflictOpen(false)}
      footer={
        <>
          <BigButton label={t("weeklyPlan.conflict.keep")} disabled={busy} onPress={() => void run(async () => { await weeklyPlan.resolve("keep"); setConflictOpen(false); setActive(null); })} />
          <BigButton variant="secondary" label={t("weeklyPlan.conflict.restore")} disabled={busy} onPress={() => void run(async () => { await weeklyPlan.resolve("restore"); setConflictOpen(false); setActive(null); setNote(t("weeklyPlan.undone")); })} />
        </>
      }
    >
      <AppText>{t("weeklyPlan.conflict.body")}</AppText>
    </Sheet>
  );

  if (!due) {
    if (active) {
      const waiting = active.expired && active.conflict;
      return (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("weeklyPlan.activeUntil", { date: localDateText(active.endsAt - 1) })}</AppText>
          {active.lines.map((l, i) => <AppText key={i}>{planLineText(l, t, lang, fmt)}</AppText>)}
          {waiting ? <AppText style={{ color: p.muted }}>{t("weeklyPlan.endedConflict")}</AppText> : null}
          <View style={{ flexDirection: "row" }}>
            <Chip
              label={waiting ? t("weeklyPlan.choose") : t("weeklyPlan.undo")}
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  if (waiting) return setConflictOpen(true);
                  const r = await weeklyPlan.undo();
                  if (r.conflict) return setConflictOpen(true);
                  setActive(null);
                  setNote(t("weeklyPlan.undone"));
                })
              }
            />
          </View>
          {note ? <AppText style={{ color: p.muted }}>{note}</AppText> : null}
          {conflictSheet}
        </Card>
      );
    }
    return note ? <Card><AppText style={{ color: p.muted }}>{note}</AppText></Card> : null;
  }
  const { review } = due;
  const c = review.change;
  const o = review.observed;
  const done = async (fn: () => Promise<void>) => {
    await fn();
    setNote(null);
    setDue(null);
  };
  /** A program change is never written here: the preview opens, or (when it cannot apply) the decision is only recorded and the reason shown. */
  const doIt = () =>
    void run(async () => {
      if (!isPlanKind(c.kind)) return done(() => weekly.accept(due.id));
      const pv = await weeklyPlan.preview(due.id, Date.now(), tz());
      if (pv.kind === "apply") return setPreview(pv);
      await weekly.accept(due.id);
      setDue(null);
      setNote(`${t(`weeklyPlan.record.${pv.reason}` as StringKey)} ${t(`weekly.apply.${c.kind}` as StringKey)}`);
    });
  const applyNow = () =>
    void run(async () => {
      const r = await weeklyPlan.apply(due.id, Date.now(), tz());
      setPreview(null);
      setDue(null);
      if (r.kind === "record") setNote(t(`weeklyPlan.record.${r.reason}` as StringKey));
      else setNote(null);
      setActive(await weeklyPlan.getActive(Date.now()));
    });

  return (
    <Card>
      <AppText style={{ fontWeight: "600", fontSize: 16 }}>{t("weekly.title")}</AppText>
      <AppText style={{ color: p.muted }}>{t("weekly.week", { date: review.weekStart })}</AppText>
      <AppText style={{ fontWeight: "600" }}>{t("weekly.observed")}</AppText>
      <AppText>{o.plannedSessions !== null ? t("weekly.sessions", { done: o.sessionsDone, planned: o.plannedSessions }) : t("weekly.sessionsNoPlan", { done: o.sessionsDone })}</AppText>
      {o.goalStatus ? <AppText>{t("weekly.goalStatus", { status: t(`pace.status.${o.goalStatus}` as StringKey) })}</AppText> : null}
      {review.thin ? <InlineStatus kind="info" text={t("weekly.thin")} /> : null}
      <AppText style={{ fontWeight: "600" }}>{t("weekly.proposal")}</AppText>
      <AppText style={{ fontSize: 16 }}>{changeText(c, t)}</AppText>
      <AppText style={{ color: p.muted }}>{t(`weekly.reason.${review.reason}` as StringKey)}</AppText>
      {asking ? (
        <View style={{ gap: space.sm }}>
          <DateSelect label={t("weekly.dateField")} value={dateText} onChange={(s) => { setBad(false); setDateText(s); }} years="future" span={5} />
          {bad ? <InlineStatus kind="error" text={t("weekly.dateBad")} /> : null}
          <BigButton
            label={t("weekly.dateSave")}
            onPress={() =>
              void weekly.editDate(due.id, dateText.trim()).then(
                () => setDue(null),
                (e) => (e instanceof ReviewDateInvalid ? setBad(true) : Promise.reject(e)),
              )
            }
          />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <BigButton label={c.kind === "keep" || c.kind === "new_goal" ? t("weekly.acceptNote") : t("weekly.accept")} disabled={busy} onPress={doIt} />
          {c.kind === "move_date" ? <BigButton variant="secondary" label={t("weekly.editDate")} onPress={() => setAsking(true)} /> : null}
          <BigButton variant="quiet" label={t("weekly.skip")} disabled={busy} onPress={() => void run(() => done(() => weekly.skip(due.id)))} />
        </View>
      )}
      {note ? <AppText style={{ color: p.muted }}>{note}</AppText> : null}
      <Sheet
        visible={preview !== null}
        title={t("weeklyPlan.previewTitle")}
        onClose={() => setPreview(null)}
        footer={
          <>
            <BigButton label={t("weeklyPlan.apply")} disabled={busy} onPress={applyNow} />
            <BigButton variant="quiet" label={t("weeklyPlan.cancel")} disabled={busy} onPress={() => setPreview(null)} />
          </>
        }
      >
        {preview?.lines.map((l, i) => <AppText key={i} style={{ fontSize: 16 }}>{planLineText(l, t, lang, fmt)}</AppText>)}
        <AppText style={{ color: p.muted }}>{t("weeklyPlan.previewNote")}</AppText>
      </Sheet>
    </Card>
  );
}
