import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import type { LiftItem, SessionListItem } from "../db/historyRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { localDateText } from "../logic/trendChart";
import { sessionMinutes } from "../logic/historyRows";
import { MIN_TOUCH, space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Chip } from "../ui";

const PAGE = 30;

/** Past workouts and one trend per lift. Reads finished sessions only; imported ones are labelled. */
export function HistoryScreen() {
  const { history } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (n: string, params: object) => void }>();
  const [mode, setMode] = useState<"sessions" | "lifts">("sessions");
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [lifts, setLifts] = useState<LiftItem[]>([]);

  const load = useCallback(
    async (keep: number) => {
      setSessions(await history.listSessions(Math.max(PAGE, keep), 0));
      setTotal(await history.countSessions());
      setLifts(await history.listLifts());
    },
    [history],
  );
  useFocusEffect(
    useCallback(() => {
      void load(sessions?.length ?? PAGE);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  if (!sessions) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Chip label={t("history.sessions")} selected={mode === "sessions"} onPress={() => setMode("sessions")} />
        <Chip label={t("history.lifts")} selected={mode === "lifts"} onPress={() => setMode("lifts")} />
      </View>

      <Pressable accessibilityRole="button" onPress={() => nav.navigate("DecisionLog", {})} style={{ minHeight: MIN_TOUCH, justifyContent: "center" }}>
        <AppText style={{ color: p.accent, fontWeight: "600", fontSize: ty.secondary }}>{t("dec.entry")}</AppText>
      </Pressable>

      {mode === "sessions" ? (
        <View>
          {sessions.length === 0 ? <AppText>{t("history.empty")}</AppText> : null}
          {sessions.map((s) => {
            const min = sessionMinutes(s.startedAt, s.finishedAt, s.imported);
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                onPress={() => nav.navigate("SessionDetail", { sessionId: s.id })}
                style={{ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, borderBottomWidth: 1, borderColor: p.edge, paddingVertical: space.sm }}
              >
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontSize: ty.body, fontWeight: "700" }}>{s.imported ? t("history.imported") : s.dayName}</AppText>
                  <AppText ltr style={{ fontSize: ty.secondary, color: p.muted }}>{localDateText(s.finishedAt)}</AppText>
                </View>
                <AppText style={{ fontSize: ty.secondary, color: p.muted }}>
                  {min !== null ? t("history.rowLine", { min, sets: s.workingSets }) : t("history.rowLineNoTime", { sets: s.workingSets })}
                </AppText>
              </Pressable>
            );
          })}
          {sessions.length < total ? <BigButton label={t("history.more")} selected={false} onPress={() => load(sessions.length + PAGE)} /> : null}
        </View>
      ) : (
        <View>
          {lifts.length === 0 ? <AppText>{t("history.emptyLifts")}</AppText> : null}
          {lifts.map((l) => (
            <Pressable
              key={l.lineId}
              accessibilityRole="button"
              onPress={() => nav.navigate("LiftTrend", { lineId: l.lineId })}
              style={{ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, borderBottomWidth: 1, borderColor: p.edge, paddingVertical: space.sm }}
            >
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: ty.body, fontWeight: "700" }}>{exerciseLabels(l, lang).primary}</AppText>
                <AppText style={{ fontSize: ty.secondary, color: p.muted }}>{t(`setup.${l.setup}` as never)}{l.hasImported ? ` · ${t("history.imported")}` : ""}</AppText>
              </View>
              <AppText style={{ fontSize: ty.secondary, color: p.muted }}>{t("history.liftLine", { n: l.sessions })}</AppText>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
