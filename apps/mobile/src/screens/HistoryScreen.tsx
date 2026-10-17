import { EvidenceAchievementsCard } from "../components/EvidenceAchievementsCard";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useDeveloperMode } from "../DeveloperMode";
import { useServices } from "../AppContext";
import { telemetry } from "../achievementTelemetry";
import { createHistoryLoader, EMPTY_HISTORY_LOAD } from "../logic/historyLoad";
import { diagnostics } from "../diagnostics";
import { useI18n } from "../i18n";
import { exerciseLabels, formatLoad, isolateLtr, NBSP } from "../i18n/format";
import { formatDay } from "../logic/dateText";
import { sessionMinutes } from "../logic/historyRows";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, EmptyState, ErrorState, InlineStatus, ListRow, LoadingState, Screen, SegmentedTabs } from "../ui";

const PAGE = 30;

/** Past workouts and one trend per lift. Reads finished sessions only; imported ones are labelled. */
export function HistoryScreen() {
  const { history } = useServices();
  const { enabled: developerMode } = useDeveloperMode();
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (n: string, params: object) => void }>();
  const [mode, setMode] = useState<"sessions" | "lifts">("sessions");
  const [state, setState] = useState(EMPTY_HISTORY_LOAD);
  const [asked, setAsked] = useState(() => telemetry.hasAsked());
  const loader = useMemo(() => createHistoryLoader(history, setState, e => diagnostics.record("warn", "load history", e)), [history]);
  useFocusEffect(useCallback(() => {
    telemetry.record("progress_opened");
    void loader.load();
    return loader.cancel;
  }, [loader]));
  if (!state.data) return state.failed ? <ErrorState title={t("history.error.title")} body={t("history.error.body")} retryLabel={t("history.error.retry")} onRetry={() => void loader.load()} /> : <LoadingState />;
  const { sessions, total, lifts } = state.data;
  return (
    <Screen tab title={t("history.title")}>
      {/* Real tabs (H-7): a segmented tablist, and the list starts right under it. */}
      <SegmentedTabs value={mode} options={[{ value: "sessions", label: t("history.sessions") }, { value: "lifts", label: t("history.lifts") }]} onChange={setMode} />

      {developerMode && (!asked ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("telemetry.optin.title")}</AppText>
          <AppText>{t("telemetry.optin.body")}</AppText>
          <BigButton label={t("telemetry.optin.allow")} onPress={() => { telemetry.setOptedIn(true); setAsked(true); telemetry.record("progress_opened"); }} />
          <BigButton variant="secondary" label={t("telemetry.optin.deny")} onPress={() => { telemetry.setOptedIn(false); setAsked(true); }} />
        </Card>
      ) : null)}

      {state.failed ? <View accessibilityLiveRegion="polite">
        <InlineStatus kind="error" text={t("history.error.body")} />
        <BigButton variant="secondary" label={t("history.error.retry")} disabled={state.loading} onPress={() => void loader.load()} />
      </View> : null}

      {mode === "sessions" ? (
        sessions.length === 0 ? (
          <EmptyState icon="progress" title={t("history.empty")} actionLabel={t("history.emptyAction")} onAction={() => nav.navigate("Today", {})} />
        ) : (
          <View style={{ gap: space.md }}>
            <Card style={{ paddingVertical: space.xs }}>
              {sessions.map((s, i) => {
                const min = sessionMinutes(s.startedAt, s.finishedAt, s.imported, s.pausedMs);
                const line = min !== null ? t("history.rowLine", { min, sets: s.workingSets }) : t("history.rowLineNoTime", { sets: s.workingSets });
                const title = s.imported ? t("history.imported") : s.dayName;
                const note = `${formatDay(s.finishedAt, lang)} · ${line}`;
                return (
                  <ListRow
                    key={s.id}
                    title={title}
                    note={note}
                    accessibilityLabel={s.pr ? `${title}, ${note}, ${t("history.prLabel")}` : undefined}
                    trailingIcon={s.pr ? <PrPill label={t("history.prPill")} /> : undefined}
                    last={i === sessions.length - 1}
                    onPress={() => nav.navigate("SessionDetail", { sessionId: s.id })}
                  />
                );
              })}
            </Card>
            {sessions.length < total ? <BigButton variant="secondary" label={t("history.more")} disabled={state.loading} onPress={() => void loader.load(sessions.length + PAGE)} /> : null}
          </View>
        )
      ) : lifts.length === 0 ? (
        <EmptyState icon="progress" title={t("history.emptyLifts")} body={t("history.empty")} />
      ) : (
        <Card style={{ paddingVertical: space.xs }}>
          {lifts.map((l, i) => {
            // H-3: the number first. Sessions count, with the setup only when this exercise has more than one; the latest top set and its trend at the end.
            const title = exerciseLabels(l, lang).primary;
            const note = `${(l.setups ?? 1) > 1 ? `${t(`setup.${l.setup}` as never)} · ` : ""}${t("history.liftLine", { n: l.sessions })}${l.hasImported ? ` · ${t("history.imported")}` : ""}`;
            const top = l.latest ? `${formatLoad(l.latest.load, lang, unit)}${NBSP}×${NBSP}${isolateLtr(String(l.latest.reps))}` : null;
            const glyph = l.direction === "better" ? { c: "↑", color: p.success } : l.direction === "worse" ? { c: "↓", color: p.warn } : l.direction === "flat" ? { c: "→", color: p.muted } : null;
            const trendWord = l.direction && l.direction !== "thin" ? t(`history.trend.${l.direction}` as never) : null;
            return (
              <ListRow
                key={l.lineId}
                title={title}
                note={note}
                accessibilityLabel={[title, note, top, trendWord].filter(Boolean).join(", ")}
                trailingIcon={top ? (
                  <>
                    <AppText style={{ fontSize: ty.body, fontWeight: "600", fontVariant: ["tabular-nums"], flexShrink: 1 }}>{top}</AppText>
                    {glyph ? <AppText style={{ fontSize: ty.body, fontWeight: "600", color: glyph.color }}>{glyph.c}</AppText> : null}
                  </>
                ) : undefined}
                last={i === lifts.length - 1}
                onPress={() => nav.navigate("LiftTrend", { lineId: l.lineId })}
              />
            );
          })}
        </Card>
      )}

      {/* Achievements below the list (H-8), so the list starts right under the tabs. */}
      <EvidenceAchievementsCard />

      {developerMode ? <Card style={{ paddingVertical: space.xs }}>
        <ListRow title={t("dec.entry")} last onPress={() => nav.navigate("DecisionLog", {})} />
      </Card> : null}
    </Screen>
  );
}

/** 24 dp "PR" pill on sessions that set a weight record (tint background, accent text; the row label says it in words). */
function PrPill({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View style={{ minHeight: 24, paddingHorizontal: space.sm, borderRadius: 12, backgroundColor: p.tint, justifyContent: "center" }}>
      <AppText style={{ color: p.accent, fontSize: ty.label, fontWeight: "600" }}>{label}</AppText>
    </View>
  );
}
