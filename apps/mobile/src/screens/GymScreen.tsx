import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import type { GymSummary } from "../db/gymRepo";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { space, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card } from "../ui";

type Nav = { navigate: (name: "GymEdit", params?: { gymId?: string; copyFromId?: string }) => void };

export function GymScreen() {
  const { gyms } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const nav = useNavigation<Nav>();
  const [list, setList] = useState<GymSummary[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    gyms.listGyms().then(setList).catch(() => setList([]));
  }, [gyms]);
  useFocusEffect(load);

  async function use(id: string) {
    await gyms.setActiveGym(id);
    setMessage(t("gym.plannedUpdated"));
    load();
  }
  function remove(g: GymSummary) {
    if (g.isActive) return setMessage(t("gym.deleteBlockedActive"));
    if ((list?.length ?? 0) <= 1) return setMessage(t("gym.deleteBlockedLast"));
    Alert.alert(t("gym.delete"), g.name, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          gyms.deleteGym(g.id).then(() => {
            setMessage(t("gym.deleteDone"));
            load();
          });
        },
      },
    ]);
  }

  if (list === null) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      <AppText style={{ color: p.muted }}>{t("gym.intro")}</AppText>
      <AppText style={{ color: p.muted }}>{t("gym.history")}</AppText>
      {message ? <AppText style={{ fontWeight: "600" }}>{message}</AppText> : null}
      {list.length === 0 ? <AppText>{t("gym.empty")}</AppText> : null}
      {list.map((g) => (
        <Card key={g.id}>
          <AppText style={{ fontSize: 20, fontWeight: "800" }}>{g.name}</AppText>
          {g.isActive ? <AppText style={{ color: p.accent, fontWeight: "700" }}>✓ {t("gym.active")}</AppText> : null}
          {g.isSample ? <AppText style={{ color: p.muted }}>{t("gym.sampleTag")}</AppText> : null}
          <AppText style={{ color: p.muted }}>{t("gym.equipmentList", { list: g.equipment.map((e) => t(`equipment.${e}` as StringKey)).join("، ") })}</AppText>
          <AppText style={{ color: p.muted }}>{t("gym.sessions", { n: g.finishedSessions })}</AppText>
          <View style={{ gap: space.sm }}>
            {g.isActive ? null : <BigButton label={t("gym.use")} onPress={() => void use(g.id)} />}
            <BigButton label={t("gym.edit")} selected={false} onPress={() => nav.navigate("GymEdit", { gymId: g.id })} />
            <BigButton label={t("gym.copy")} selected={false} onPress={() => nav.navigate("GymEdit", { copyFromId: g.id })} />
            <BigButton label={t("gym.delete")} selected={false} onPress={() => remove(g)} />
          </View>
        </Card>
      ))}
      <BigButton label={t("gym.add")} onPress={() => nav.navigate("GymEdit")} />
      <ArDraftNote />
    </ScrollView>
  );
}
