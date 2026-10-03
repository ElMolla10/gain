/**
 * Plans preview page (Step 24 scaffold). Nothing is for sale: no prices, no purchase button. ARABIC IS A DRAFT, still to be reviewed.
 */
export const enPlans = {
  "plans.entry": "Plans (preview)",
  "plans.title": "Plans",
  "plans.nothing": "Nothing is for sale in this version. Every feature works for everyone, and no price has been set.",
  "plans.free.title": "Free, always",
  "plans.paid.title": "Planned as paid, later",
  "plans.limit": "If GAIN ever charges, this is what would be locked, shown before you pay, so there are no surprises.",
  "plans.records": "Your logged workouts and records stay yours and stay visible if you cancel.",
  "plans.f.logging": "Logging workouts",
  "plans.f.history": "History",
  "plans.f.one_template": "One template to start from",
  "plans.f.basic_charts": "Basic charts",
  "plans.f.export_own_data": "Export your own data",
  "plans.f.next_session_targets": "Next-session targets",
  "plans.f.gym_aware_increments": "Weights that exist in your gym",
  "plans.f.goal_pace": "Goal pace",
  "plans.f.short_week_rebuild": "Short-week rebuild",
  "plans.f.weekly_decision": "Weekly decision",
} as const;

export const arPlans: Record<keyof typeof enPlans, string> = {
  "plans.entry": "الباقات (معاينة)",
  "plans.title": "الباقات",
  "plans.nothing": "مفيش حاجة للبيع في النسخة دي. كل المميزات شغالة للكل ومفيش سعر اتحدد.",
  "plans.free.title": "مجاني دايمًا",
  "plans.paid.title": "مخطط يبقى بفلوس، بعدين",
  "plans.limit": "لو GAIN اتحاسب في يوم، ده اللي هيتقفل، ومعروض قبل ما تدفع عشان مفيش مفاجآت.",
  "plans.records": "تمارينك وأرقامك المسجلة بتاعتك وفاضلة ظاهرة حتى لو لغيت.",
  "plans.f.logging": "تسجيل التمارين",
  "plans.f.history": "التاريخ",
  "plans.f.one_template": "قالب واحد تبدأ منه",
  "plans.f.basic_charts": "رسومات بسيطة",
  "plans.f.export_own_data": "تصدير بياناتك",
  "plans.f.next_session_targets": "أهداف التمرينة الجاية",
  "plans.f.gym_aware_increments": "الأوزان الموجودة في جيمك",
  "plans.f.goal_pace": "ماشي في معاد الهدف",
  "plans.f.short_week_rebuild": "إعادة بناء الأسبوع الزحمة",
  "plans.f.weekly_decision": "القرار الأسبوعي",
};
