import React, { useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useI18n } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { medalA11y, medalStateLine } from "../../logic/achievementCopy";
import { collapseForPartial, monthOf, shelfSections, slotNameKey, type Shelf, type ShelfItem } from "../../logic/achievementShowcase";
import { radius, space, type as ty, useAchievementArt, usePalette } from "../../theme";
import { AppText, QuietAction } from "../../ui";
import { Medal } from "./Medal";

/** Medal size on a shelf (dp): at the LOD threshold, so shelves draw the simple masters. */
export const SHELF_MEDAL = 56;
/** A slot is at least this tall (spec §2): the medal, a two-line name and the state line. */
export const SLOT_MIN_HEIGHT = 104;
const LEDGE = 10;

/** 4 columns, 3 above fontScale 1.3, 2 above 1.6 (spec §8). Labels wrap; medals keep their size. */
export const shelfColumns = (fontScale: number): number => (fontScale > 1.6 ? 2 : fontScale > 1.3 ? 3 : 4);

function rows<T>(items: readonly T[], cols: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += cols) out.push(items.slice(i, i + cols));
  return out;
}

/** One medal on its ledge: the art (a ×N stack shows two ghost medals behind), its name and its state line. A button that opens details. */
export function MedalSlot({ item, cols, onOpen }: { item: ShelfItem; cols: number; onOpen: (item: ShelfItem) => void }) {
  const { t, lang } = useI18n();
  const p = usePalette();
  const name = t(slotNameKey(item) as StringKey);
  const progress = item.state === "in_progress" && item.row && (item.row.progressTarget ?? 0) > 0 ? (item.row.progressCurrent ?? 0) / (item.row.progressTarget ?? 1) : 0;
  const month = item.badgeId.startsWith("quest_") ? monthOf(item.row) : undefined;
  const stack = item.repeatable && item.count > 1;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={medalA11y(item, t(item.i18nKey as StringKey), lang, t)}
      accessibilityHint={t("achv.r2.medal.hint")}
      accessibilityValue={item.state === "in_progress" && item.row ? { min: 0, max: item.row.progressTarget ?? 0, now: item.row.progressCurrent ?? 0 } : undefined}
      onPress={() => onOpen(item)}
      style={({ pressed }) => ({
        width: `${100 / cols}%`,
        minHeight: SLOT_MIN_HEIGHT,
        alignItems: "center",
        gap: space.xs,
        paddingTop: space.sm,
        paddingBottom: space.xs,
        paddingHorizontal: space.xs,
        borderRadius: radius.button,
        backgroundColor: pressed ? p.raised : "transparent",
      })}
    >
      <View style={{ width: SHELF_MEDAL, height: SHELF_MEDAL }}>
        {stack ? (
          <>
            <View style={{ position: "absolute", transform: [{ translateX: 8 }] }}>
              <Medal badgeId={item.badgeId} state="earned" size={SHELF_MEDAL} month={month} opacity={0.4} />
            </View>
            <View style={{ position: "absolute", transform: [{ translateX: 4 }] }}>
              <Medal badgeId={item.badgeId} state="earned" size={SHELF_MEDAL} month={month} opacity={0.7} />
            </View>
          </>
        ) : null}
        <Medal badgeId={item.badgeId} state={item.state} size={SHELF_MEDAL} progress={progress} month={month} />
      </View>
      <AppText style={{ fontSize: ty.label, fontWeight: "600", textAlign: "center", color: item.state === "locked" ? p.muted : p.text }}>{name}</AppText>
      <AppText style={{ fontSize: ty.caption, color: p.muted, textAlign: "center" }}>{medalStateLine(item, lang, t)}</AppText>
    </Pressable>
  );
}

function Ledge() {
  const art = useAchievementArt();
  return (
    <View
      style={{
        height: LEDGE,
        borderRadius: LEDGE / 2,
        backgroundColor: art.ledge,
        borderTopWidth: 1,
        borderColor: art.ledgeHi,
        shadowColor: art.shadow,
        shadowOpacity: art.shadowOpacity,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    />
  );
}

/**
 * One shelf of the Trophy Cabinet (Strength · Consistency · Lifetime · Mastery): a card with the shelf name and "x of y", its medals in
 * rows that flow from the start edge, each row standing on a ledge. Lifetime and Mastery split into labelled tracks. A partial lifter
 * sees what's earned plus the next 2 and a "See all N" toggle.
 */
export function CabinetShelf({ shelf, items, partial = false, onOpen }: { shelf: Shelf; items: ShelfItem[]; partial?: boolean; onOpen: (item: ShelfItem) => void }) {
  const { t } = useI18n();
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const cols = shelfColumns(fontScale);
  const [all, setAll] = useState(false);
  const collapsed = partial && !all ? collapseForPartial(items) : null;
  const collapsible = partial && collapseForPartial(items).hidden > 0;
  const sections = collapsed ? [{ track: null, items: collapsed.visible }] : shelfSections(items);
  const earned = items.filter((i) => i.state === "earned").length;
  return (
    <View style={{ backgroundColor: p.card, borderColor: p.border, borderWidth: 1, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md }}>
        <View style={{ flexShrink: 1, alignItems: "flex-start" }}>
          <AppText accessibilityRole="header" style={{ fontSize: ty.body, fontWeight: "600" }}>{t(`achv.r2.shelf.${shelf}` as StringKey)}</AppText>
          {collapsible ? (
            <QuietAction
              label={all ? t("achv.r2.shelf.seeLess") : t("achv.r2.shelf.seeAll", { n: items.length })}
              expanded={all}
              onPress={() => setAll((v) => !v)}
            />
          ) : null}
        </View>
        <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("achv.r2.shelf.count", { earned, total: items.length })}</AppText>
      </View>
      {sections.map((section, si) => (
        <View key={`${section.track ?? "all"}${si}`} style={{ gap: space.xs }}>
          {section.track ? <AppText style={{ fontSize: ty.label, fontWeight: "600", color: p.muted }}>{t(`achv.r2.track.${section.track}` as StringKey)}</AppText> : null}
          {rows(section.items, cols).map((row, ri) => (
            <View key={ri} style={{ gap: 0 }}>
              <View style={{ flexDirection: "row" }}>
                {row.map((item) => (
                  <MedalSlot key={item.slot} item={item} cols={cols} onOpen={onOpen} />
                ))}
              </View>
              <Ledge />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
