import React from "react";
import { Pressable, View } from "react-native";
import { useI18n } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { countKey } from "../../logic/achievementCopy";
import { evidenceLine } from "../../logic/achievementEvidence";
import { ledgerSummary, monthOf } from "../../logic/achievementShowcase";
import type { SurfaceBadge } from "../../logic/achievementSurface";
import { formatDay } from "../../logic/dateText";
import { radius, space, type as ty, useAchievementArt, usePalette } from "../../theme";
import { AppText, SectionTitle } from "../../ui";
import { Icon } from "../Icon";
import { Medal } from "./Medal";

const DOT = 40;

/** Lifter's Ledger teaser: "54 milestones since 9 Mar 2024", the latest 3 on a timeline (newest first) and "Open the Ledger". Hidden when empty. */
export function LedgerTeaser({ earned, onOpenLedger, onOpen }: { earned: SurfaceBadge[]; onOpenLedger: () => void; onOpen: (row: SurfaceBadge) => void }) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const art = useAchievementArt();
  const summary = ledgerSummary(earned);
  if (summary.count === 0) return null;
  const since = summary.since ? formatDay(summary.since, lang, undefined, true) : "";
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle
        action={<AppText style={{ fontSize: ty.label, color: p.muted, flexShrink: 1 }}>{t(countKey(summary.count, lang, "achv.r2.ledger.summary.one", "achv.r2.ledger.summary.few"), { n: summary.count, date: since })}</AppText>}
      >
        {t("achv.ledger.title")}
      </SectionTitle>
      <View style={{ backgroundColor: p.card, borderColor: p.border, borderWidth: 1, borderRadius: radius.card, padding: space.lg, gap: space.xs }}>
        {summary.latest.map((row, i) => {
          const name = t(row.i18nKey as StringKey);
          const date = row.earnedLocalDate ? formatDay(row.earnedLocalDate, lang) : "";
          const note = evidenceLine(row.evidence, t, lang, unit, { nameEn: row.exerciseNameEn, nameAr: row.exerciseNameAr });
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={[date, name, note].filter(Boolean).join(", ")}
              accessibilityHint={t("achv.r2.medal.hint")}
              onPress={() => onOpen(row)}
              style={({ pressed }) => ({ flexDirection: "row", gap: space.md, minHeight: 56, paddingVertical: space.xs, borderRadius: radius.button, backgroundColor: pressed ? p.raised : "transparent" })}
            >
              <View style={{ width: DOT, alignItems: "center" }}>
                <Medal badgeId={row.badgeId} state="earned" size={DOT} month={row.badgeId.startsWith("quest_") ? monthOf(row) : undefined} />
                {i < summary.latest.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: art.ledgeHi, marginTop: space.xs }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2, paddingBottom: space.sm }}>
                {date ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{date}</AppText> : null}
                <AppText style={{ fontWeight: "600" }}>{name}</AppText>
                {note ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{note}</AppText> : null}
              </View>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("achv.r2.ledger.open")}
          onPress={onOpenLedger}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, borderTopWidth: 1, borderColor: p.border, paddingTop: space.sm, backgroundColor: pressed ? p.raised : "transparent" })}
        >
          <AppText style={{ fontWeight: "600", color: p.accent }}>{t("achv.r2.ledger.open")}</AppText>
          <Icon name="chevron" color={p.accent} size={20} mirror />
        </Pressable>
      </View>
    </View>
  );
}
