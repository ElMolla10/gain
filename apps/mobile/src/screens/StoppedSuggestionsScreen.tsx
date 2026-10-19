import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { useServices } from "../AppContext";
import type { StoppedSuggestion } from "../db/rejectionRepo";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { usePalette } from "../theme";
import { AppText, BigButton, Card, EmptyState, LoadingState, Screen } from "../ui";
import { StoppedSuggestionCard10x } from "../components/why/StoppedSuggestionCard10x";

/** "Things I've stopped suggesting": every jump the lifter declined, how many times, and a way to bring it back (with undo). */
export function StoppedSuggestionsScreen() {
  const { rejections } = useServices();
  const { t } = useI18n();
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
      {items.length === 0 ? <EmptyState icon="settings" title={t("empty.noDeclined")} body={t("stop.empty")} /> : null}
      {items.map((it) => (
        <StoppedSuggestionCard10x
          key={it.id}
          item={it}
          onBringBack={async () => {
            await rejections.bringBack(it.id);
            setLast({ id: it.id, msg: "stop.restored" });
            await refresh();
          }}
        />
      ))}
    </Screen>
  );
}
