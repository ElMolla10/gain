import { useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { useServices } from "../AppContext";
import type { StringKey } from "../i18n/strings";
import { useI18n } from "../i18n";
import { describeDecisionSafe, type WhySection } from "../logic/why";
import { space, usePalette } from "../theme";
import { AppText, Card } from "../ui";

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

  if (sections === null) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  if (sections === "missing") return <AppText style={{ padding: space.lg }}>{t("why.missing")}</AppText>;
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      {sections.map((s) => (
        <Card key={s.title}>
          <AppText style={{ fontWeight: "800", fontSize: 18 }}>{s.title}</AppText>
          {s.lines.map((l, i) => (
            <AppText key={i} style={i === 0 && s.title === t("why.sentence") ? {} : { color: p.text }}>{l}</AppText>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}
