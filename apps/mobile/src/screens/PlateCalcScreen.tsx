import { useFocusEffect } from "@react-navigation/native";
import { findSpec } from "@gain/engine";
import React, { useCallback, useState } from "react";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { usePalette } from "../theme";
import { AppText, LoadingState, Screen } from "../ui";
import { BarbellPlateStudio } from "../components/BarbellPlateStudio";

export function PlateCalcScreen() {
  const { repos } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [spec, setSpec] = useState<ReturnType<typeof findSpec> | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const id = await repos.getActiveGymId();
        const gym = id ? await repos.loadGymFingerprint(id) : null;
        setSpec(gym ? findSpec(gym, "barbell") : null);
      })();
    }, [repos]),
  );

  if (spec === undefined) return <LoadingState />;

  return (
    <Screen>
      {spec ? (
        <BarbellPlateStudio spec={spec} />
      ) : (
        <AppText style={{ color: p.muted }}>{t("plates.none")}</AppText>
      )}
    </Screen>
  );
}
