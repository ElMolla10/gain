/**
 * Strings for rest timer settings and the end-of-rest alert. English is the source.
 * ARABIC IS A DRAFT TRANSLATION (Egyptian-leaning): needs review by Egyptian lifters.
 */
export const enRest = {
  "rest.settings": "Rest timer",
  "rest.default": "Default rest",
  "rest.defaultValue": "{n} s",
  "rest.auto": "Start rest after each set",
  "workout.keepAwake": "Keep screen on during workouts",
  "workout.keepAwake.note": "Your phone won't lock while the workout screen is open. It locks as usual everywhere else.",
  "health.apple.save": "Save workouts to Apple Health",
  "health.apple.note": "Adds each finished workout (start, end, duration) to the Health app. GAIN doesn't read anything from Health.",
  "health.apple.denied": "Allow GAIN in Settings → Health → Data Access to turn this on.",
  "rest.vibrate": "Vibrate when rest ends",
  "rest.notify": "Alert when rest ends, even with the screen off",
  "rest.on": "On",
  "rest.off": "Off",
  "rest.notifyNote": "Uses a notification. Phones with strict battery savers can delay it; if it comes late, set GAIN to unrestricted battery use in the phone's settings.",
  "rest.notifyNote.ios": "Uses a notification so the alert arrives with the phone locked. If it doesn't, allow notifications for GAIN in iPhone Settings.",
  "rest.perm.denied": "Notifications are blocked for GAIN. Allow them in the phone's settings to get the alert.",
  "rest.perm.unavailable": "Notifications are not available on this phone.",
  "rest.alert.title": "Rest is over",
  "rest.alert.body": "Ready for your next set.",
} as const;

export const arRest: Record<keyof typeof enRest, string> = {
  "rest.settings": "مؤقت الراحة",
  "rest.default": "الراحة الافتراضية",
  "rest.defaultValue": "{n} ث",
  "rest.auto": "ابدأ الراحة بعد كل مجموعة",
  "workout.keepAwake": "خلي الشاشة شغالة أثناء التمرين",
  "workout.keepAwake.note": "موبايلك مش هيقفل وانت فاتح شاشة التمرين. في أي مكان تاني بيقفل عادي.",
  // Brand names stay LTR-isolated inside the Arabic text.
  "health.apple.save": "احفظ التمارين في \u2066Apple Health\u2069",
  "health.apple.note": "بيضيف كل تمرين خلص (البداية والنهاية والمدة) لتطبيق \u2066Health\u2069. \u2066GAIN\u2069 مش بيقرا أي حاجة من \u2066Health\u2069.",
  "health.apple.denied": "اسمح لـ \u2066GAIN\u2069 من الإعدادات ← \u2066Health\u2069 ← الوصول للبيانات عشان تشغلها.",
  "rest.vibrate": "اهتز لما الراحة تخلص",
  "rest.notify": "نبّهني لما الراحة تخلص، حتى والشاشة مقفولة",
  "rest.on": "شغّال",
  "rest.off": "مقفول",
  "rest.notifyNote": "بيستخدم إشعار. الموبايلات اللي فيها توفير بطارية شديد ممكن تأخره؛ لو جه متأخر، خلّي GAIN بدون قيود بطارية من إعدادات الموبايل.",
  "rest.notifyNote.ios": "بيستخدم إشعار عشان التنبيه يوصلك والموبايل مقفول. لو ما وصلش، اسمح بالإشعارات لـ GAIN من إعدادات الآيفون.",
  "rest.perm.denied": "الإشعارات متقفلة لـ GAIN. افتحها من إعدادات الموبايل عشان التنبيه يشتغل.",
  "rest.perm.unavailable": "الإشعارات مش متاحة على الموبايل ده.",
  "rest.alert.title": "الراحة خلصت",
  "rest.alert.body": "جاهز للمجموعة الجاية.",
};
