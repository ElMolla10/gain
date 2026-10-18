/**
 * Strings for the logger 10x, "The Rack" (design pack /workspace/plate/design-10x/02-logger). English is the source.
 * Every Arabic string here is a DRAFT for native review (marked `// DRAFT ar`).
 */
export const enRack = {
  "load.change.add": "+{plates} each side",
  "load.change.strip": "Strip the {plates}s",
  "load.change.swap": "Swap {from} for {to} each side",
  "load.change.bar": "Bar only",
  "load.change.nearest": "Nearest you can load: {load}",
  "load.change.horn": "+{plates} on each horn",
  "load.change.grab": "Grab the {load}s",
  "load.change.pin": "Pin to {load}",
  "load.change.stack": "{load} on the stack",
  "load.change.assist": "Assistance {from} {arrow} {to} (less is stronger)",
  "load.change.work": "{change}: work sets",
  "load.change.backoff": "{change}: back-off sets",
  "rack.log": "Log set",
  "rack.update": "Update set {n}",
  "rack.reason.fixWeight": "Fix the weight to log",
  "rack.reason.fixReps": "Fix the reps to log",
  "rack.reason.fixEffort": "Fix the RIR to log",
  "rack.reason.empty": "Type the weight and reps to log",
  "rack.done": "All {n} sets logged",
  "rack.a11y.group": "{set}, {exercise}. {what}",
  "rack.a11y.what": "{load} for {reps} reps",
  "rack.a11y.log": "Log {set} of {exercise}",
  "rack.a11y.logged": "{set} logged. Next: {next}",
  "rack.a11y.loggedLast": "{set} logged",
  "rack.expand": "Show plates and warm-ups",
  "rack.perSide": "per side {plates}",
  "rack.beatLast": "beat last time",
  "rack.fold.a11y": "{exercise}, {n} sets done: {summary}",
  "rack.fold.hint": "Shows the sets",
  "rack.menu.rest": "Rest after this exercise: {time}",
  "rack.menu.pain": "Report pain or dizziness",
  "rack.savedShort": "Saved {time}",
  "rack.setsOf": "{x} of {y} sets",
} as const;

export const arRack: Record<keyof typeof enRack, string> = {
  // DRAFT ar
  "load.change.add": "حمّل {plates} في كل ناحية",
  // DRAFT ar
  "load.change.strip": "شيل الـ{plates}",
  // DRAFT ar
  "load.change.swap": "بدّل {from} بـ{to} في كل ناحية",
  // DRAFT ar
  "load.change.bar": "البار فاضي",
  // DRAFT ar
  "load.change.nearest": "أقرب وزن تقدر تحمّله: {load}",
  // DRAFT ar
  "load.change.horn": "حمّل {plates} على كل ناحية",
  // DRAFT ar
  "load.change.grab": "هات الـ{load}",
  // DRAFT ar
  "load.change.pin": "حط البن على {load}",
  // DRAFT ar
  "load.change.stack": "{load} على الستاك",
  // DRAFT ar
  "load.change.assist": "المساعدة {from} {arrow} {to} (الأقل أقوى)",
  // DRAFT ar
  "load.change.work": "{change}: المجموعات الأساسية",
  // DRAFT ar
  "load.change.backoff": "{change}: مجموعات أخف",
  // DRAFT ar
  "rack.log": "سجّل المجموعة",
  // DRAFT ar
  "rack.update": "حدّث المجموعة {n}",
  // DRAFT ar
  "rack.reason.fixWeight": "صلّح الوزن عشان تسجّل",
  // DRAFT ar
  "rack.reason.fixReps": "صلّح العدّات عشان تسجّل",
  // DRAFT ar
  "rack.reason.fixEffort": "صلّح الـRIR عشان تسجّل",
  // DRAFT ar
  "rack.reason.empty": "اكتب الوزن والعدّات عشان تسجّل",
  // DRAFT ar
  "rack.done": "اتسجّلت كل المجموعات ({n})",
  // DRAFT ar
  "rack.a11y.group": "{set}، {exercise}. {what}",
  // DRAFT ar
  "rack.a11y.what": "{load} لعدد {reps}",
  // DRAFT ar
  "rack.a11y.log": "سجّل {set} من {exercise}",
  // DRAFT ar
  "rack.a11y.logged": "اتسجّلت {set}. اللي بعدها: {next}",
  // DRAFT ar
  "rack.a11y.loggedLast": "اتسجّلت {set}",
  // DRAFT ar
  "rack.expand": "اعرض الأطباق والتسخين",
  // DRAFT ar
  "rack.perSide": "في كل ناحية {plates}",
  // DRAFT ar
  "rack.beatLast": "زِدت عن المرة اللي فاتت",
  // DRAFT ar
  "rack.fold.a11y": "{exercise}، المجموعات اللي خلصت: {n}. {summary}",
  // DRAFT ar
  "rack.fold.hint": "يعرض المجموعات",
  // DRAFT ar
  "rack.menu.rest": "الراحة بعد التمرين ده: {time}",
  // DRAFT ar
  "rack.menu.pain": "بلّغ عن ألم أو دوخة",
  // DRAFT ar
  "rack.savedShort": "اتحفظ {time}",
  // DRAFT ar
  "rack.setsOf": "{x} من {y} مجموعة",
};
