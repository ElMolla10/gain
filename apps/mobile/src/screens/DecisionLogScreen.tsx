import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { renderReason } from "@gain/engine";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import type { DecisionLift, DecisionListItem } from "../db/decisionRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { formatDay } from "../logic/dateText";
import { localizeReason } from "../logic/units";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Chip, EmptyState, FilterPanel, LoadingState, Screen } from "../ui";
import { DecisionCard10x } from "../components/why/DecisionCard10x";

const PAGE = 40;

/** Every stored decision: what was suggested, which rule made it, what the lifter did. Opens "Why this weight?" for the inputs. */
export function DecisionLogScreen() {
  const { decisions } = useServices();
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (n: string, params: object) => void }>();
  const [filter, setFilter] = useState<string | null>(null);
  const [items, setItems] = useState<DecisionListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [lifts, setLifts] = useState<DecisionLift[]>([]);

  const load = useCallback(
    async (exerciseId: string | null, limit: number) => {
      setItems(await decisions.list({ exerciseId, limit }));
      setTotal(await decisions.count(exerciseId));
      setLifts(await decisions.lifts());
    },
    [decisions],
  );
  useFocusEffect(
    useCallback(() => {
      void load(filter, Math.max(PAGE, items?.length ?? 0));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, filter]),
  );

  if (!items) return <LoadingState />;
  return (
    <Screen>
      <AppText style={{ color: p.muted }}>{t("dec.intro")}</AppText>
      <FilterPanel title={t("pick.filters")} activeCount={filter === null ? 0 : 1} clearLabel={t("tpl.clear")} onClear={() => setFilter(null)}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Chip label={t("dec.all")} selected={filter === null} onPress={() => setFilter(null)} />
          {lifts.map((l) => (
            <Chip key={l.exerciseId} label={exerciseLabels(l, lang).primary} selected={filter === l.exerciseId} onPress={() => setFilter(l.exerciseId)} />
          ))}
        </View>
      </FilterPanel>
      {items.length === 0 ? <EmptyState icon="why" title={t("empty.noDecisions")} body={t("empty.decisionsBody")} /> : null}
      {items.map((d) => {
        let sentence: string;
        try {
          sentence = renderReason(localizeReason(d.reason, unit, lang), lang);
        } catch {
          sentence = d.reason.key;
        }
        return (
          <DecisionCard10x
            key={d.targetId}
            decision={d}
            dateFormatted={formatDay(d.decidedAt, lang)}
            sentence={sentence}
            onWhy={() => nav.navigate("Why", { targetId: d.targetId })}
          />
        );
      })}
      {items.length < total ? <BigButton label={t("dec.more")} variant="secondary" onPress={() => load(filter, items.length + PAGE)} /> : null}
    </Screen>
  );
}
