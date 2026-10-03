/**
 * Strings added by the visual redesign (identity v1): status words, empty states, section labels. English is the source.
 * ARABIC IS A DRAFT TRANSLATION (Egyptian-leaning), not approved production copy: needs review by Egyptian lifters.
 */
export const enDesign = {
  "status.savedLocal": "Saved on this phone",
  "status.synced": "Backup synced",
  "status.syncPending": "Backup not synced yet",
  "status.syncFailed": "Backup sync failed",
  "target.label": "NEXT TARGET",
  "target.none": "No target yet. Finish a workout with this lift and GAIN writes one.",
  "target.notEnough": "Not enough history yet",
} as const;

export const arDesign: Record<keyof typeof enDesign, string> = {
  "status.savedLocal": "محفوظ على الموبايل",
  "status.synced": "النسخة الاحتياطية متزامنة",
  "status.syncPending": "النسخة الاحتياطية لسه ما اتزامنتش",
  "status.syncFailed": "فشلت مزامنة النسخة الاحتياطية",
  "target.label": "الهدف الجاي",
  "target.none": "مفيش هدف لسه. خلّص تمرينة فيها التمرين ده وGAIN هيكتب هدف.",
  "target.notEnough": "التاريخ مش كفاية لسه",
};
