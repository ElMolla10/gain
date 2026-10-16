import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { RANKABLE_MUSCLES, parseMusclePriorities, serializeMusclePriorities, type MusclePriorities, type MuscleRank } from "../logic/musclePriority";
import { space, usePalette } from "../theme";
import { AppText, Chip, Screen } from "../ui";

const RANKS: MuscleRank[] = ["priority", "normal", "maintenance", "reduced"];

export function MusclePriorityScreen() {
  const { repos } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [priorities, setPriorities] = useState<MusclePriorities>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void repos.getSetting("muscle_priorities").then((raw) => alive && setPriorities(parseMusclePriorities(raw)));
      return () => {
        alive = false;
      };
    }, [repos]),
  );

  function setRank(group: (typeof RANKABLE_MUSCLES)[number], rank: MuscleRank) {
    const next = { ...priorities, [group]: rank };
    setPriorities(next);
    void repos.setSetting("muscle_priorities", serializeMusclePriorities(next));
  }

  return (
    <Screen>
      <AppText style={{ color: p.muted }}>{t("coach.priority.note")}</AppText>
      {RANKABLE_MUSCLES.map((g) => (
        <View key={g} style={{ gap: space.xs }}>
          <AppText style={{ fontWeight: "600" }}>{t(`muscle.${g}` as StringKey)}</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {RANKS.map((r) => (
              <Chip key={r} label={t(`coach.rank.${r}` as StringKey)} selected={(priorities[g] ?? "normal") === r} onPress={() => setRank(g, r)} />
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}
