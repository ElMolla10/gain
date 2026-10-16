import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { useDeveloperMode } from "../DeveloperMode";
import { telemetry } from "../achievementTelemetry";
import { diagnostics } from "../diagnostics";
import { SwitchRow } from "../components/SettingsRows";
import { Platform } from "react-native";
import { buildFlags } from "../buildConfig";
import { useI18n } from "../i18n";
import { hasSelfUpdater } from "../logic/buildFlags";
import { osTextKey } from "../logic/platform";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, InlineStatus, Notice, Screen } from "../ui";

/** Privacy and safety page (DRAFT, not legally reviewed). The text is in strings.privacy.ts and docs/PRIVACY-POLICY-DRAFT.md. */
export function PrivacyScreen() {
  const { t } = useI18n();
  const { enabled: developerMode } = useDeveloperMode();
  const [crashLog, setCrashLog] = useState(() => diagnostics.isEnabled());
  const [notesOn, setNotesOn] = useState(() => telemetry.isOptedIn());
  const [cleared, setCleared] = useState(false);
  useFocusEffect(useCallback(() => {
    setCrashLog(diagnostics.isEnabled());
    setNotesOn(telemetry.isOptedIn());
  }, []));
  const p = usePalette();
  const nav = useNavigation<{ navigate: (n: "Data" | "Diagnostics") => void }>();
  const block = (title: Parameters<typeof t>[0], lines: Parameters<typeof t>[0][]) => (
    <Card>
      <AppText style={{ fontWeight: "600", fontSize: 20 }} accessibilityRole="header">{t(title)}</AppText>
      {lines.map((k) => (
        <AppText key={k}>{t(k)}</AppText>
      ))}
    </Card>
  );
  return (
    <Screen>
      <Notice kind="warn">{t("privacy.draft")}</Notice>
      {block("privacy.local.title", ["privacy.local.body", "privacy.ai.body"])}
      {block("privacy.leaves.title", [...(hasSelfUpdater(buildFlags, Platform.OS) ? (["privacy.leaves.update"] as const) : []), "privacy.leaves.sync", "privacy.leaves.link", osTextKey("privacy.leaves.share", Platform.OS), osTextKey("privacy.leaves.backup", Platform.OS)])}
      <Card>
        <AppText style={{ fontWeight: "600", fontSize: 20 }} accessibilityRole="header">{t("privacy.crash.title")}</AppText>
        <AppText>{t("privacy.crash.body")}</AppText>
        <SwitchRow label={t("privacy.crash.enabled")} value={crashLog} onChange={on => { diagnostics.setEnabled(on); setCrashLog(on); }} />
        <BigButton variant="quiet" label={t("diag.clear")} onPress={() => { diagnostics.clear(); setCleared(true); }} />
        {cleared ? <InlineStatus kind="success" text={t("diag.cleared")} /> : null}
      </Card>
      <Card>
        <AppText style={{ fontWeight: "600", fontSize: 20 }} accessibilityRole="header">{t("privacy.telemetry.title")}</AppText>
        <AppText>{t("privacy.telemetry.body")}</AppText>
        <SwitchRow label={t("telemetry.enabled")} note={t("telemetry.enabled.note")} value={notesOn} onChange={(on) => { telemetry.setOptedIn(on); setNotesOn(on); }} />
      </Card>
      {block("privacy.control.title", [osTextKey("privacy.control.body", Platform.OS)])}
      {block("privacy.health.title", ["privacy.health.body", "privacy.age"])}
      <AppText style={{ color: p.muted }}>{t("privacy.contact")}</AppText>
      <BigButton label={t("data.entry")} variant="secondary" onPress={() => nav.navigate("Data")} />
      {developerMode ? <BigButton label={t("diag.entry")} variant="secondary" onPress={() => nav.navigate("Diagnostics")} /> : null}
    </Screen>
  );
}
