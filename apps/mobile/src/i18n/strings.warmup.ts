/**
 * Strings for the warm-up helper in the logger. English is the source.
 * ARABIC IS A DRAFT TRANSLATION (Egyptian-leaning): needs review by Egyptian lifters and a trainer.
 */
export const enWarmup = {
  "warm.add": "Add warm-ups",
  "warm.addAnyway": "Usually no warm-up needed here. Add anyway",
  "warm.title": "Warm-ups for {load}",
  "warm.note": "Built from today's target on standard loads. They are logged as warm-ups and never change your next target.",
  "warm.confirm": "Add these warm-ups",
  "warm.cancel": "Not now",
  "warm.added": "Warm-ups added.",
  "warm.none.no_target": "Warm-ups need a target load. Accept or set one first, or log your own.",
  "warm.none.already_started": "You already logged sets for this exercise today.",
  "warm.none.assisted": "No warm-up ladder for assisted lifts.",
  "warm.none.too_light": "The target is too light to need warm-ups.",
  "warm.none.no_loads": "No loads known for this equipment, so I cannot pick warm-up loads.",
} as const;

export const arWarmup: Record<keyof typeof enWarmup, string> = {
  "warm.add": "ضيف إحماء",
  "warm.addAnyway": "غالباً مش محتاج إحماء هنا. ضيف برضو",
  "warm.title": "إحماء لـ {load}",
  "warm.note": "متحسوب من هدف النهارده على أوزان موجودة. بيتسجل كإحماء ومبيغيّرش هدفك الجاي.",
  "warm.confirm": "ضيف الإحماء ده",
  "warm.cancel": "مش دلوقتي",
  "warm.added": "اتضاف الإحماء.",
  "warm.none.no_target": "الإحماء محتاج وزن هدف. اقبل واحد أو حدده الأول، أو سجّل إحماءك بنفسك.",
  "warm.none.already_started": "سجلت مجموعات للتمرين ده النهارده.",
  "warm.none.assisted": "مفيش إحماء للحركات بمساعدة.",
  "warm.none.too_light": "الهدف خفيف جداً ومش محتاج إحماء.",
  "warm.none.no_loads": "مفيش أوزان معروفة للجهاز ده، فمقدرش أختار أوزان الإحماء.",
};
