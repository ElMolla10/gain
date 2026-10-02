import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import { estimateMinutes, exerciseLabels, isolateLtr } from "../i18n/format";
import { useI18n } from "../i18n";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";

type DayExercises = Awaited<ReturnType<ReturnType<typeof useServices>["repos"]["listDayExercises"]>>;
interface TodayData {
  dayId: string;
  programmeName: string;
  dayName: string;
  exercises: DayExercises;
}

export function TodayScreen() {
  const { repos } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const navigation = useNavigation<{ navigate: (name: "Workout", params: { dayId: string }) => void }>();
  const [data, setData] = useState<TodayData | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const next = await repos.getNextDay();
        if (!next) return alive && setData(null);
        const exercises = await repos.listDayExercises(next.day.id);
        if (alive) setData({ dayId: next.day.id, programmeName: next.programmeName, dayName: next.day.name, exercises });
      })().catch(() => alive && setData(null));
      return () => {
        alive = false;
      };
    }, [repos]),
  );

  if (data === undefined) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  if (data === null) return <AppText style={{ padding: space.lg }}>{t("today.empty")}</AppText>;

  const totalSets = data.exercises.reduce((n, e) => n + e.sets, 0);
  const goalLifts = data.exercises.filter((e) => e.isGoalLift);

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <Card>
        <AppText style={{ color: p.muted }}>{t("today.next")}</AppText>
        <AppText style={{ fontSize: 30, fontWeight: "800" }}>{data.dayName}</AppText>
        <AppText style={{ color: p.muted }}>{data.programmeName}</AppText>
        <AppText>
          {t("today.exercises", { n: data.exercises.length })} · {t("today.sets", { n: totalSets })}
        </AppText>
        <AppText style={{ color: p.muted }}>{t("today.estimate", { min: estimateMinutes(totalSets) })}</AppText>
      </Card>

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("today.goalLifts")}</AppText>
        {goalLifts.length === 0 ? (
          <AppText style={{ color: p.muted }}>{t("today.noGoalLifts")}</AppText>
        ) : (
          goalLifts.map((e) => <AppText key={e.id}>{exerciseLabels(e, lang).primary}</AppText>)
        )}
        <AppText style={{ color: p.muted }}>{t("today.pace")}</AppText>
      </Card>

      <Card>
        {data.exercises.map((e) => {
          const l = exerciseLabels(e, lang);
          return (
            <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md, paddingVertical: space.xs }}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: "600" }}>{l.primary}</AppText>
                <AppText style={{ color: p.muted, fontSize: 13 }}>
                  {l.secondary}
                  {e.isGoalLift ? ` · ${t("today.goalTag")}` : ""}
                </AppText>
              </View>
              <AppText ltr style={{ fontWeight: "700" }}>
                {isolateLtr(`${e.sets} × ${e.repMin}-${e.repMax}`)}
              </AppText>
            </View>
          );
        })}
      </Card>

      <BigButton label={t("today.start")} onPress={() => navigation.navigate("Workout", { dayId: data.dayId })} />
      <AppText style={{ color: p.muted, fontSize: 13 }}>{t("today.sampleNote")}</AppText>
    </ScrollView>
  );
}
