import { PersonalProgressCard } from "../components/PersonalProgressCard";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useDeveloperMode } from "../DeveloperMode";
import { useServices } from "../AppContext";
import { createHistoryLoader, EMPTY_HISTORY_LOAD } from "../logic/historyLoad";
import { diagnostics } from "../diagnostics";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { localDateText } from "../logic/trendChart";
import { sessionMinutes } from "../logic/historyRows";
import { space } from "../theme";
import { BigButton, Card, Chip, EmptyState, ErrorState, InlineStatus, ListRow, LoadingState, Screen } from "../ui";

const PAGE = 30;

/** Past workouts and one trend per lift. Reads finished sessions only; imported ones are labelled. */
export function HistoryScreen() {
  const { history } = useServices();
  const { enabled: developerMode } = useDeveloperMode();
  const { t, lang } = useI18n();
  const nav = useNavigation<{ navigate: (n: string, params: object) => void }>();
  const [mode, setMode] = useState<"sessions" | "lifts">("sessions");
  const [state, setState] = useState(EMPTY_HISTORY_LOAD);
  const loader = useMemo(() => createHistoryLoader(history, setState, e => diagnostics.record("warn", "load history", e)), [history]);
  useFocusEffect(useCallback(() => {
    void loader.load();
    return loader.cancel;
  }, [loader]));
  if (!state.data) return state.failed ? <ErrorState title={t("history.error.title")} body={t("history.error.body")} retryLabel={t("history.error.retry")} onRetry={() => void loader.load()} /> : <LoadingState />;
  const { sessions, total, lifts } = state.data;
  return (
    <Screen tab title={t("history.title")}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Chip label={t("history.sessions")} selected={mode === "sessions"} onPress={() => setMode("sessions")} />
        <Chip label={t("history.lifts")} selected={mode === "lifts"} onPress={() => setMode("lifts")} />
      </View>

      <PersonalProgressCard />
      <BigButton variant="secondary" label={t("achievements.open")} onPress={() => nav.navigate("Achievements", {})} />
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
                return <ListRow key={s.id} title={title} note={`${localDateText(s.finishedAt)} · ${line}`} last={i === sessions.length - 1} onPress={() => nav.navigate("SessionDetail", { sessionId: s.id })} />;
              })}
            </Card>
            {sessions.length < total ? <BigButton variant="secondary" label={t("history.more")} disabled={state.loading} onPress={() => void loader.load(sessions.length + PAGE)} /> : null}
          </View>
        )
      ) : lifts.length === 0 ? (
        <EmptyState icon="progress" title={t("history.emptyLifts")} body={t("history.empty")} />
      ) : (
        <Card style={{ paddingVertical: space.xs }}>
          {lifts.map((l, i) => (
            <ListRow
              key={l.lineId}
              title={exerciseLabels(l, lang).primary}
              note={`${t(`setup.${l.setup}` as never)}${l.hasImported ? ` · ${t("history.imported")}` : ""} · ${t("history.liftLine", { n: l.sessions })}`}
              last={i === lifts.length - 1}
              onPress={() => nav.navigate("LiftTrend", { lineId: l.lineId })}
            />
          ))}
        </Card>
      )}

      {developerMode ? <Card style={{ paddingVertical: space.xs }}>
        <ListRow title={t("dec.entry")} last onPress={() => nav.navigate("DecisionLog", {})} />
      </Card> : null}
    </Screen>
  );
}
