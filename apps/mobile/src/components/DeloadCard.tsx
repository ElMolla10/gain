import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { SessionInProgress } from "../db/programmeRepo";
import type { DeloadView } from "../db/deloadRepo";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";

/** Dismissible lighter-week suggestion. Nothing changes until the lifter confirms. */
export function DeloadCard() {
  const { deload } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [state, setState] = useState<DeloadView>({ status: "none" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    let alive = true;
    const tz = -new Date().getTimezoneOffset() * 60_000;
    void deload.endIfExpired(Date.now(), tz).catch(() => undefined).then(() => deload.getState(Date.now(), tz)).then((s) => alive && setState(s)).catch(() => alive && setState({ status: "none" }));
    return () => {
      alive = false;
    };
  }, [deload]);

  useFocusEffect(refresh);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      await fn();
      const tz = -new Date().getTimezoneOffset() * 60_000;
      setState(await deload.getState(Date.now(), tz));
    } catch (e) {
      setNote(e instanceof SessionInProgress ? t("short.openWorkout") : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (state.status === "none") return note ? <AppText style={{ color: p.muted }}>{note}</AppText> : null;
  if (state.status === "load" || state.status === "sets") {
    return (
      <Card>
        <AppText>{state.status === "load" ? t("deload.activeLoad") : t("deload.activeSets")}</AppText>
        <BigButton variant="quiet" label={t("deload.undo")} disabled={busy} onPress={() => void run(() => deload.undo())} />
        {note ? <AppText style={{ color: p.muted }}>{note}</AppText> : null}
      </Card>
    );
  }
  if (state.status === "dismissed") return null;
  return (
    <Card>
      <AppText style={{ fontWeight: "600", fontSize: ty.section }}>{t("deload.title")}</AppText>
      <AppText>{t("deload.body")}</AppText>
      <AppText style={{ color: p.muted }}>{t("deload.keep")}</AppText>
      <BigButton label={t("deload.load")} disabled={busy} onPress={() => void run(() => deload.applyLoad())} />
      <BigButton variant="secondary" label={t("deload.sets")} disabled={busy} onPress={() => void run(() => deload.applySets())} />
      <BigButton variant="quiet" label={t("deload.dismiss")} disabled={busy} onPress={() => void run(() => deload.dismiss())} />
      {note ? <AppText style={{ color: p.muted, fontSize: ty.caption }}>{note}</AppText> : null}
    </Card>
  );
}
