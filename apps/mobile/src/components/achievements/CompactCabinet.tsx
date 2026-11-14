import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useI18n } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { medalA11y, prCopy } from "../../logic/achievementCopy";
import { nextMedals, slotNameKey, type ShelfGroup, type ShelfItem } from "../../logic/achievementShowcase";
import type { SurfaceBadge } from "../../logic/achievementSurface";
import type { MonthQuest } from "../../db/achievementRepo";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { Icon } from "../Icon";
import { Medal } from "./Medal";
import { MonthSeal } from "./MonthSeal";

/** One compact route from the summary to the full, unchanged medal details. */
export function NextMedals({ cabinet, onOpen }: { cabinet: SurfaceBadge[]; onOpen: (row: SurfaceBadge) => void }) {
  const { t, lang } = useI18n();
  const p = usePalette();
  const rows = nextMedals(cabinet);
  if (!rows.length) return null;
  return <View style={{ gap: space.sm }}>
    <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("achv.compact.next")}</AppText>
    {rows.map((row) => {
      const current = Math.max(0, row.progressCurrent ?? 0);
      const target = row.progressTarget ?? 1;
      const name = t(row.i18nKey as StringKey);
      const item = { badgeId: row.badgeId, state: "in_progress" as const, row, count: 0, repeatable: false };
      return <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={medalA11y(item, name, lang, t)} accessibilityHint={t("achv.r2.medal.hint")} accessibilityValue={{ min: 0, max: target, now: Math.min(current, target) }} onPress={() => onOpen(row)} style={({ pressed }) => ({ minHeight: 64, padding: space.md, gap: space.xs, borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.raised : p.card })}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
          <AppText style={{ flexShrink: 1, fontWeight: "600" }}>{name}</AppText>
          <AppText style={{ color: p.muted }}>{t("achv.r2.medal.of", { x: current, y: target })}</AppText>
        </View>
        <View accessible={false} style={{ height: 5, borderRadius: 3, backgroundColor: p.border, overflow: "hidden" }}><View style={{ height: 5, width: `${Math.min(100, current / target * 100)}%`, backgroundColor: p.accent }} /></View>
      </Pressable>;
    })}
  </View>;
}

export function LatestPrCard({ pr, cabinet, onOpenLedger }: { pr: ReturnType<typeof import("../../logic/achievementShowcase").latestPr>; cabinet: SurfaceBadge[]; onOpenLedger: () => void }) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  if (!pr) return null;
  const copy = prCopy(pr, cabinet, lang, unit, t);
  const line = t("achv.compact.prLine", { before: copy.before, after: copy.after });
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t("achv.compact.latestPr")}, ${copy.exercise}, ${line}`} accessibilityHint={t("achv.r2.ledger.open")} onPress={onOpenLedger} style={({ pressed }) => ({ padding: space.md, gap: space.xs, borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.raised : p.card })}>
    <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("achv.compact.latestPr")}</AppText>
    <AppText style={{ fontWeight: "600" }}>{copy.exercise}</AppText>
    <AppText style={{ color: p.accent }}>{line}</AppText>
  </Pressable>;
}

export function CompactShelves({ groups, quest, onOpen, onQuestChanged }: { groups: ShelfGroup[]; quest: MonthQuest | null; onOpen: (item: ShelfItem) => void; onQuestChanged: () => void }) {
  const { t, lang } = useI18n();
  const p = usePalette();
  const [open, setOpen] = useState<string | null>(null);
  return <View style={{ gap: space.sm }}>
    <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("achv.compact.medals")}</AppText>
    {groups.map((group) => {
      const expanded = open === group.shelf;
      const title = t(`achv.r2.shelf.${group.shelf}` as StringKey);
      const count = t("achv.r2.shelf.count", { earned: group.earned, total: group.items.length });
      return <View key={group.shelf} style={{ borderWidth: 1, borderColor: p.border, borderRadius: radius.card, backgroundColor: p.card, overflow: "hidden" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${count}`} accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : group.shelf)} style={({ pressed }) => ({ minHeight: 56, padding: space.md, flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: pressed ? p.raised : "transparent" })}>
          <AppText style={{ flex: 1, fontWeight: "600" }}>{title}</AppText>
          <AppText style={{ color: p.muted }}>{count}</AppText>
          <Icon name="chevron" color={p.muted} size={18} mirror />
        </Pressable>
        {expanded ? <View style={{ paddingHorizontal: space.md, paddingBottom: space.md, gap: space.xs }}>
          {group.items.filter((item) => item.slot !== "quest" || !quest).map((item) => {
            const name = item.badgeId === "strength_pr" ? t("achv.compact.pr") : t(slotNameKey(item) as StringKey);
            const state = item.state === "earned" ? (item.repeatable ? t("achv.compact.prCount", { n: item.count }) : t("achv.compact.earned")) : item.state === "locked" ? t("achv.r2.medal.locked") : t("achv.r2.medal.of", { x: item.row?.progressCurrent ?? 0, y: item.row?.progressTarget ?? 0 });
            return <Pressable key={item.slot} accessibilityRole="button" accessibilityLabel={medalA11y(item, name, lang, t)} accessibilityHint={t("achv.r2.medal.hint")} onPress={() => onOpen(item)} style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs, backgroundColor: pressed ? p.raised : "transparent" })}>
              <Medal badgeId={item.badgeId} state={item.state} size={32} />
              <AppText style={{ flex: 1 }}>{name}</AppText>
              <AppText style={{ fontSize: ty.label, color: p.muted }}>{state}</AppText>
            </Pressable>;
          })}
          {group.shelf === "consistency" ? <MonthSeal quest={quest} onChanged={onQuestChanged} /> : null}
        </View> : null}
      </View>;
    })}
  </View>;
}
