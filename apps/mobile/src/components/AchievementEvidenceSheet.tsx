import React, { useEffect } from "react";
import { telemetry } from "../achievementTelemetry";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { evidenceLine } from "../logic/achievementEvidence";
import { evidenceSheetContent, prestigeForBadge, type SurfaceBadge } from "../logic/achievementSurface";
import { usePalette } from "../theme";
import { AppText, BigButton, Sheet } from "../ui";

export function AchievementEvidenceSheet(props: {
  row: SurfaceBadge | null;
  qualifiedWeeksLifetime: number;
  weeks12Earned: boolean;
  onClose: () => void;
  onViewWorkout: (sessionId: string) => void;
}) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const row = props.row;
  useEffect(() => {
    if (row) telemetry.record("badge_detail");
  }, [row?.id]);
  const sheet = row
    ? evidenceSheetContent({
        badgeId: row.badgeId,
        primarySessionId: row.primarySessionId,
        qualifiedWeeksLifetime: props.qualifiedWeeksLifetime,
        weeks12Earned: props.weeks12Earned,
      })
    : null;
  return (
    <Sheet
      visible={row !== null}
      title={row ? t(row.i18nKey as StringKey) : t("achv.detail.title")}
      onClose={props.onClose}
      // The primary action sits in the footer, in thumb reach (N-3).
      footer={row && sheet?.supportingSessionId ? (
        <BigButton
          label={t("achv.viewWorkout")}
          onPress={() => {
            const sessionId = sheet.supportingSessionId!;
            telemetry.record("view_workout");
            props.onClose();
            props.onViewWorkout(sessionId);
          }}
        />
      ) : undefined}
    >
      {row && sheet ? (
        <>
          <AppText style={{ color: p.muted }}>{t(`achv.prestige.${prestigeForBadge(row.badgeId)}` as StringKey)}</AppText>
          <AppText>
            {row.evidence
              ? evidenceLine(row.evidence, t, lang, unit, { nameEn: row.exerciseNameEn, nameAr: row.exerciseNameAr })
              : row.status === "in_progress"
                ? t("achv.nextup.progress", { done: row.progressCurrent ?? 0, goal: row.progressTarget ?? 0 })
                : t("achievements.locked")}
          </AppText>
          {row.status === "revoked_by_edit" ? <AppText style={{ color: p.muted }}>{t("achv.revoked")}</AppText> : null}
          <AppText>{t(sheet.ruleKey, sheet.ruleParams)}</AppText>
          {sheet.nextTier ? (
            <AppText>
              {t("achv.cabinet.nextTier", {
                name: t(sheet.nextTier.i18nKey as StringKey),
                done: sheet.nextTier.current,
                goal: sheet.nextTier.target,
              })}
            </AppText>
          ) : (
            <AppText style={{ color: p.muted }}>{t("achv.cabinet.noNext")}</AppText>
          )}
        </>
      ) : null}
    </Sheet>
  );
}

export function prestigeNote(badgeId: string, t: (key: StringKey) => string): string {
  return t(`achv.prestige.${prestigeForBadge(badgeId)}` as StringKey);
}
