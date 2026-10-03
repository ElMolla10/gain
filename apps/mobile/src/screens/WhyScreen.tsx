import { useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { useServices } from "../AppContext";
import type { StringKey } from "../i18n/strings";
import { useI18n } from "../i18n";
import { describeDecisionSafe, type WhySection } from "../logic/why";
import { space, usePalette } from "../theme";
import { AppText, Card, EmptyState, LoadingState, Screen } from "../ui";

export function WhyScreen() {
  const { finish } = useServices();
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const targetId = (useRoute().params as { targetId: string }).targetId;
  const [sections, setSections] = useState<WhySection[] | null | "missing">(null);

  useEffect(() => {
    (async () => {
      const d = await finish.getDecision(targetId);
      if (!d) return setSections("missing");
      const tg = await finish.getTarget(targetId);
      const reason = tg?.reason ?? d.payload?.proposal?.reason ?? { key: "unknown", params: {} };
      setSections(describeDecisionSafe(d.payload, { ruleVersion: d.ruleVersion, path: d.path, reason }, (k, params) => t(k as StringKey, params), lang, unit));
    })().catch(() => setSections("missing"));
  }, [finish, targetId, t, lang, unit]);

  if (sections === null) return <LoadingState />;
  if (sections === "missing") return <EmptyState icon="why" title={t("why.missing")} />;
  return (
    <Screen>
      {sections.map((s) => (
        <Card key={s.title}>
          <AppText style={{ fontWeight: "600", fontSize: 20 }} accessibilityRole="header">{s.title}</AppText>
          {s.lines.map((l, i) => (
            <AppText key={i} style={i === 0 && s.title === t("why.sentence") ? {} : { color: p.text }}>{l}</AppText>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
