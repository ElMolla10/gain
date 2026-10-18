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
};
