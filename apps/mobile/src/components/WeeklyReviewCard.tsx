import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { WeeklyChange } from "@gain/engine";
import { useServices } from "../AppContext";
import { ReviewDateInvalid, type StoredReview } from "../db/weeklyRepo";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { space, usePalette } from "../theme";
import { DateSelect } from "./DateSelect";
import { AppText, BigButton, Card, InlineStatus } from "../ui";

export const changeText = (c: WeeklyChange, t: (k: StringKey, p?: Record<string, string | number>) => string): string =>
  c.kind === "move_date" ? t("weekly.change.move_date", { date: c.newDate }) : t(`weekly.change.${c.kind}` as StringKey);

/** The weekly review on Today: what the logs show, one proposed change, and three taps (do it / another date / skip). Never edits without a tap. */
export function WeeklyReviewCard() {
  const { weekly } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [due, setDue] = useState<StoredReview | null>(null);
  const [asking, setAsking] = useState(false);
  const [dateText, setDateText] = useState("");
  const [bad, setBad] = useState(false);
  const [note, setNote] = useState<StringKey | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      weekly.getDue(Date.now(), -new Date().getTimezoneOffset() * 60_000).then((d) => alive && setDue(d)).catch(() => alive && setDue(null));
      return () => {
        alive = false;
      };
    }, [weekly]),
  );

  if (!due) return note ? <Card><AppText style={{ color: p.muted }}>{t(note)}</AppText></Card> : null;
  const { review } = due;
  const c = review.change;
  const o = review.observed;
  const done = async (fn: () => Promise<void>) => {
    await fn();
    setNote(c.kind === "extra_exposure" || c.kind === "variation" || c.kind === "easier_week" ? (`weekly.apply.${c.kind}` as StringKey) : null);
    setDue(null);
  };

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
          <BigButton label={c.kind === "keep" || c.kind === "new_goal" ? t("weekly.acceptNote") : t("weekly.accept")} onPress={() => void done(() => weekly.accept(due.id))} />
          {c.kind === "move_date" ? <BigButton variant="secondary" label={t("weekly.editDate")} onPress={() => setAsking(true)} /> : null}
          <BigButton variant="quiet" label={t("weekly.skip")} onPress={() => void done(() => weekly.skip(due.id))} />
        </View>
      )}
      {note ? <AppText style={{ color: p.muted }}>{t(note)}</AppText> : null}
    </Card>
  );
}
