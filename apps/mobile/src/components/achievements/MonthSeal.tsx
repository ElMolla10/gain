import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useServices } from "../../AppContext";
import { telemetry } from "../../achievementTelemetry";
import type { MonthQuest } from "../../db/achievementRepo";
import { diagnostics } from "../../diagnostics";
import { useI18n } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText, BigButton, Sheet } from "../../ui";
import { Icon } from "../Icon";
import { Medal } from "./Medal";

/** Seal size on the tab (dp). */
export const SEAL_SIZE = 72;

const sealBadge = (quest: MonthQuest): string => `quest_${quest.picked?.kind ?? quest.offers[0]?.kind ?? "rhythm"}`;
/** "2026-10" → 10. */
export const questMonth = (quest: MonthQuest): number | undefined => {
  const m = /^\d{4}-(\d{2})/.exec(quest.month);
  return m ? Number(m[1]) : undefined;
};

/** What the seal card shows: nothing, a pick prompt, a quest in progress (swappable or not), or a completed quest. */
export function sealMode(quest: MonthQuest | null): "none" | "pick" | "progress" | "done" {
  if (!quest) return "none";
  if (quest.status === "completed" && quest.picked) return "done";
  if (quest.picked && quest.status === "picked") return "progress";
  return quest.status === "offered" && quest.offers.length > 0 ? "pick" : "none";
}

/**
 * This month's quest as a wax seal (one seal colour, the month numeral on the boss). Not picked yet: a "Pick this month's quest"
 * button that opens the existing offers (the same pickQuest call the Progress card makes). Picked: the seal with its progress ring and
 * "2 of 3"; while a swap is still allowed the card opens the offers again. Quests never change targets; that's said on the prompt.
 */
export function MonthSeal({ quest, onChanged }: { quest: MonthQuest | null; onChanged: () => void }) {
  const { achievements } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const mode = sealMode(quest);
  if (!quest || mode === "none") return null;
  const month = questMonth(quest);
  const badgeId = sealBadge(quest);
  const eyebrow = <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>{t("quest.title")}</AppText>;
  const choose = (kind: MonthQuest["offers"][number]["kind"]) => {
    telemetry.record(quest.picked ? "quest_swapped" : "quest_picked");
    void achievements
      .pickQuest(kind)
      .then(() => {
        setOpen(false);
        onChanged();
      })
      .catch((e) => diagnostics.record("warn", "quest pick", e));
  };
  const cardStyle = { flexDirection: "row" as const, alignItems: "center" as const, gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: p.border };

  let card: React.ReactNode;
  if (mode === "pick") {
    card = (
      <View style={[cardStyle, { backgroundColor: p.card }]}>
        <Medal badgeId={badgeId} state="locked" size={SEAL_SIZE} />
        <View style={{ flex: 1, gap: space.xs }}>
          {eyebrow}
          <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("achv.r2.seal.pickBody")}</AppText>
          <BigButton variant="secondary" label={t("achv.r2.seal.pick")} onPress={() => setOpen(true)} />
        </View>
      </View>
    );
  } else {
    const picked = quest.picked!;
    const title = t(picked.titleKey as StringKey);
    const done = mode === "done";
    const { current, target } = quest.progress;
    const a11y = t("achv.r2.seal.a11y", { title, x: current, y: target });
    const body = (
      <>
        <Medal badgeId={badgeId} state={done ? "earned" : "in_progress"} size={SEAL_SIZE} month={month} progress={target > 0 ? current / target : 0} />
        <View style={{ flex: 1, gap: 2 }}>
          {eyebrow}
          <AppText style={{ fontWeight: "600" }}>{title}</AppText>
          <AppText style={{ fontSize: ty.label, color: p.muted }}>{done ? t("quest.done") : t("quest.progress", { done: current, goal: target })}</AppText>
        </View>
      </>
    );
    card =
      !done && quest.canSwap ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a11y}
          accessibilityHint={t("quest.swap")}
          accessibilityValue={{ min: 0, max: target, now: current }}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [cardStyle, { backgroundColor: pressed ? p.raised : p.card }]}
        >
          {body}
          <Icon name="chevron" color={p.muted} size={20} mirror />
        </Pressable>
      ) : (
        <View accessible accessibilityRole={done ? undefined : "progressbar"} accessibilityLabel={done ? `${title}, ${t("quest.done")}` : a11y} accessibilityValue={done ? undefined : { min: 0, max: target, now: current }} style={[cardStyle, { backgroundColor: p.card }]}>
          {body}
        </View>
      );
  }

  return (
    <>
      {card}
      <Sheet visible={open} title={t("quest.title")} onClose={() => setOpen(false)}>
        <AppText style={{ color: p.muted }}>{t("achv.r2.seal.pickBody")}</AppText>
        {quest.offers.map((offer) => {
          const selected = quest.picked?.kind === offer.kind;
          return (
            <View key={offer.kind + offer.titleKey} style={{ gap: space.xs, paddingVertical: space.sm }}>
              <AppText style={{ fontWeight: selected ? "600" : "400" }}>{t(offer.titleKey as StringKey)}</AppText>
              {selected ? (
                <AppText style={{ color: p.muted }}>{t("quest.picked")}</AppText>
              ) : (
                <BigButton variant="secondary" label={t("quest.pick")} onPress={() => choose(offer.kind)} />
              )}
            </View>
          );
        })}
      </Sheet>
    </>
  );
}
