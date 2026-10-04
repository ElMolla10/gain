/**
 * Privacy page and health notes (Step 17). DRAFT: NOT LEGALLY REVIEWED. The controller's name, the contact address and the applicable laws
 * (Egypt, EU) are still open (D6). ARABIC IS A DRAFT TRANSLATION, still to be reviewed. The facts in here are checked against the code by
 * test/privacyFlows.test.ts; the full text is docs/PRIVACY-POLICY-DRAFT.md.
 */
export const enPrivacy = {
  "privacy.entry": "Privacy and safety",
  "privacy.title": "Privacy and safety",
  "privacy.draft": "DRAFT: this text has not been reviewed by a lawyer yet. Who runs GAIN (the data controller) and the contact address are still to be filled in.",
  "privacy.local.title": "What stays on your phone",
  "privacy.local.body": "Your workouts, sets, notes, programs, goals, bodyweight entries, height and birthday (if you gave them), settings and the crash log are saved in GAIN's private storage on this phone. By default there is no account and no server: everything stays on this phone. GAIN has no analytics or advertising service, and it does not read your contacts, location, photos or microphone.",
  "privacy.leaves.title": "What can leave your phone, and only when you act",
  "privacy.leaves.update": "Check for updates: contacts GitHub (api.github.com, and github.com to download). GitHub can see your internet address and that you asked. Nothing from your training is sent.",
  "privacy.leaves.sync": "Back up and sync (OFF until you turn it on): uploads your training data (workouts, sets, notes, programs, goals, bodyweight, height, birthday, training settings) to a GAIN server on Cloudflare, tied to a random account and a recovery code, not to your name or email. It is not end-to-end encrypted. While it is on, GAIN contacts the server when the app opens, when you return to it and after you finish a workout. \"Turn off and delete my backup\" erases it from the server.",
  "privacy.leaves.link": "Coach link (only when you tap Share as a link): uploads that one coach card to the same server; anyone with the link can read it until it expires (7 days) or you stop sharing. No bodyweight is on the card.",
  "privacy.leaves.share": "Exports, the coach card and the diagnostics report: created on the phone and shared through Android's share sheet. You choose where they go; GAIN does not send them.",
  "privacy.leaves.backup": "Android may back up app data to your Google account if backup is switched on in your phone's settings. That is Android's feature, not GAIN's, and GAIN cannot see or control it.",
  "privacy.crash.title": "Crash log",
  "privacy.crash.body": "Errors are noted in a small file on the phone (no workout data). It is only shared if you tap Share in Diagnostics. You can switch it off and clear it.",
  "privacy.control.title": "Your control",
  "privacy.control.body": "Settings > Your data exports everything (JSON backup, CSV) and deletes everything on this phone. Deleting data in GAIN does not remove copies you shared or Android backups.",
  "privacy.health.title": "Health and safety",
  "privacy.health.body": "GAIN is a training log and suggestion tool. It is not a doctor, a physiotherapist or a certified coach, and it gives no medical advice. Targets and estimates are suggestions based only on what you logged; you decide what to lift. If you have pain, dizziness, an injury or a medical condition, stop and ask a qualified professional before continuing. Warm up and use safe loads and spotters.",
  "privacy.age": "GAIN is not designed for children. If you are under 18, train under an adult or qualified coach's guidance.",
  "privacy.contact": "Contact: [to be filled in]",
  "health.note": "GAIN is a training aid, not a doctor and not medical advice. Pain, dizziness or injury: stop and see a qualified professional.",
} as const;

export const arPrivacy: Record<keyof typeof enPrivacy, string> = {
  "privacy.entry": "الخصوصية والسلامة",
  "privacy.title": "الخصوصية والسلامة",
  "privacy.draft": "مسودة: النص ده لسه ماتراجعش قانونيًا. مين اللي بيدير GAIN (مسؤول البيانات) وعنوان التواصل لسه هيتكتبوا.",
  "privacy.local.title": "اللي بيفضل على تليفونك",
  "privacy.local.body": "تمارينك ومجموعاتك وملاحظاتك وبرامجك وأهدافك وأوزان جسمك وطولك وتاريخ ميلادك (لو كتبتهم) والإعدادات وسجل الأعطال محفوظين في تخزين GAIN الخاص على التليفون ده. من الأصل مفيش حساب ولا سيرفر: كل حاجة بتفضل على التليفون ده. GAIN مفيهوش خدمة تحليلات أو إعلانات، وما بيقراش جهات اتصالك ولا موقعك ولا صورك ولا الميكروفون.",
  "privacy.leaves.title": "اللي ممكن يخرج من تليفونك، وبس لما إنت تتصرف",
  "privacy.leaves.update": "دوّر على تحديثات: بيتصل بـ GitHub (api.github.com، وgithub.com للتنزيل). GitHub ممكن يشوف عنوان الإنترنت بتاعك وإنك سألت. مفيش حاجة من تمرينك بتتبعت.",
  "privacy.leaves.sync": "النسخ الاحتياطي والمزامنة (مقفولة لحد ما تشغّلها): بترفع بيانات تمرينك (تمارين، مجموعات، ملاحظات، برامج، أهداف، وزن الجسم، الطول، تاريخ الميلاد، إعدادات التمرين) على سيرفر GAIN في Cloudflare، مربوطة بحساب عشوائي ورمز استرجاع، مش باسمك ولا إيميلك. مش مشفّرة من طرف لطرف. وهي شغّالة، GAIN بيتصل بالسيرفر لما التطبيق يفتح ولما ترجعله وبعد ما تخلّص تمرين. \"إيقاف ومسح نسختي\" بيمسحها من السيرفر.",
  "privacy.leaves.link": "رابط المدرب (بس لما تدوس شارك كرابط): بيرفع كارت المدرب ده بس على نفس السيرفر؛ أي حد معاه الرابط يقدر يقراه لحد ما ينتهي (٧ أيام) أو توقّف المشاركة. مفيش وزن جسم على الكارت.",
  "privacy.leaves.share": "التصدير وكارت المدرب وتقرير التشخيص: بيتعملوا على التليفون وبيتشاركوا من قايمة المشاركة بتاعة أندرويد. إنت اللي بتختار يروحوا فين؛ GAIN مش بيبعتهم.",
  "privacy.leaves.backup": "أندرويد ممكن ياخد نسخة احتياطية من بيانات التطبيق على حساب جوجل بتاعك لو النسخ الاحتياطي شغّال في إعدادات تليفونك. ده من أندرويد مش من GAIN، وGAIN ما يقدرش يشوفه ولا يتحكم فيه.",
  "privacy.crash.title": "سجل الأعطال",
  "privacy.crash.body": "الأخطاء بتتسجل في ملف صغير على التليفون (من غير بيانات تمرين). مابيتشاركش غير لو دوست مشاركة في التشخيص. تقدر توقفه وتمسحه.",
  "privacy.control.title": "تحكمك",
  "privacy.control.body": "الإعدادات > بياناتك بتصدّر كل حاجة (نسخة JSON وملف CSV) وبتمسح كل حاجة على التليفون ده. المسح في GAIN مش بيمسح نسخ شاركتها ولا النسخ الاحتياطية بتاعة أندرويد.",
  "privacy.health.title": "الصحة والسلامة",
  "privacy.health.body": "GAIN دفتر تمرين وأداة اقتراحات. مش دكتور ولا أخصائي علاج طبيعي ولا مدرب معتمد، ومبيدّيش نصيحة طبية. الأهداف والتقديرات مجرد اقتراحات من اللي سجلته بس؛ إنت اللي بتقرر ترفع إيه. لو عندك ألم أو دوخة أو إصابة أو حالة طبية، وقّف واسأل متخصص مؤهل قبل ما تكمل. سخّن واستخدم أوزان آمنة ومعاك حد يسندك.",
  "privacy.age": "GAIN مش متصمم للأطفال. لو سنك أقل من 18، تمرّن بتوجيه شخص كبير أو مدرب مؤهل.",
  "privacy.contact": "التواصل: [هيتكتب]",
  "health.note": "GAIN أداة مساعدة للتمرين، مش دكتور ومش نصيحة طبية. ألم أو دوخة أو إصابة: وقّف وروح لمتخصص مؤهل.",
};
