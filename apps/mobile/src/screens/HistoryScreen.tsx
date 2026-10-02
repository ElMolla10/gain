import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import type { LiftItem, SessionListItem } from "../db/historyRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { localDateText } from "../logic/trendChart";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip } from "../ui";

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

      {mode === "sessions" ? (
        <>
          {sessions.length === 0 ? <AppText>{t("history.empty")}</AppText> : null}
          {sessions.map((s) => (
            <Card key={s.id}>
              <AppText ltr style={{ fontWeight: "700" }}>{localDateText(s.finishedAt)}</AppText>
              <AppText style={{ fontSize: 18, fontWeight: "800" }}>{s.imported ? t("history.imported") : s.dayName}</AppText>
              <AppText style={{ color: p.muted }}>{t("history.sessionLine", { n: s.exercises, sets: s.workingSets })}</AppText>
              <BigButton label={t("history.session.title")} selected={false} onPress={() => nav.navigate("SessionDetail", { sessionId: s.id })} />
            </Card>
          ))}
          {sessions.length < total ? <BigButton label={t("history.more")} selected={false} onPress={() => load(sessions.length + PAGE)} /> : null}
        </>
      ) : (
        <>
          {lifts.length === 0 ? <AppText>{t("history.emptyLifts")}</AppText> : null}
          {lifts.map((l) => (
            <Card key={l.lineId}>
              <AppText style={{ fontSize: 18, fontWeight: "800" }}>{exerciseLabels(l, lang).primary}</AppText>
              <AppText style={{ color: p.muted }}>{t("history.liftLine", { gym: l.gymName, n: l.sessions })}</AppText>
              <AppText style={{ color: p.muted }}>{t(`setup.${l.setup}` as never)}{l.hasImported ? ` · ${t("history.imported")}` : ""}</AppText>
              <BigButton label={t("trend.title")} selected={false} onPress={() => nav.navigate("LiftTrend", { lineId: l.lineId })} />
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}
