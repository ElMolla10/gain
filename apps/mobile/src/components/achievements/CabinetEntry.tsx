import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useServices } from "../../AppContext";
import { diagnostics } from "../../diagnostics";
import { useI18n } from "../../i18n";
import { medalCount } from "../../logic/achievementShowcase";
import { radius, space, type as ty, usePalette } from "../../theme";
import { Card, ListRow, AppText } from "../../ui";
import { Icon } from "../Icon";

const BADGE = 40;

/**
 * Progress tab, first thing under the title: the way into the Trophy Cabinet ("3 of 17 medals") and the Lifter's Ledger.
 * Reads only listCabinet() (one table read); the row is drawn straight away and the count fills in, so nothing jumps.
 */
export function CabinetEntry() {
  const { achievements } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (n: string, params: object) => void }>();
  const [medals, setMedals] = useState<{ earned: number; total: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      achievements
        .listCabinet()
        .then((items) => {
          if (alive) setMedals(medalCount(items));
        })
        .catch((e) => diagnostics.record("warn", "cabinet entry", e));
      return () => {
        alive = false;
      };
    }, [achievements]),
  );

  const title = t("achv.cabinet.open");
  const note = medals ? t("achv.r2.cabinet.count", { earned: medals.earned, total: medals.total }) : null;
  return (
    <Card style={{ paddingVertical: space.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={note ? `${title}, ${note}` : title}
        onPress={() => nav.navigate("Achievements", {})}
        style={({ pressed }) => [
          { minHeight: 64, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: p.border },
          pressed ? { backgroundColor: p.raised } : null,
        ]}
      >
        <View style={{ width: BADGE, height: BADGE, borderRadius: radius.pill, backgroundColor: p.tint, alignItems: "center", justifyContent: "center" }}>
          <Icon name="trophy" color={p.accent} size={24} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontSize: ty.section, fontWeight: "600" }}>{title}</AppText>
          {note ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{note}</AppText> : null}
        </View>
        <Icon name="chevron" color={p.muted} size={20} mirror />
      </Pressable>
      <ListRow title={t("achv.ledger.open")} last onPress={() => nav.navigate("Ledger", {})} />
    </Card>
  );
}
