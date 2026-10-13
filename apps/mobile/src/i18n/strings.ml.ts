export const enMl = {
  "ml.title": "ML Accuracy · Experimental",
  "ml.note": "This device, current model only. Confirmed working sets at the predicted weight. Edited, skipped and mismatched sets are excluded. These are logged repetitions, not measured capacity.",
  "ml.count": "Evaluated predictions: {n}",
  "ml.mae": "Mean absolute error: {n} reps",
  "ml.one": "Within ±1 rep: {n}%",
  "ml.two": "Within ±2 reps: {n}%",
  "ml.empty": "No evaluated predictions yet. Accuracy appears after eligible predicted sets are logged and confirmed.",
  "ml.failed": "Could not load accuracy. Reopen Settings to retry.",
};
// Draft Arabic, like the existing experimental adaptation strings.
export const arMl: Record<keyof typeof enMl, string> = {
  "ml.title": "دقة النموذج · تجريبي",
  "ml.note": "على الجهاز ده وللنموذج الحالي فقط. مجموعات عمل مؤكدة بنفس الوزن المتوقع. التعديل والتخطي واختلاف الوزن مستبعدين. الأرقام للتكرارات المسجلة، مش قياس القدرة القصوى.",
  "ml.count": "التوقعات اللي اتقيّمت: {n}",
  "ml.mae": "متوسط الخطأ المطلق: {n} تكرار",
  "ml.one": "في حدود ±1 تكرار: {n}%",
  "ml.two": "في حدود ±2 تكرار: {n}%",
  "ml.empty": "لسه مفيش توقعات اتقيّمت. الدقة هتظهر بعد تسجيل وتأكيد مجموعات مؤهلة لها توقع.",
  "ml.failed": "مش قادرين نعرض الدقة. افتح الإعدادات تاني للمحاولة.",
};
