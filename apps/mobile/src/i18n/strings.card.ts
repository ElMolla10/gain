/**
 * Strings for the coach card (a PDF the lifter shares). English is the source.
 * ARABIC IS A DRAFT TRANSLATION (Egyptian-leaning): needs review by Egyptian lifters.
 */
export const enCard = {
  "card.share": "Share coach card (PDF)",
  "card.sharing": "Making the card…",
  "card.title": "GAIN training card",
  "card.date": "Session date: {date}",
  "card.done": "What I did",
  "card.topSet": "Top set: {load} × {reps}",
  "card.topSetTimed": "Best set: {q}",
  "card.next": "Next targets: {day}",
  "card.nextNone": "Next targets",
  "card.noNext": "No next session planned yet.",
  "card.pace": "Goal pace",
  "card.notDoctor": "Shared by the lifter from their own training log. GAIN is not a doctor or a coach and this is not medical advice. Targets are suggestions; the lifter decides.",
  "card.failed": "Could not make or share the card: {detail}",
  "card.noSharing": "Sharing is not available on this phone.",
} as const;

export const arCard: Record<keyof typeof enCard, string> = {
  "card.share": "شارك كارت المدرب (PDF)",
  "card.sharing": "بجهّز الكارت…",
  "card.title": "كارت تمرين GAIN",
  "card.date": "تاريخ التمرينة: {date}",
  "card.done": "اللي عملته",
  "card.topSet": "أتقل سيت: {load} × {reps}",
  "card.topSetTimed": "أحسن سيت: {q}",
  "card.next": "الأهداف الجاية: {day}",
  "card.nextNone": "الأهداف الجاية",
  "card.noNext": "لسه مفيش تمرينة جاية متحضّرة.",
  "card.pace": "سرعة الوصول للهدف",
  "card.notDoctor": "اللاعب هو اللي بيشاركه من سجل تمرينه. GAIN مش دكتور ولا مدرب، والكلام ده مش نصيحة طبية. الأهداف مجرد اقتراحات واللاعب هو اللي بيقرر.",
  "card.failed": "معرفتش أعمل الكارت أو أشاركه: {detail}",
  "card.noSharing": "المشاركة مش متاحة على التليفون ده.",
};
