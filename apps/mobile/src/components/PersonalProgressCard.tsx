import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import type { ConsistencyProgress } from "../logic/personalProgress";
import { AppText, BigButton, Card } from "../ui";
import { type as ty, usePalette } from "../theme";
import { diagnostics } from "../diagnostics";
export function PersonalProgressCard() {
  const { history } = useServices(); const { t } = useI18n(); const p = usePalette();
  const [value, setValue] = useState<ConsistencyProgress | null>(null);
  const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true; setFailed(false);
    history.getPersonalProgress().then(v => { if (alive) setValue(v); }).catch(e => { diagnostics.record("warn", "personal progress", e); if (alive) { setValue(null); setFailed(true); } });
    return () => { alive = false; };
  }, [history, attempt]));
  if (failed) return <Card><AppText>{t("progress.loadingFailed")}</AppText><BigButton variant="secondary" label={t("history.error.retry")} onPress={() => setAttempt(n => n + 1)} /></Card>;
  if (!value) return null;
  return <Card>
    <AppText accessibilityRole="header" style={{ fontWeight: "600" }}>{t("progress.week")}</AppText>
    <AppText style={{ fontSize: ty.title, color: p.accent }}>{value.goal === null ? t("progress.noGoal", { done: value.done }) : t("progress.weekCount", { done: value.done, goal: value.goal })}</AppText>
    <AppText style={{ color: p.muted }}>{t(value.achieved ? "progress.goalDone" : "progress.rest")}</AppText>
    <AppText>{t("progress.days", { n: value.activeDays })}</AppText>
    {value.level > 0 ? <AppText style={{ color: p.accent }}>{t("progress.badge", { n: value.level })}</AppText> : null}
    <AppText style={{ color: p.muted }}>{t("progress.note")}</AppText>
  </Card>;
}
