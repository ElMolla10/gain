import React from "react";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import { formatDay } from "../../logic/dateText";
import type { SyncInfo } from "../../sync/engine";
import { space, usePalette } from "../../theme";
import { AppText, BigButton, Card, InlineStatus } from "../../ui";

interface CloudSyncCardProps {
  info: SyncInfo | null;
  /** A sync job is running: every button is disabled. */
  busy: boolean;
  onTurnOn: () => void;
  onSyncNow: () => void;
  onShowDetails: () => void;
}

export function CloudSyncCard({
  info,
  busy,
  onTurnOn,
  onSyncNow,
  onShowDetails,
}: CloudSyncCardProps) {
  const { t, lang } = useI18n();
  const p = usePalette();

  const isSyncOn = info && info.status !== "off";
  const lastSyncDate =
    info?.lastSyncAt && Number.isFinite(info.lastSyncAt)
      ? `${formatDay(info.lastSyncAt, lang)} ${isolateLtr(new Date(info.lastSyncAt).toTimeString().slice(0, 5))}`
      : null;

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        {/* Header Status Row */}
        <View style={styles.topRow}>
          <View style={[styles.statusBadge, { backgroundColor: p.card, borderColor: p.border }]}>
            <AppText style={styles.statusDot}>{isSyncOn ? "🔒" : "📱"}</AppText>
            <AppText style={[styles.statusText, { color: p.text }]} accessibilityRole="header">
              {t(isSyncOn ? "vault.sync.active" : "vault.sync.offline")}
            </AppText>
          </View>
        </View>

        {/* Sync Status Info */}
        <View style={styles.infoSection}>
          {lastSyncDate ? (
            <AppText style={[styles.syncDateText, { color: p.muted }]}>
              {t("sync.lastAt", { time: lastSyncDate })}
            </AppText>
          ) : (
            <AppText style={[styles.syncDateText, { color: p.muted }]}>
              {t("sync.never")}
            </AppText>
          )}

          {info && info.pendingOut > 0 ? (
            <InlineStatus
              kind="info"
              text={t("sync.pending", { n: isolateLtr(String(info.pendingOut)) })}
            />
          ) : null}

          {info && info.parked.conflict > 0 ? (
            <InlineStatus
              kind="warn"
              text={t("sync.parkedConflict", { n: info.parked.conflict })}
            />
          ) : null}
        </View>

        {/* Action Triggers */}
        <View style={styles.actionsContainer}>
          {!isSyncOn ? (
            <BigButton
              hero
              label={t("sync.turnOn")}
              disabled={busy}
              onPress={onTurnOn}
            />
          ) : (
            <>
              <BigButton
                label={t("sync.now")}
                disabled={busy}
                variant="secondary"
                onPress={onSyncNow}
              />
              <BigButton
                label={t("sync.details")}
                disabled={busy}
                variant="secondary"
                onPress={onShowDetails}
              />
            </>
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  card: {
    padding: space.lg,
    borderRadius: 16,
    gap: space.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: 8,
    borderWidth: 1,
    gap: space.xs,
  },
  statusDot: {
    fontSize: 14,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  infoSection: {
    gap: space.xs,
  },
  syncDateText: {
    fontSize: 14,
  },
  codeBox: {
    padding: space.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: space.xs,
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  codeText: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1.5,
    paddingVertical: space.xs,
  },
  codeHint: {
    fontSize: 13,
    lineHeight: 16,
  },
  actionsContainer: {
    gap: space.sm,
    marginTop: space.xs,
  },
});
