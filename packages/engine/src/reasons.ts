import type { ReasonKey, ReasonText } from "./types";

export type Locale = "en" | "ar";

/**
 * Default reason sentences. The mobile app may use its own i18n catalogue with the same keys + params.
 * Numbers stay Western digits so they read the same in RTL. Arabic text is a first draft: a native speaker
 * (ideally a trainer from an Egyptian gym) should review it before release.
 */
const templates: Record<Locale, Record<ReasonKey, string>> = {
  en: {
    reps_in_range: "Stay at {load} {unit}, aim for {reps}, the next {equipment} is {nextLoad}.",
    reps_rebuild: "Stay at {load} {unit} and aim for {reps}. Last time you got {lastReps}, below the {lo}-{hi} range.",
    effort_harder:
      "Stay at {load} {unit} for {reps}, but aim to leave {rir} in reserve. The next {equipment} is {nextLoad}, a big jump.",
    quality_change: "Stay at {load} {unit} for {reps}, with {quality}. The next {equipment} is {nextLoad}, a big jump.",
    load_up: "Go up to {load} {unit} for {reps}. You hit {lastReps} at {prevLoad} {unit}.",
    step_down: "Go down to {load} {unit} for {reps}. Two sessions in a row were below {lo} reps at {prevLoad} {unit}.",
    hold_jump_declined:
      "Stay at {load} {unit} for {reps}. You have declined the jump to {nextLoad} {unit} {count} times, so it will not be proposed again.",
    hold_no_heavier_load: "Stay at {load} {unit} for {reps}. There is no heavier {equipment} in this gym.",
    hold_assisted_floor:
      "Stay at {load} {unit} assistance and keep aiming for {reps}. That is the least assistance this machine has.",
    low_confidence_repeat:
      "Repeat {load} {unit} for {reps}. There is not enough comparable history to push yet, so this is a smaller step on purpose.",
    no_history:
      "No comparable history for this lift in this gym, so nothing is proposed. Log a first set and the next session will have a target.",
    no_gym_loads:
      "This gym has no loads saved for {equipment}, so no weight is proposed. Add the loads that exist and try again.",
  },
  ar: {
    reps_in_range: "ابقَ على {load} {unit}، وحاول تعمل {reps}، الـ{equipment} اللي بعده {nextLoad}.",
    reps_rebuild: "ابقَ على {load} {unit} وحاول توصل {reps}. آخر مرة عملت {lastReps}، أقل من النطاق {lo}-{hi}.",
    effort_harder:
      "ابقَ على {load} {unit} لـ{reps}، بس سيب {rir} عدّات في الاحتياطي. الـ{equipment} اللي بعده {nextLoad}، قفزة كبيرة.",
    quality_change: "ابقَ على {load} {unit} لـ{reps}، مع {quality}. الـ{equipment} اللي بعده {nextLoad}، قفزة كبيرة.",
    load_up: "ارفع لـ{load} {unit} لـ{reps}. عملت {lastReps} على {prevLoad} {unit}.",
    step_down: "انزل لـ{load} {unit} لـ{reps}. آخر جلستين كانوا أقل من {lo} عدّات على {prevLoad} {unit}.",
    hold_jump_declined: "ابقَ على {load} {unit} لـ{reps}. رفضت القفزة لـ{nextLoad} {unit} {count} مرات، فمش هقترحها تاني.",
    hold_no_heavier_load: "ابقَ على {load} {unit} لـ{reps}. مفيش {equipment} أتقل في الجيم ده.",
    hold_assisted_floor: "ابقَ على مساعدة {load} {unit} وكمّل حاول تعمل {reps}. دي أقل مساعدة في الجهاز ده.",
    low_confidence_repeat: "كرّر {load} {unit} لـ{reps}. مفيش تاريخ كفاية للمقارنة عشان ندفعك، فده خطوة أصغر عن قصد.",
    no_history: "مفيش تاريخ يتقارن للتمرين ده في الجيم ده، فمفيش اقتراح. سجّل أول مجموعة والجلسة الجاية هيبقى فيها هدف.",
    no_gym_loads: "الجيم ده مفيهوش أوزان محفوظة لـ{equipment}، فمفيش وزن مقترح. ضيف الأوزان الموجودة وجرّب تاني.",
  },
};

const withoutNext: Record<Locale, string> = {
  en: "Stay at {load} {unit}, aim for {reps}.",
  ar: "ابقَ على {load} {unit}، وحاول تعمل {reps}.",
};

export const equipmentNames: Record<Locale, Record<string, string>> = {
  en: {
    dumbbell: "dumbbell",
    barbell: "barbell load",
    plate: "plate load",
    cable: "cable stack setting",
    machine: "machine setting",
    assisted: "assistance setting",
  },
  ar: {
    dumbbell: "دمبل",
    barbell: "وزن البار",
    plate: "وزن البلاطات",
    cable: "وزن الكابل",
    machine: "وزن الماكينة",
    assisted: "مساعدة الجهاز",
  },
};

export const qualityNames: Record<Locale, Record<string, string>> = {
  en: { pause: "a one-second pause", slow_eccentric: "a slower lowering", extra_set: "one extra set" },
  ar: { pause: "وقفة ثانية", slow_eccentric: "نزول أبطأ", extra_set: "مجموعة زيادة" },
};

/** Turn a reason key + params into a sentence. Unknown params are left visible as {name} rather than hidden. */
export function renderReason(reason: ReasonText, locale: Locale = "en"): string {
  let tpl = templates[locale][reason.key];
  if (reason.key === "reps_in_range" && reason.params.nextLoad === undefined) tpl = withoutNext[locale];
  return tpl.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = reason.params[name];
    if (v === undefined) return m;
    if (name === "equipment") return equipmentNames[locale][String(v)] ?? String(v);
    if (name === "quality") return qualityNames[locale][String(v)] ?? String(v);
    return String(v);
  });
}
