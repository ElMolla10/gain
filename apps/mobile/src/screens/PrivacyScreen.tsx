import { useNavigation } from "@react-navigation/native";
import React from "react";
import { ScrollView } from "react-native";
import { useI18n } from "../i18n";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";

/** Privacy and safety page (DRAFT, not legally reviewed). The text is in strings.privacy.ts and docs/PRIVACY-POLICY-DRAFT.md. */
export function PrivacyScreen() {
  const { t } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (n: "Data" | "Diagnostics") => void }>();
  const block = (title: Parameters<typeof t>[0], lines: Parameters<typeof t>[0][]) => (
    <Card>
      <AppText style={{ fontWeight: "700" }} accessibilityRole="header">{t(title)}</AppText>
      {lines.map((k) => (
        <AppText key={k}>{t(k)}</AppText>
      ))}
    </Card>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <Card>
        <AppText style={{ fontWeight: "700", color: p.danger }}>{t("privacy.draft")}</AppText>
      </Card>
      {block("privacy.local.title", ["privacy.local.body"])}
      {block("privacy.leaves.title", ["privacy.leaves.update", "privacy.leaves.sync", "privacy.leaves.link", "privacy.leaves.share", "privacy.leaves.backup"])}
      {block("privacy.crash.title", ["privacy.crash.body"])}
      {block("privacy.control.title", ["privacy.control.body"])}
      {block("privacy.health.title", ["privacy.health.body", "privacy.age"])}
      <AppText style={{ color: p.muted }}>{t("privacy.contact")}</AppText>
      <BigButton label={t("data.entry")} selected={false} onPress={() => nav.navigate("Data")} />
      <BigButton label={t("diag.entry")} selected={false} onPress={() => nav.navigate("Diagnostics")} />
    </ScrollView>
  );
}
