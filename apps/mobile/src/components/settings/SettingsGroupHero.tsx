import React from "react";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import { space, usePalette } from "../../theme";
import { AppText, Card } from "../../ui";

interface SettingsGroupHeroProps {
  version: string;
  activeGymName?: string | null;
}

export function SettingsGroupHero({ version, activeGymName }: SettingsGroupHeroProps) {
  const { t } = useI18n();
  const p = usePalette();

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <AppText style={[styles.kicker, { color: p.muted }]} accessibilityRole="header">
          {t("settings.shell.hero")}
        </AppText>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.mainInfo}>
          <AppText style={[styles.title, { color: p.text }]}>{t("settings.engine.title")}</AppText>
          <AppText ltr style={[styles.versionText, { color: p.muted }]}>
            v{isolateLtr(version)} · SQLite Vault
          </AppText>
        </View>

        {activeGymName ? (
          <View style={[styles.gymBadge, { backgroundColor: p.card, borderColor: p.border }]}>
            <AppText style={[styles.gymBadgeText, { color: p.text }]}>
              {activeGymName}
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    borderRadius: 16,
    gap: space.xs,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.xs,
  },
  mainInfo: {
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  versionText: {
    fontSize: 13,
  },
  gymBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  gymBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
