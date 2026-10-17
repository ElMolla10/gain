import React from "react";
import { useI18n } from "../i18n";
import { Group, LinkRow, SwitchRow } from "./SettingsRows";
import { MlAccuracyCard } from "./MlAccuracyCard";

/** Hidden tools are not mounted, so opening ordinary Settings does not query evaluation reports. */
export function DeveloperTools(props: {
  enabled: boolean;
  saving: boolean;
  onChange: (on: boolean) => void;
  onNavigate: (route: "DecisionLog" | "Diagnostics" | "StoppedSuggestions") => void;
}) {
  const { t } = useI18n();
  if (!props.enabled) return null;
  return <Group title={t("settings.developer.title")}>
    <SwitchRow label={t("settings.developer.title")} note={t("settings.developer.note")} value={props.enabled} disabled={props.saving} onChange={props.onChange} />
    <MlAccuracyCard />
    <LinkRow label={t("dec.entry")} onPress={() => props.onNavigate("DecisionLog")} />
    <LinkRow label={t("diag.entry")} onPress={() => props.onNavigate("Diagnostics")} />
    <LinkRow label={t("stop.entry")} onPress={() => props.onNavigate("StoppedSuggestions")} />
  </Group>;
}
