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
  "finish.noSets": "No sets were logged in this workout, so there is nothing to count and no new targets from it.",
  "finish.countedLabel": "working sets counted",
  "prog.dayMeta": "{n} exercises · {sets} sets",
  "pick.filters": "Filters",
  "prog.more": "Programme details",
  "today.meta": "{sets} sets · ~{min} min",
  "today.targets": "Next targets",
  "today.noTargetsYet": "Targets appear here after your first finished workout.",
  "today.planned": "Plan {plan}",
  "today.setupPlan": "Set up a plan",
} as const;

export const arDesign: Record<keyof typeof enDesign, string> = {
  "status.savedLocal": "محفوظ على الموبايل",
  "status.synced": "النسخة الاحتياطية متزامنة",
  "status.syncPending": "النسخة الاحتياطية لسه ما اتزامنتش",
  "status.syncFailed": "فشلت مزامنة النسخة الاحتياطية",
  "target.label": "الهدف الجاي",
  "target.none": "مفيش هدف لسه. خلّص تمرينة فيها التمرين ده وGAIN هيكتب هدف.",
  "target.notEnough": "التاريخ مش كفاية لسه",
  "finish.noSets": "مفيش مجموعات اتسجلت في التمرينة دي، فمفيش حاجة تتحسب ولا أهداف جديدة منها.",
  "finish.countedLabel": "مجموعات شغل اتحسبت",
  "prog.dayMeta": "{n} تمارين · {sets} مجموعات",
  "pick.filters": "الفلاتر",
  "prog.more": "تفاصيل البرنامج",
  "today.meta": "{sets} مجموعات · حوالي {min} د",
  "today.targets": "الأهداف الجاية",
  "today.noTargetsYet": "الأهداف هتظهر هنا بعد أول تمرينة تخلصها.",
  "today.planned": "الخطة {plan}",
  "today.setupPlan": "جهّز خطة",
};
