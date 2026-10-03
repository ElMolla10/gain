import React from "react";
import { useI18n } from "../i18n";
import { useLogPalette } from "../theme";
import { AppText, BigButton, Sheet } from "../ui";

/**
 * The instruction paragraphs of the workout logger. They used to sit in the default view of every workout; now they live behind the
 * Help button (contextual help in a sheet) so the screen shows only sets, targets and inputs.
 */
export function WorkoutHelp({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const p = useLogPalette();
  const keys = ["workout.help.target", "workout.setHint", "workout.superset.note", "workout.replace.note", "workout.add.note", "workout.finishNote"] as const;
  return (
    <Sheet visible={visible} title={t("workout.help.title")} onClose={onClose} footer={<BigButton label={t("common.close")} onPress={onClose} />}>
      {keys.map((k) => (
        <AppText key={k} style={{ fontSize: 14, color: p.muted }}>
          {t(k)}
        </AppText>
      ))}
    </Sheet>
  );
}
