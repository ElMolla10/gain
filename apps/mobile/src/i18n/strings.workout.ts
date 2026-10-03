/** Active workout list (v0.8.0). ARABIC IS A DRAFT TRANSLATION, still to be reviewed. */
export const enWorkout = {
  "workout.logSet": "Log",
  "workout.updateSet": "Update",
  "workout.logged": "Logged",
  "workout.addSet": "Add set",
  "workout.removeSet": "Remove this set",
  "workout.steppers": "− / + buttons",
  "workout.rir": "Left",
  "workout.finishNote": "Only sets you logged are saved. Rows you did not log are left out.",
  "workout.unlogged": "{n} filled rows are not logged yet and will be left out.",
} as const;

export const arWorkout: Record<keyof typeof enWorkout, string> = {
  "workout.logSet": "سجّل",
  "workout.updateSet": "حدّث",
  "workout.logged": "اتسجلت",
  "workout.addSet": "ضيف مجموعة",
  "workout.removeSet": "شيل المجموعة دي",
  "workout.steppers": "أزرار − / +",
  "workout.rir": "فاضل",
  "workout.finishNote": "المجموعات اللي سجلتها بس هي اللي بتتحفظ. الصفوف اللي ما سجلتهاش بتتساب.",
  "workout.unlogged": "{n} صفوف متملية لسه ما اتسجلتش وهتتساب.",
};
