/** Strings added by the fixes-only release (error states and the like). Arabic is a draft. */
export const enFixes = {
  "today.error.title": "Could not load your plan",
  "today.error.body": "Your data on this phone has not been changed. Try again; if it keeps failing, restart the app.",
  "today.error.retry": "Try again",
  "workout.loadError.title": "Could not open this workout",
  "workout.loadError.body": "Nothing was changed. Try again.",
  "workout.finishFailed.title": "Could not finish the workout",
  "workout.finishFailed.body": "Your workout is still open and every set you ticked is saved on this phone. Try Finish again.",
  "workout.finishFailed.retry": "Try Finish again",
  "finish.error.title": "Could not load the summary",
  "finish.error.retry": "Try again",
} as const;

export const arFixes: Record<keyof typeof enFixes, string> = {
  "today.error.title": "معرفتش أفتح خطتك",
  "today.error.body": "بياناتك على الموبايل ما اتغيرتش. جرّب تاني، ولو لسه بتفشل اقفل التطبيق وافتحه.",
  "today.error.retry": "جرّب تاني",
  "workout.loadError.title": "معرفتش أفتح التمرينة دي",
  "workout.loadError.body": "ما اتغيرش حاجة. جرّب تاني.",
  "workout.finishFailed.title": "معرفتش أخلّص التمرينة",
  "workout.finishFailed.body": "التمرينة لسه مفتوحة وكل مجموعة علّمت عليها متسجلة على الموبايل. دوس خلّص تاني.",
  "workout.finishFailed.retry": "جرّب خلّص تاني",
  "finish.error.title": "معرفتش أحمّل الملخص",
  "finish.error.retry": "جرّب تاني",
};
