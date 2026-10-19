import React from "react";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../i18n";
import { space, usePalette } from "../../theme";
import { AppText, BigButton, Card } from "../../ui";
import { SwitchRow } from "../SettingsRows";

interface PrivacyPledgeCardProps {
  crashLog: boolean;
  notesOn: boolean;
  onToggleCrashLog: (val: boolean) => void;
  onToggleNotesOn: (val: boolean) => void;
  onOpenData: () => void;
  onOpenDiagnostics: () => void;
}

export function PrivacyPledgeCard({
  crashLog,
  notesOn,
  onToggleCrashLog,
  onToggleNotesOn,
  onOpenData,
  onOpenDiagnostics,
}: PrivacyPledgeCardProps) {
  const { t } = useI18n();
  const p = usePalette();

  return (
    <View style={styles.container}>
      {/* Zero Surveillance Pledge Hero */}
      <Card style={styles.pledgeCard}>
        <View style={styles.topRow}>
          <AppText style={styles.shieldIcon}>🛡️</AppText>
          <AppText style={[styles.kicker, { color: p.muted }]} accessibilityRole="header">
            {t("privacy.pledge.hero")}
          </AppText>
        </View>

        <AppText style={[styles.pledgeBody, { color: p.text }]}>
          {t("privacy.pledge.body")}
        </AppText>

        {/* Toggles */}
        <View style={styles.togglesSection}>
          <SwitchRow
            label={t("privacy.crashLog")}
            value={crashLog}
            onChange={onToggleCrashLog}
          />
          <SwitchRow
            label={t("privacy.notes")}
            value={notesOn}
            onChange={onToggleNotesOn}
          />
        </View>

        {/* Quick Vault and Diagnostics Triggers */}
        <View style={styles.actionsContainer}>
          <BigButton
            label={t("privacy.manageData")}
            variant="secondary"
            onPress={onOpenData}
          />
          <BigButton
            label={t("privacy.openDiag")}
            variant="secondary"
            onPress={onOpenDiagnostics}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  pledgeCard: {
    padding: space.lg,
    borderRadius: 16,
    gap: space.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  shieldIcon: {
    fontSize: 16,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  pledgeBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  togglesSection: {
    gap: space.xs,
    paddingTop: space.xs,
  },
  actionsContainer: {
    gap: space.sm,
    marginTop: space.xs,
  },
});
