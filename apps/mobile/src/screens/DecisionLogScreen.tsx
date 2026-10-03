import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { renderReason } from "@gain/engine";
import React, { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import type { DecisionLift, DecisionListItem } from "../db/decisionRepo";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { actionOf, hasNumber } from "../logic/decisionText";
import { localDateText } from "../logic/trendChart";
import { localizeReason } from "../logic/units";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip } from "../ui";

const PAGE = 40;

/** Every stored decision: what was suggested, which rule made it, what the lifter did. Opens "Why this weight?" for the inputs. */
export function DecisionLogScreen() {
  const { decisions } = useServices();
  const { t, lang, unit, fmt } = useI18n();
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

  if (!items) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      <AppText style={{ color: p.muted }}>{t("dec.intro")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Chip label={t("dec.all")} selected={filter === null} onPress={() => setFilter(null)} />
        {lifts.map((l) => (
          <Chip key={l.exerciseId} label={exerciseLabels(l, lang).primary} selected={filter === l.exerciseId} onPress={() => setFilter(l.exerciseId)} />
        ))}
      </View>
      {items.length === 0 ? <AppText>{t("dec.empty")}</AppText> : null}
      {items.map((d) => {
        const a = actionOf(d);
        let sentence: string;
        try {
          sentence = renderReason(localizeReason(d.reason, unit, lang), lang);
        } catch {
          sentence = d.reason.key;
        }
        return (
          <Card key={d.targetId}>
            <AppText ltr style={{ fontWeight: "700" }}>{localDateText(d.decidedAt)}</AppText>
            <AppText style={{ fontSize: 18, fontWeight: "800" }}>{exerciseLabels(d, lang).primary}</AppText>
            <AppText style={{ color: p.muted }}>{t("dec.for", { day: d.dayName })}</AppText>
            <AppText style={{ fontSize: 17 }}>
              {hasNumber(d) ? t("dec.target", { load: fmt(d.load!), reps: isolateLtr(String(d.reps)) }) : t("dec.noTarget")}
            </AppText>
            <AppText style={{ fontWeight: "700" }}>{t(a.key, a.editedLoad !== null ? { load: fmt(a.editedLoad) } : undefined)}</AppText>
            <AppText style={{ color: p.muted }}>{sentence}</AppText>
            <AppText style={{ color: p.muted, fontSize: 13 }}>
              {t("dec.rule", { version: d.ruleVersion, path: t(`dec.path.${d.path === "model" ? "model" : "rule"}` as StringKey) })} · {t("dec.confidence", { c: t(`why.confidence.${d.confidence}` as StringKey) })}
            </AppText>
            <BigButton label={t("dec.why")} selected={false} onPress={() => nav.navigate("Why", { targetId: d.targetId })} />
          </Card>
        );
      })}
      {items.length < total ? <BigButton label={t("dec.more")} selected={false} onPress={() => load(filter, items.length + PAGE)} /> : null}
    </ScrollView>
  );
}
