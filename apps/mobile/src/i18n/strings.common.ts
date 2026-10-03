/**
 * Shared words (buttons, equipment names). English is the source.
 * ARABIC IS A DRAFT TRANSLATION written in Egyptian-leaning phrasing: it still needs review by Egyptian lifters and a trainer.
 */
export const enCommon = {
  "common.draftAr": "Arabic text on this screen is a draft translation, still to be reviewed.",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.back": "Back",
  "common.next": "Next",
  "common.delete": "Delete",
  "common.optional": "optional",
  "common.yes": "Yes",
  "common.no": "No",
  "equipment.dumbbell": "Dumbbells",
  "equipment.barbell": "Barbell",
  "equipment.plate": "Plates / dip belt (added load)",
  "equipment.cable": "Cables",
  "equipment.machine": "Machines",
  "equipment.assisted": "Assisted machine (assistance removed)",
} as const;

export const arCommon: Record<keyof typeof enCommon, string> = {
  "common.draftAr": "النص العربي في الشاشة دي ترجمة مبدئية لسه محتاجة مراجعة.",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.back": "رجوع",
  "common.next": "التالي",
  "common.delete": "حذف",
  "common.optional": "اختياري",
  "common.yes": "أيوه",
  "common.no": "لأ",
  "equipment.dumbbell": "دمبل",
  "equipment.barbell": "بار",
  "equipment.plate": "أطباق / حزام الباراليل (وزن إضافي)",
  "equipment.cable": "كابلات",
  "equipment.machine": "ماكينات",
  "equipment.assisted": "ماكينة مساعدة (المساعدة اللي بتتشال)",
};
