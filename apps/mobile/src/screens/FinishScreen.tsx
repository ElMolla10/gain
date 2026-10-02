import { useNavigation, useRoute } from "@react-navigation/native";
import { findSpec, renderReason, type GymFingerprint } from "@gain/engine";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import type { SessionSummary, TargetRow } from "../db/finishRepo";
import { formatLoad, isolateLtr } from "../i18n/format";
import { useI18n } from "../i18n";
import { stepLoad } from "../logic/draft";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";

interface Next {
  sessionId: string;
  dayName: string;
  gym: GymFingerprint;
  targets: TargetRow[];
  equipment: Record<string, { equipment: Parameters<typeof findSpec>[1]; setup: "free" | "assisted" | "bodyweight" | string }>;
}

export function FinishScreen() {
  const { repos, workout, finish } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const navigation = useNavigation<{ navigate: (n: string, params?: object) => void; popToTop: () => void }>();
  const sessionId = (useRoute().params as { sessionId: string }).sessionId;
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [next, setNext] = useState<Next | null | "none">(null);
  const [editing, setEditing] = useState<{ targetId: string; load: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const reload = useCallback(
    async (n: Next) => setNext({ ...n, targets: await finish.getTargets(n.sessionId) }),
    [finish],
  );

  // Write the next session's targets as soon as this screen opens (idempotent), then show them.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setSummary(await finish.summarizeSession(sessionId));
      const written = await finish.writeNextSessionTargets(sessionId);
      if (!written) return setNext("none");
      const planned = await workout.getSession(written.sessionId);
      if (!planned) return setNext("none");
      const gym = await repos.loadGymFingerprint(planned.gym_id);
      const exs = await repos.listDayExercises(planned.programme_day_id);
      const equipment: Next["equipment"] = {};
      for (const e of exs) equipment[e.exerciseId] = { equipment: e.equipment, setup: e.setup };
      setNext({ sessionId: written.sessionId, dayName: written.dayName, gym, targets: await finish.getTargets(written.sessionId), equipment });
    })().catch(() => setNext("none"));
  }, [finish, repos, workout, sessionId]);

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
            if (r === "load" && e.top) lines.push(`${name}: ${t("finish.record.load", { load: formatLoad(e.top.load, lang) })}`);
            if (r === "reps_at_load" && e.top) lines.push(`${name}: ${t("finish.record.reps", { load: formatLoad(e.top.load, lang), reps: e.top.reps })}`);
          }
          return lines.map((l) => <AppText key={`${e.exerciseId}-${l}`}>{l}</AppText>);
        })}
        {summary.totals.records === 0 && !summary.exercises.some((e) => e.firstTime) ? <AppText>{t("finish.noRecords")}</AppText> : null}
      </Card>

      {next === "none" ? (
        <Card><AppText>{t("finish.noNext")}</AppText></Card>
      ) : (
        <>
          <AppText style={{ fontSize: 22, fontWeight: "800" }}>{t("finish.next", { day: next.dayName })}</AppText>
          <AppText style={{ color: p.muted }}>{t("finish.nextHint")}</AppText>
          {error ? <AppText style={{ color: "#b00020" }}>{error}</AppText> : null}
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
                  <AppText style={{ fontSize: 22, fontWeight: "800" }}>
                    {formatLoad(tg.effectiveLoad ?? 0, lang)} × {isolateLtr(String(tg.reps ?? ""))}
                  </AppText>
                )}
                <AppText style={{ color: p.muted }}>{renderReason(tg.reason, lang)}</AppText>
                <AppText style={{ color: p.muted }}>{t(`finish.status.${tg.status}` as never)}</AppText>

                {isEditing && editing ? (
                  <View style={{ gap: space.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                      <View style={{ width: 72 }}>
                        <BigButton label="−" selected={false} onPress={() => setEditing({ ...editing, load: stepLoad(spec, editing.load, -1, (info?.setup as "free") ?? "free").load })} />
                      </View>
                      <AppText ltr style={{ flex: 1, textAlign: "center", fontSize: 36, fontWeight: "800" }}>{editing.load}</AppText>
                      <View style={{ width: 72 }}>
                        <BigButton label="+" selected={false} onPress={() => setEditing({ ...editing, load: stepLoad(spec, editing.load, 1, (info?.setup as "free") ?? "free").load })} />
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
                        <BigButton label={t("finish.accept")} disabled={tg.status === "accepted"} onPress={() => act(() => finish.acceptTarget(tg.id))} />
                        <BigButton label={t("finish.edit")} selected={false} onPress={() => setEditing({ targetId: tg.id, load: tg.effectiveLoad ?? tg.load ?? 0 })} />
                        <BigButton label={t("finish.reject")} selected={false} disabled={tg.status === "rejected"} onPress={() => act(() => finish.rejectTarget(tg.id))} />
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
      <BigButton label={t("finish.done")} onPress={() => navigation.popToTop()} />
    </ScrollView>
  );
}
