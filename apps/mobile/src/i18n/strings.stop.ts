/**
 * Strings for "Things I've stopped suggesting" and the finish-screen notice. English is the source.
 * ARABIC IS A DRAFT TRANSLATION (Egyptian-leaning): needs review by Egyptian lifters.
 */
export const enStop = {
  "stop.entry": "Things I've stopped suggesting",
  "stop.title": "Stopped suggestions",
  "stop.intro": "When you decline the same kind of jump 3 times on a lift, I stop proposing it. Here is every jump you have declined. Bring one back and I may suggest it again.",
  "stop.empty": "You have not declined any jump yet.",
  "stop.stopped": "Stopped",
  "stop.counting": "Declined {count} of {max} times",
  "stop.last": "Last declined {date}",
  "stop.bringBack": "Bring it back",
  "stop.undo": "Undo",
  "stop.restored": "Brought back. I may suggest this jump again.",
  "stop.undone": "Put back as it was.",
  "stop.undoFailed": "That jump was declined again meanwhile, so nothing was changed.",
  "stop.jump.heavier": "Heavier by {delta}",
  "stop.jump.lighter": "Lighter by {delta}",
  "stop.jump.effort": "Closer to failure ({rir} reps in reserve)",
  "stop.jump.pause": "Add a pause",
  "stop.jump.slow_eccentric": "Slower lowering",
  "stop.jump.extra_set": "Add a set",
  "stop.notice.stopped": "You have declined this jump ({jump}) {count} times, so I will stop suggesting it for this lift. You can bring it back in Settings, under Things I've stopped suggesting.",
  "stop.notice.counting": "Declined: {jump}. {count} of {max}. After {max} I stop suggesting it.",
} as const;

export const arStop: Record<keyof typeof enStop, string> = {
  "stop.entry": "حاجات وقفت أقترحها",
  "stop.title": "اقتراحات موقوفة",
  "stop.intro": "لما ترفض نفس نوع القفزة 3 مرات في تمرين، بوقف أقترحها. هنا كل قفزة رفضتها. رجّع واحدة وممكن أقترحها تاني.",
  "stop.empty": "لسه مرفضتش أي قفزة.",
  "stop.stopped": "موقوفة",
  "stop.counting": "اترفضت {count} من {max} مرات",
  "stop.last": "آخر رفض {date}",
  "stop.bringBack": "رجّعها",
  "stop.undo": "تراجع",
  "stop.restored": "رجعت. ممكن أقترح القفزة دي تاني.",
  "stop.undone": "رجعت زي ما كانت.",
  "stop.undoFailed": "القفزة دي اترفضت تاني في الأثناء، فمفيش حاجة اتغيرت.",
  "stop.jump.heavier": "أتقل بمقدار {delta}",
  "stop.jump.lighter": "أخف بمقدار {delta}",
  "stop.jump.effort": "أقرب للفشل ({rir} تكرار احتياطي)",
  "stop.jump.pause": "زوّد وقفة",
  "stop.jump.slow_eccentric": "نزول أبطأ",
  "stop.jump.extra_set": "زوّد مجموعة",
  "stop.notice.stopped": "رفضت القفزة دي ({jump}) {count} مرات، فهوقف أقترحها للتمرين ده. تقدر ترجّعها من الإعدادات، تحت حاجات وقفت أقترحها.",
  "stop.notice.counting": "اترفضت: {jump}. {count} من {max}. بعد {max} هوقف أقترحها.",
};
