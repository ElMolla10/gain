/**
 * Strings for rest timer settings and the end-of-rest alert. English is the source.
 * ARABIC IS A DRAFT TRANSLATION (Egyptian-leaning): needs review by Egyptian lifters.
 */
export const enRest = {
  "rest.settings": "Rest timer",
  "rest.default": "Default rest",
  "rest.defaultValue": "{n} s",
  "rest.vibrate": "Vibrate when rest ends",
  "rest.notify": "Alert when rest ends, even with the screen off",
  "rest.on": "On",
  "rest.off": "Off",
  "rest.notifyNote": "Uses a notification. Phones with strict battery savers can delay it; if it comes late, set GAIN to unrestricted battery use in the phone's settings.",
  "rest.perm.denied": "Notifications are blocked for GAIN. Allow them in the phone's settings to get the alert.",
  "rest.perm.unavailable": "Notifications are not available on this phone.",
  "rest.alert.title": "Rest is over",
  "rest.alert.body": "Ready for your next set.",
} as const;

export const arRest: Record<keyof typeof enRest, string> = {
  "rest.settings": "مؤقت الراحة",
  "rest.default": "الراحة الافتراضية",
  "rest.defaultValue": "{n} ث",
  "rest.vibrate": "اهتز لما الراحة تخلص",
  "rest.notify": "نبّهني لما الراحة تخلص، حتى والشاشة مقفولة",
  "rest.on": "شغّال",
  "rest.off": "مقفول",
  "rest.notifyNote": "بيستخدم إشعار. الموبايلات اللي فيها توفير بطارية شديد ممكن تأخره؛ لو جه متأخر، خلّي GAIN بدون قيود بطارية من إعدادات الموبايل.",
  "rest.perm.denied": "الإشعارات متقفلة لـ GAIN. افتحها من إعدادات الموبايل عشان التنبيه يشتغل.",
  "rest.perm.unavailable": "الإشعارات مش متاحة على الموبايل ده.",
  "rest.alert.title": "الراحة خلصت",
  "rest.alert.body": "جاهز للمجموعة الجاية.",
};
