import { useFocusEffect } from "@react-navigation/native";
import { findSpec } from "@gain/engine";
import React, { useCallback, useState } from "react";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { parseNumber } from "../logic/gymInput";
import { plateLine } from "../logic/plateText";
import { unitToKg } from "../logic/units";
import { usePalette } from "../theme";
import { AppText, Card, Field, LoadingState, Screen } from "../ui";

export function PlateCalcScreen() {
  const { repos } = useServices();
  const { t, unit, unitText } = useI18n();
  const p = usePalette();
  const [spec, setSpec] = useState<ReturnType<typeof findSpec> | undefined>(undefined);
  const [text, setText] = useState("");

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
  const n = parseNumber(text);
  const load = n === null ? null : unitToKg(n, unit);
  const line = spec && load !== null ? plateLine(spec, load, unit, t) : null;

  return (
    <Screen title={t("plates.title")}>
      {spec ? (
        <Card>
          <Field label={t("plates.load")} value={text} onChangeText={setText} numeric hint={unitText} />
          {line ? <AppText style={{ fontWeight: "600" }}>{line.text}</AppText> : null}
        </Card>
      ) : (
        <AppText style={{ color: p.muted }}>{t("plates.none")}</AppText>
      )}
    </Screen>
  );
}
