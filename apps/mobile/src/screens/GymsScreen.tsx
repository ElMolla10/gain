import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import type { GymSummary } from "../db/gymRepo";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, InlineStatus, LoadingState, Screen } from "../ui";

type Nav = { navigate: (name: "GymEdit" | "PlateCalc", params?: { gymId?: string }) => void };

export function GymsScreen() {
  const { gyms } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const nav = useNavigation<Nav>();
  const [list, setList] = useState<GymSummary[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    void gyms.listGyms().then(setList);
  }, [gyms]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!list) return <LoadingState />;

  return (
    <Screen title={t("gyms.title")}>
      <AppText style={{ color: p.muted }}>{t("gyms.entryNote")}</AppText>
      {list.map((g) => (
        <Card key={g.id}>
          <AppText style={{ fontWeight: "600" }}>{g.name}{g.isActive ? ` · ${t("gyms.active")}` : ""}</AppText>
          <AppText style={{ color: p.muted, fontSize: ty.label }}>{g.equipment.join(" · ")}</AppText>
          <View style={{ gap: space.sm }}>
            {g.isActive ? null : <BigButton label={t("gyms.use")} onPress={() => void gyms.setActiveGym(g.id).then(() => { setNote(null); load(); })} />}
            <BigButton variant="secondary" label={t("gyms.edit")} onPress={() => nav.navigate("GymEdit", { gymId: g.id })} />
          </View>
        </Card>
      ))}
      {note ? <InlineStatus kind="error" text={note} /> : null}
      <BigButton label={t("gyms.add")} onPress={() => nav.navigate("GymEdit")} />
      <BigButton variant="secondary" label={t("plates.entry")} onPress={() => nav.navigate("PlateCalc")} />
    </Screen>
  );
}
