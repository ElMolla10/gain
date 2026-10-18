/**
 * Strings for Today 10x, "Today's Bar" (design pack /workspace/plate/design-10x/01-today). English is the source.
 * Every Arabic string here is a DRAFT for native review (marked `// DRAFT ar`).
 */
export const enToday = {
  "today.chip.repUp.one": "{n} rep",
  "today.chip.repUp.few": "{n} reps",
  "today.chip.same": "Same, aim {n}",
  "today.chip.lighter": "Lighter week",
  "today.chip.new": "New",
  "today.chip.edited": "Your edit",
  "today.chip.down": "Lighter",
  "today.nearest": "Nearest you can load: {load} (target {target})",
  "today.emptyBar": "Empty bar",
  "today.pair": "Pair of {load} dumbbells",
  "today.stack": "Stack",
  "today.assist": "Assistance {load} · less is stronger",
  "today.belt": "Bodyweight + {load} on the belt",
  "today.normally": "normally {load}",
  "today.warmups": "Warm-ups",
  "today.horn": "{load} total on the machine",
  "today.unit.kg": "kilograms",
  "today.unit.lb": "pounds",
  "today.a11y.goal": "{name}, goal lift.",
  "today.a11y.target": "Target {load} {unit} for {q}.",
  "today.a11y.timed": "Target {q}.",
  "today.a11y.perSide": "Per side: {plates}.",
  "today.a11y.nearest": "Nearest you can load: {load} {unit}; the target was {target}.",
  "today.a11y.empty": "Empty bar, {load} {unit}.",
  "today.a11y.lighter": "Lighter week: {load} {unit}, normally {normal}.",
  "today.a11y.pair": "A pair of {load} {unit} dumbbells, for {q}.",
  "today.a11y.stack": "Stack {load} {unit} for {q}.",
  "today.a11y.assist": "Assistance {load} {unit}; less assistance is stronger.",
  "today.a11y.belt": "Bodyweight plus {load} {unit} on the belt, for {q}.",
  "today.a11y.horn": "{load} {unit} total on the machine, for {q}.",
  "today.stub.written": "Written {when}, after {day}",
  "today.stub.writtenNoDay": "Written {when}",
  "today.stub.preview": "Preview from your history · saved when you start",
  "today.stub.edited": "You set {load} yourself",
  "today.stub.last": "Last time {last}",
  "today.stub.sets.one": "{n} set",
  "today.stub.sets.few": "{n} sets",
  "today.rack.planned": "Also today · written at the door",
  "today.rack.preview": "Also today · preview from your history",
  "today.rack.a11yTarget": "target {target}",
  "today.rack.expand": "Expand",
  "today.rack.showPlates": "Show plates",
  "today.time.one": "{n} exercise · {sets} sets · ~{min} min · done around {time}",
  "today.time.few": "{n} exercises · {sets} sets · ~{min} min · done around {time}",
  "today.startDay": "Start {day}",
  "today.footerMin": "~{min} min",
  "today.done.title": "Done for today",
  "today.done.next": "Next up: {day}",
  "today.done.summary.one": "Done today: {day}, {n} set.",
  "today.done.summary.few": "Done today: {day}, {n} sets.",
  "today.done.see": "See today's workout",
  "today.done.anyway": "Start {day} anyway",
  "today.open.chip": "{day} is open",
  "today.open.started": "Started {time} · {n} of {total} sets saved on this phone",
  "today.resumeClock": "Resume · {clock} · {n} of {total} sets",
  "today.welcome": "Welcome back. Your numbers are where you left them, {n} days ago.",
  "today.easeIn": "Ease in: back after a break",
  "today.easeIn.note": "Aims 1–2 fewer reps today. You can change it in the workout.",
  "today.lighter": "Lighter week until {date} · normal loads come back after.",
  "today.lighter.undo": "Undo lighter week",
  "today.first.number": "Your first numbers come from your first session.",
  "today.first.note": "Log what you lift; GAIN writes the next one when you finish.",
  "today.noGym": "Add your gym's plates to see what to load.",
} as const;

export const arToday: Record<keyof typeof enToday, string> = {
  // DRAFT ar
  "today.chip.repUp.one": "{n} عدّة",
  // DRAFT ar
  "today.chip.repUp.few": "{n} عدّات",
  // DRAFT ar
  "today.chip.same": "نفس الوزن، هدف {n}",
  // DRAFT ar
  "today.chip.lighter": "أسبوع أخف",
  // DRAFT ar
  "today.chip.new": "جديد",
  // DRAFT ar
  "today.chip.edited": "تعديلك",
  // DRAFT ar
  "today.chip.down": "أخف",
  // DRAFT ar
  "today.nearest": "أقرب وزن تقدر تحمّله: {load} (الهدف {target})",
  // DRAFT ar
  "today.emptyBar": "البار فاضي",
  // DRAFT ar
  "today.pair": "زوج دمبل {load}",
  // DRAFT ar
  "today.stack": "عمود الأوزان",
  // DRAFT ar
  "today.assist": "مساعدة {load} · الأقل أقوى",
  // DRAFT ar
  "today.belt": "وزن جسمك + {load} على الحزام",
  // DRAFT ar
  "today.normally": "عادةً {load}",
  // DRAFT ar
  "today.warmups": "التسخين",
  // DRAFT ar
  "today.horn": "{load} إجمالي على الجهاز",
  // DRAFT ar
  "today.unit.kg": "كيلو",
  // DRAFT ar
  "today.unit.lb": "باوند",
  // DRAFT ar
  "today.a11y.goal": "{name}، تمرين الهدف.",
  // DRAFT ar
  // DRAFT ar
  "today.a11y.target": "الهدف {load} {unit} لعدد {q}.",
  // DRAFT ar
  "today.a11y.timed": "الهدف {q}.",
  // DRAFT ar
  "today.a11y.perSide": "كل ناحية: {plates}.",
  // DRAFT ar
  "today.a11y.nearest": "أقرب وزن تقدر تحمّله: {load} {unit}؛ الهدف كان {target}.",
  // DRAFT ar
  "today.a11y.empty": "البار فاضي، {load} {unit}.",
  // DRAFT ar
  "today.a11y.lighter": "أسبوع أخف: {load} {unit}، عادةً {normal}.",
  // DRAFT ar
  "today.a11y.pair": "زوج دمبل {load} {unit}، لعدد {q}.",
  // DRAFT ar
  "today.a11y.stack": "عمود الأوزان {load} {unit} لعدد {q}.",
  // DRAFT ar
  "today.a11y.assist": "مساعدة {load} {unit}؛ المساعدة الأقل أقوى.",
  // DRAFT ar
  "today.a11y.belt": "وزن جسمك زائد {load} {unit} على الحزام، لعدد {q}.",
  // DRAFT ar
  "today.a11y.horn": "{load} {unit} إجمالي على الجهاز، لعدد {q}.",
  // DRAFT ar
  "today.stub.written": "مكتوبة {when}، بعد {day}",
  // DRAFT ar
  "today.stub.writtenNoDay": "مكتوبة {when}",
  // DRAFT ar
  "today.stub.preview": "معاينة من سجلك · بتتحفظ لما تبدأ",
  // DRAFT ar
  "today.stub.edited": "إنت اللي حددت {load}",
  // DRAFT ar
  "today.stub.last": "آخر مرة {last}",
  // DRAFT ar
  "today.stub.sets.one": "{n} مجموعة",
  // DRAFT ar
  "today.stub.sets.few": "{n} مجموعات",
  // DRAFT ar
  "today.rack.planned": "كمان النهارده · مكتوبة من قبلها",
  // DRAFT ar
  "today.rack.preview": "كمان النهارده · معاينة من سجلك",
  // DRAFT ar
  "today.rack.a11yTarget": "الهدف {target}",
  // DRAFT ar
  "today.rack.expand": "افتح",
  // DRAFT ar
  "today.rack.showPlates": "اعرض الأطباق",
  // DRAFT ar
  "today.time.one": "{n} تمرين · {sets} مجموعات · حوالي {min} د · تخلص حوالي {time}",
  // DRAFT ar
  "today.time.few": "{n} تمارين · {sets} مجموعات · حوالي {min} د · تخلص حوالي {time}",
  // DRAFT ar
  "today.startDay": "ابدأ {day}",
  // DRAFT ar
  "today.footerMin": "حوالي {min} د",
  // DRAFT ar
  "today.done.title": "خلصت النهارده",
  // DRAFT ar
  "today.done.next": "اللي بعده: {day}",
  // DRAFT ar
  "today.done.summary.one": "خلصت النهارده: {day}، {n} مجموعة.",
  // DRAFT ar
  "today.done.summary.few": "خلصت النهارده: {day}، {n} مجموعات.",
  // DRAFT ar
  "today.done.see": "شوف تمرين النهارده",
  // DRAFT ar
  "today.done.anyway": "ابدأ {day} برضه",
  // DRAFT ar
  "today.open.chip": "{day} مفتوح",
  // DRAFT ar
  "today.open.started": "بدأت {time} · {n} من {total} متسجلة على الموبايل ده",
  // DRAFT ar
  "today.resumeClock": "كمّل · {clock} · {n} من {total}",
  // DRAFT ar
  "today.welcome": "أهلاً بيك تاني. أرقامك زي ما سبتها، من {n} يوم.",
  // DRAFT ar
  "today.easeIn": "خفّف البداية: راجع بعد فترة",
  // DRAFT ar
  "today.easeIn.note": "هيهدف لعدّة أو اتنين أقل النهارده. تقدر تغيّره في التمرين.",
  // DRAFT ar
  "today.lighter": "أسبوع أخف لحد {date} · الأوزان العادية بترجع بعده.",
  // DRAFT ar
  "today.lighter.undo": "ألغِ الأسبوع الأخف",
  // DRAFT ar
  "today.first.number": "أول أرقامك هتيجي من أول تمرين.",
  // DRAFT ar
  "today.first.note": "سجّل اللي بترفعه؛ GAIN بيكتب اللي بعده لما تخلص.",
  // DRAFT ar
  "today.noGym": "ضيف أطباق الجيم بتاعك عشان تشوف تحمّل إيه.",
};
