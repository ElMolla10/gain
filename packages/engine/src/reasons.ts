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
    step_down: "Go down to {load} {unit} for {reps}. {misses} sessions in a row were below {lo} reps at {prevLoad} {unit}.",
    stall_deload:
      "Go down to {load} {unit} for {reps}, about {pct}% lighter. {sessions} sessions at {prevLoad} {unit} without more reps: a lighter week, then build again.",
    confirm_top_of_range:
      "Stay at {load} {unit} and repeat {reps}. That is {have} of {need} sessions at the top; the next one earns more load.",
    partial_session:
      "Stay at {load} {unit} and repeat {reps} on all {planned} sets. Last time only {done} of {planned} sets were done at {load} {unit}, so it does not earn more load yet.",
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
    timed_longer: "Stay at {load} {unit}, aim for {target} {qunit}. Last time your weakest set was {last} {qunit}; a little longer each time.",
    timed_rebuild: "Stay at {load} {unit} and aim for {target} {qunit}. Last time you got {last} {qunit}, below the {lo}-{hi} {qunit} range.",
    timed_repeat: "Repeat {load} {unit} for {target} {qunit}. There is not enough comparable history to push yet, so this is a smaller step on purpose.",
    timed_confirm: "Stay at {load} {unit} and repeat {target} {qunit}. That is {have} of {need} sessions at the top; the next one earns more load.",
    timed_load_up: "Go up to {load} {unit} and aim for {target} {qunit}. You reached {last} {qunit} at {prevLoad} {unit}.",
    timed_hold_top: "Stay at {load} {unit} for {target} {qunit}. You are at the top of your range and there is no heavier {equipment} in this gym; raise the range in the programme when you want a longer target.",
    timed_hold_declined: "Stay at {load} {unit} for {target} {qunit}. You have declined the jump to {nextLoad} {unit} {count} times, so it will not be proposed again.",
  },
  ar: {
    reps_in_range: "ابقَ على {load} {unit}، وحاول تعمل {reps}، الـ{equipment} اللي بعده {nextLoad}.",
    reps_rebuild: "ابقَ على {load} {unit} وحاول توصل {reps}. آخر مرة عملت {lastReps}، أقل من النطاق {lo}-{hi}.",
    effort_harder:
      "ابقَ على {load} {unit} لـ{reps}، بس سيب {rir} عدّات في الاحتياطي. الـ{equipment} اللي بعده {nextLoad}، قفزة كبيرة.",
    quality_change: "ابقَ على {load} {unit} لـ{reps}، مع {quality}. الـ{equipment} اللي بعده {nextLoad}، قفزة كبيرة.",
    load_up: "ارفع لـ{load} {unit} لـ{reps}. عملت {lastReps} على {prevLoad} {unit}.",
    step_down: "انزل لـ{load} {unit} لـ{reps}. آخر {misses} جلسات كانوا أقل من {lo} عدّات على {prevLoad} {unit}.",
    stall_deload: "انزل لـ{load} {unit} لـ{reps}، أخف بحوالي {pct}%. {sessions} جلسات على {prevLoad} {unit} من غير عدّات زيادة: أسبوع أخف وبعدها نبني تاني.",
    confirm_top_of_range: "ابقَ على {load} {unit} وكرّر {reps}. دي {have} من {need} جلسات في القمة، والجاية تستاهل وزن أكتر.",
    partial_session: "ابقَ على {load} {unit} وكرّر {reps} في كل الـ{planned} مجموعات. آخر مرة اتعمل {done} من {planned} مجموعات بس على {load} {unit}، فلسه ما استاهلتش وزن أكتر.",
    hold_jump_declined: "ابقَ على {load} {unit} لـ{reps}. رفضت القفزة لـ{nextLoad} {unit} {count} مرات، فمش هقترحها تاني.",
    hold_no_heavier_load: "ابقَ على {load} {unit} لـ{reps}. مفيش {equipment} أتقل في الجيم ده.",
    hold_assisted_floor: "ابقَ على مساعدة {load} {unit} وكمّل حاول تعمل {reps}. دي أقل مساعدة في الجهاز ده.",
    low_confidence_repeat: "كرّر {load} {unit} لـ{reps}. مفيش تاريخ كفاية للمقارنة عشان ندفعك، فده خطوة أصغر عن قصد.",
    no_history: "مفيش تاريخ يتقارن للتمرين ده في الجيم ده، فمفيش اقتراح. سجّل أول مجموعة والجلسة الجاية هيبقى فيها هدف.",
    no_gym_loads: "الجيم ده مفيهوش أوزان محفوظة لـ{equipment}، فمفيش وزن مقترح. ضيف الأوزان الموجودة وجرّب تاني.",
    timed_longer: "ابقَ على {load} {unit}، وحاول توصل {target} {qunit}. آخر مرة أضعف مجموعة كانت {last} {qunit}؛ شوية أطول كل مرة.",
    timed_rebuild: "ابقَ على {load} {unit} وحاول توصل {target} {qunit}. آخر مرة عملت {last} {qunit}، أقل من النطاق {lo}-{hi} {qunit}.",
    timed_repeat: "كرّر {load} {unit} لمدة {target} {qunit}. مفيش تاريخ كفاية للمقارنة عشان ندفعك، فده خطوة أصغر عن قصد.",
    timed_confirm: "ابقَ على {load} {unit} وكرّر {target} {qunit}. دي {have} من {need} جلسات في القمة، والجاية تستاهل وزن أكتر.",
    timed_load_up: "ارفع لـ{load} {unit} وحاول توصل {target} {qunit}. وصلت {last} {qunit} على {prevLoad} {unit}.",
    timed_hold_top: "ابقَ على {load} {unit} لمدة {target} {qunit}. إنت في قمة النطاق ومفيش {equipment} أتقل في الجيم ده؛ ارفع النطاق في البرنامج لما تحب هدف أطول.",
    timed_hold_declined: "ابقَ على {load} {unit} لمدة {target} {qunit}. رفضت القفزة لـ{nextLoad} {unit} {count} مرات، فمش هقترحها تاني.",
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

/** Unit of a time / distance target: "s" seconds, "m" metres. Arabic letters are a draft for review. */
export const quantityUnits: Record<Locale, Record<string, string>> = {
  en: { s: "s", m: "m" },
  ar: { s: "ث", m: "م" },
};

export const qualityNames: Record<Locale, Record<string, string>> = {
  en: { pause: "a one-second pause", slow_eccentric: "a slower lowering", extra_set: "one extra set" },
  ar: { pause: "وقفة ثانية", slow_eccentric: "نزول أبطأ", extra_set: "مجموعة زيادة" },
};

/** Turn a reason key + params into a sentence. Unknown params are left visible as {name} rather than hidden. */
export function renderReason(reason: ReasonText, locale: Locale = "en"): string {
  let tpl = templates[locale][reason.key];
  // A decision stored under an older (or newer) rule version may use a key this build does not know: show it, never crash.
  if (tpl === undefined) return `${reason.key}${Object.keys(reason.params).length ? ` (${Object.entries(reason.params).map(([k, v]) => `${k}=${String(v)}`).join(", ")})` : ""}`;
  if (reason.key === "reps_in_range" && reason.params.nextLoad === undefined) tpl = withoutNext[locale];
  return tpl.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = reason.params[name];
    if (v === undefined) return m;
    if (name === "equipment") return equipmentNames[locale][String(v)] ?? String(v);
    if (name === "quality") return qualityNames[locale][String(v)] ?? String(v);
    if (name === "qunit") return quantityUnits[locale][String(v)] ?? String(v);
    return String(v);
  });
}
