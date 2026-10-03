import React from "react";
import { useI18n } from "../i18n";
import { usePalette } from "../theme";
import { AppText } from "../ui";

/** One plain line: a training aid, not medical advice, pain means stop. Shown where targets, goals and the first screen appear. */
export function HealthNote() {
  const { t } = useI18n();
  const p = usePalette();
  return <AppText style={{ color: p.muted, fontSize: 13 }}>{t("health.note")}</AppText>;
}
