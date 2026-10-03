import { REJECTION_THRESHOLD } from "@gain/engine";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { useServices } from "../AppContext";
import type { StoppedSuggestion } from "../db/rejectionRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { jumpKindText } from "../logic/jumpText";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, EmptyState, InlineStatus, LoadingState, Screen } from "../ui";

/** "Things I've stopped suggesting": every jump the lifter declined, how many times, and a way to bring it back (with undo). */
export function StoppedSuggestionsScreen() {
  const { rejections } = useServices();
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const [items, setItems] = useState<StoppedSuggestion[] | null>(null);
  const [last, setLast] = useState<{ id: string; msg: StringKey } | null>(null);

  const refresh = useCallback(async () => setItems(await rejections.list()), [rejections]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!items) return <LoadingState />;
  return (
    <Screen>
      <AppText style={{ color: p.muted }}>{t("stop.intro")}</AppText>
      {last ? (
        <Card>
          <AppText>{t(last.msg)}</AppText>
          {last.msg === "stop.restored" ? (
            <BigButton
              label={t("stop.undo")}
              variant="secondary"
              onPress={async () => {
                const ok = await rejections.undoBringBack(last.id);
                setLast({ id: last.id, msg: ok ? "stop.undone" : "stop.undoFailed" });
                await refresh();
              }}
            />
          ) : null}
        </Card>
      ) : null}
      {items.length === 0 ? <EmptyState icon="settings" title={t("stop.empty")} /> : null}
      {items.map((it) => (
        <Card key={it.id}>
          <AppText style={{ fontSize: 20, fontWeight: "600" }}>{jumpKindText(it.jumpKind, unit, t as never)}</AppText>
          <AppText>{exerciseLabels(it, lang).primary}</AppText>
          <InlineStatus kind={it.blocked ? "warn" : "info"} text={it.blocked ? t("stop.stopped") : t("stop.counting", { count: it.count, max: REJECTION_THRESHOLD })} />
          <AppText style={{ color: p.muted }}>{t("stop.last", { date: new Date(it.lastRejectedAt).toISOString().slice(0, 10) })}</AppText>
          <BigButton
            label={t("stop.bringBack")}
            variant="secondary"
            onPress={async () => {
              await rejections.bringBack(it.id);
              setLast({ id: it.id, msg: "stop.restored" });
              await refresh();
            }}
          />
        </Card>
      ))}
    </Screen>
  );
}
