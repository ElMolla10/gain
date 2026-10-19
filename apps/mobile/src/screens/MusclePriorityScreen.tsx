import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import {
  parseMusclePriorities,
  serializeMusclePriorities,
  type MusclePriorities,
  type MuscleRank,
  type RANKABLE_MUSCLES,
} from "../logic/musclePriority";
import { usePalette } from "../theme";
import { AppText, Screen } from "../ui";
import { MusclePriorityGrid } from "../components/coach/MusclePriorityGrid";

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
      <MusclePriorityGrid priorities={priorities} onSetRank={setRank} />
    </Screen>
  );
}
