/** Training-day reminders (opt-in). ARABIC IS A DRAFT, still to be reviewed. No streak or guilt wording by design (tested). */
export const enRemind = {
  "remind.settings": "Training-day reminders",
  "remind.intro": "Off by default. Pick the days you usually train and a time; GAIN sends one quiet notification on those days. It stays on your phone.",
  "remind.on": "On",
  "remind.off": "Off",
  "remind.days": "Days",
  "remind.hour": "Hour",
  "remind.minute": "Minute",
  "remind.pickDays": "Pick at least one day, otherwise nothing is scheduled.",
  "remind.perm.denied": "Notifications are not allowed for GAIN. You can allow them in the phone's settings.",
  "remind.perm.unavailable": "Notifications are not available on this phone.",
  "remind.failed": "The reminder could not be scheduled on this phone.",
  "remind.title": "Training day",
  "remind.body": "Open GAIN to see today's workout.",
  "remind.note": "Not checked on a real phone yet: some phones' battery savers delay or block notifications.",
} as const;

export const arRemind: Record<keyof typeof enRemind, string> = {
  "remind.settings": "تذكير بأيام التمرين",
  "remind.intro": "مقفول في الأول. اختار الأيام اللي بتتمرن فيها ووقت، وGAIN يبعتلك إشعار هادي في الأيام دي. ده بيفضل على موبايلك.",
  "remind.on": "شغّال",
  "remind.off": "مقفول",
  "remind.days": "الأيام",
  "remind.hour": "الساعة",
  "remind.minute": "الدقيقة",
  "remind.pickDays": "اختار يوم واحد على الأقل، غير كده مفيش حاجة هتتجدول.",
  "remind.perm.denied": "الإشعارات مش مسموحة لـ GAIN. تقدر تسمح بيها من إعدادات الموبايل.",
  "remind.perm.unavailable": "الإشعارات مش متاحة على الموبايل ده.",
  "remind.failed": "التذكير ماقدرش يتجدول على الموبايل ده.",
  "remind.title": "يوم تمرين",
  "remind.body": "افتح GAIN وشوف تمرينة النهارده.",
  "remind.note": "لسه ما اتجربش على موبايل حقيقي: موفّر البطارية في بعض الموبايلات بيأخر الإشعارات أو بيمنعها.",
};
