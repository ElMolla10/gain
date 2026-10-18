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
  "warm.add": "ضيف تسخين",
  "warm.addAnyway": "غالباً مش محتاج تسخين هنا. ضيف برضو",
  "warm.title": "تسخين لـ {load}",
  "warm.note": "متحسوب من هدف النهارده على أوزان موجودة. بيتسجل كتسخين ومبيغيّرش هدفك الجاي.",
  "warm.confirm": "ضيف التسخين ده",
  "warm.cancel": "مش دلوقتي",
  "warm.added": "اتضاف التسخين.",
  "warm.none.no_target": "التسخين محتاج وزن هدف. اقبل واحد أو حدده الأول، أو سجّل تسخينك بنفسك.",
  "warm.none.already_started": "سجلت مجموعات للتمرين ده النهارده.",
  "warm.none.assisted": "مفيش تسخين للحركات بمساعدة.",
  "warm.none.too_light": "الهدف خفيف جداً ومش محتاج تسخين.",
  "warm.none.no_loads": "مفيش أوزان معروفة للجهاز ده، فمقدرش أختار أوزان التسخين.",
};
