# Pilot messages to lifters (WhatsApp-ready, English and Egyptian Arabic) (DRAFT)

Status: **DRAFT, never sent.** The Arabic is a builder's Egyptian-leaning draft that no native speaker has read; Mohamed should read it aloud once before it goes out. Nothing here is sent by anyone but Mohamed (or the runner he names). Placeholders: `[NAME]` (first name, only in the private chat), `[RUNNER]`, `[CONTACT]`, `[GYM]`, `[DATE]`, `[TIME]`, `[LINK-GUIDE]` (the install/report guide, see [GUIDE.md](GUIDE.md)), `[LINK-APK]` (the GitHub release page), `[LINK-PRIVACY]` (the hosted draft privacy page, see [../site/README.md](../site/README.md)).

Rules for every message: one idea per message, no pressure, no streak or shame wording, never promise a result, never tell a lifter to follow the app's number (the pilot measures what they choose). Send privately, not in a group, anything that mentions a lifter's numbers. The pilot code (P01..) goes in the sheet and in file names, not in chat.

---

## 1. Invitation (before anyone has agreed)

**English**
> Hi [NAME], it's [RUNNER]. I'm testing a free lifting log app called GAIN with about 10 people at [GYM] for 6 weeks. After each workout it suggests your next weight; you accept it, change it or ignore it, and I just want to learn whether it's useful. It works offline, no account. I'd need: ~20 minutes to set it up together, then you log workouts as normal, and a 3-question message once a week. Totally optional, you can stop any time. Interested? I'll send the details and a consent note to read first.

**Arabic**
> أهلاً يا [NAME]، أنا [RUNNER]. بجرّب تطبيق تسجيل تمارين مجاني اسمه GAIN مع حوالي ١٠ ناس في [GYM] لمدة ٦ أسابيع. بعد كل تمرينة بيقترح عليك الوزن الجاي؛ تقبله أو تغيّره أو تتجاهله، وأنا بس عايز أعرف هو مفيد ولا لأ. بيشتغل من غير نت ومن غير حساب. اللي محتاجه: حوالي ٢٠ دقيقة نجهّزه سوا، وبعدها تسجّل تمارينك عادي، ورسالة فيها ٣ أسئلة مرة في الأسبوع. اختياري تمامًا وتقدر توقف في أي وقت. مهتم؟ هبعتلك التفاصيل وورقة موافقة تقراها الأول.

## 2. Eligibility + consent step (after "yes")

**English**
> Great. Two quick things: you need an Android phone (iPhone isn't supported yet), and you should be 18+ and training 2 or more days a week. If you have an injury or a medical condition that limits training, please check with your doctor first; GAIN is a log, not a coach. Here's the consent note, please read it and ask me anything: [paste the English text from CONSENT.md]. If you agree, reply "agree" and tell me if you're OK sending me your backup file at the end of weeks 1, 2 and 6 (you can say no and still take part).

**Arabic**
> تمام. حاجتين سريعين: لازم يكون معاك موبايل أندرويد (الآيفون مش مدعوم لسه)، وتكون ١٨ سنة أو أكتر وبتتمرن يومين في الأسبوع أو أكتر. لو عندك إصابة أو حالة طبية بتحدّ من التمرين، اسأل دكتورك الأول؛ GAIN سجل مش مدرب. ده نص الموافقة، اقراه واسألني في أي حاجة: [الصق النص العربي من CONSENT.md]. لو موافق ابعتلي "موافق"، وقولي هل تمام تبعتلي ملف النسخة الاحتياطية في آخر الأسبوع ١ و٢ و٦ (تقدر تقول لأ وتكمّل معانا).

## 3. Setup-day invitation (the day before)

**English**
> See you [DATE] at [TIME] at [GYM] for the GAIN setup (about 20 minutes). Please bring your phone, its charger isn't needed, and if you log in Hevy or Strong, make sure you can open the app so we can export your history. If you use another app or a notebook, bring your usual program. Before we meet you can download the app file from [LINK-APK] (the newest "gain-v…-arm64.apk"); if that's confusing, don't worry, we'll do it together.

**Arabic**
> نتقابل يوم [DATE] الساعة [TIME] في [GYM] لتجهيز GAIN (حوالي ٢٠ دقيقة). هات موبايلك، ولو بتسجّل في Hevy أو Strong اتأكد إنك تقدر تفتح التطبيق عشان نصدّر تاريخك. ولو بتستخدم تطبيق تاني أو كشكول، هات برنامجك المعتاد. قبل ما نتقابل تقدر تنزّل ملف التطبيق من [LINK-APK] (أحدث ملف اسمه "gain-v…-arm64.apk")؛ ولو لخبط عليك متقلقش، هنعملها سوا.

## 4. After setup (same day)

**English**
> Thanks [NAME]! You're set up. Train as you normally do and log it in GAIN. When you finish a workout you'll see the next weights: accept, change or reject each one, whatever you'd really do. There's no right answer. Here's the one-page guide for installing, updating and reporting problems: [LINK-GUIDE]. If anything looks wrong or loses a set, message me straight away at [CONTACT]; I'd rather hear about it early.

**Arabic**
> شكرًا يا [NAME]! جهّزنا كل حاجة. اتمرن زي ما بتعمل دايمًا وسجّل في GAIN. لما تخلّص التمرينة هتشوف الأوزان الجاية: وافق أو عدّل أو ارفض كل واحد، على حسب اللي هتعمله فعلًا. مفيش إجابة صح. ده دليل صفحة واحدة للتثبيت والتحديث والإبلاغ عن المشاكل: [LINK-GUIDE]. لو أي حاجة شكلها غلط أو ضاعت مجموعة، ابعتلي فورًا على [CONTACT]؛ أفضّل أعرف بدري.

## 5. Weekly check-in (end of weeks 1 to 6; same words every week)

Ask the **same three questions the same way every week and never suggest an answer** (this is what makes override reasons usable, see [RUNBOOK.md](RUNBOOK.md) section 4). Send on the same weekday. Record answers in the pilot sheet (`days_planned`, `app_version`, `bugs_quotes`) and one row per overridden target in [override-sheet-template.csv](override-sheet-template.csv).

**English**
> Hi [NAME], week [N] check-in, 3 quick questions:
> 1) How many days could you train this week, and how many did you?
> 2) For any exercise where you did NOT load the app's number: what did you load, and why?
> 3) Did anything break or confuse you? (Settings, bottom of the page, shows the GAIN version; tell me that too.)
> Short answers are fine, voice notes too. Thanks!

**Arabic**
> أهلاً يا [NAME]، متابعة الأسبوع [N]، ٣ أسئلة سريعة:
> ١) كام يوم كان ينفع تتمرن الأسبوع ده، وكام يوم اتمرنت فعلًا؟
> ٢) في أي تمرين مستخدمتش فيه وزن التطبيق: حطيت كام، وليه؟
> ٣) في حاجة بوظت أو لخبطتك؟ (في الإعدادات، آخر الصفحة، بيظهر رقم نسخة GAIN؛ قولهولي كمان.)
> إجابات قصيرة تمام، والرسائل الصوتية كمان. شكرًا!

## 6. Export request (end of weeks 1, 2 and 6, only for lifters who said yes to the file)

**English**
> Could you send me your backup file now? In GAIN: Settings > Data > "Your data: export, restore, delete" > "Export a full backup (JSON)", then choose to send it to [CONTACT-PRIVATE: email address or USB at the gym]. Please don't post it in a group chat. It contains everything you logged in the app, which is why I only read workouts, sets and suggestions. Thanks!

**Arabic**
> ممكن تبعتلي ملف النسخة الاحتياطية دلوقتي؟ في GAIN: الإعدادات > البيانات > "بياناتك: تصدير، استعادة، مسح" > "صدّر نسخة احتياطية كاملة (JSON)"، وبعدين اختار تبعته على [CONTACT-PRIVATE: إيميل أو فلاشة في الجيم]. من فضلك متنزلوش في جروب. فيه كل حاجة سجلتها في التطبيق، عشان كده أنا بقرا التمارين والمجموعات والاقتراحات بس. شكرًا!

## 7. A lifter has gone quiet (after 7 days without a logged workout; no shame wording)

**English**
> Hi [NAME], no pressure at all. I noticed I haven't heard about a GAIN workout for a bit. Was it the app (something annoying or broken), life or gym schedule, or you just didn't feel like logging? Any answer is useful, and it's totally fine to pause or stop.

**Arabic**
> أهلاً يا [NAME]، من غير أي ضغط. حسّيت إني مسمعتش عن تمرينة في GAIN من فترة. السبب كان التطبيق (حاجة مزعجة أو بايظة)، ولا ظروفك أو مواعيد الجيم، ولا ببساطة مكنتش حابب تسجّل؟ أي إجابة مفيدة، وعادي جدًا تاخد استراحة أو توقف.

(Do not call a lifter "churned" until they have answered; see PILOT-RETENTION-METRICS.md.)

## 8. Update announcement (when a fixed build is released)

**English**
> There's a new GAIN version ([VERSION]) that fixes: [one plain sentence]. To update: open GAIN > Settings > Check for updates > Download and install. Please don't uninstall first (that deletes your data). Before updating, if you can, do Settings > Data > Export a full backup and keep the file. Then check that your workouts are still there and tell me the version number.

**Arabic**
> فيه نسخة جديدة من GAIN ([VERSION]) بتصلّح: [جملة بسيطة]. عشان تحدّث: افتح GAIN > الإعدادات > دوّر على تحديثات > نزّل وثبّت. من فضلك متمسحش التطبيق الأول (ده بيمسح بياناتك). قبل التحديث لو تقدر اعمل الإعدادات > البيانات > صدّر نسخة احتياطية كاملة واحتفظ بالملف. بعدها اتأكد إن تمارينك لسه موجودة وقولي رقم النسخة.

## 9. Stop-rule announcement (same day to all lifters, see PILOT-KIT section 1.7)

**English**
> Important: we've found a problem in GAIN ([plain description]). Until I tell you it's fixed, please keep logging in your notebook or another app as well, and don't update or uninstall GAIN. Your existing data is [safe / at risk: be honest]. I'll message everyone again today/tomorrow. Sorry about this.

**Arabic**
> مهم: لقينا مشكلة في GAIN ([وصف بسيط]). لحد ما أقولك إنها اتصلّحت، من فضلك كمّل سجّل في كشكولك أو تطبيق تاني كمان، ومتحدّثش ولا تمسح GAIN. بياناتك الحالية [سليمة / معرضة للخطر: كن صريح]. هبعتلكم تاني النهارده/بكره. آسف على كده.

## 10. Exit conversation invitation (week 6, or when someone leaves)

**English**
> Thanks for sticking with it, [NAME]! Could we talk for 15 minutes (call or in person) about how it went? I'll ask where the app's number felt wrong, whether you trusted it enough to load it, what stopped you opening the app, and what would make you stay. Honest answers help most, including "I didn't like it".

**Arabic**
> شكرًا إنك كمّلت يا [NAME]! ينفع نتكلم ١٥ دقيقة (مكالمة أو وش لوش) عن التجربة كانت عاملة إزاي؟ هسألك فين حسّيت إن رقم التطبيق غلط، وهل وثقت فيه كفاية تحمّله، وإيه اللي منعك تفتح التطبيق، وإيه اللي يخليك تكمّل. الإجابات الصريحة أفيد، حتى لو "معجبنيش".

## 11. Closing and deletion confirmation

**English**
> The pilot is finished. Thank you! As promised I've deleted your backup file(s) and the sheet rows linked to your code on [DATE]. [If you want, keep using GAIN: it stays free.] If you want anything else of yours removed, message me at [CONTACT].

**Arabic**
> التجربة خلصت. شكرًا ليك! زي ما وعدتك مسحت ملف (ملفات) النسخة الاحتياطية بتاعتك والصفوف المرتبطة بالكود بتاعك يوم [DATE]. [لو حابب كمّل استخدم GAIN: هيفضل مجاني.] ولو عايز أي حاجة تانية تتمسح، ابعتلي على [CONTACT].

## 12. A lifter asks to withdraw or delete

**English**
> Of course, thank you for trying it. I'll delete your file(s) and your rows from my sheet today and tell you when it's done. On your phone, nothing else is needed: your workouts live only on your phone, and you can erase them in Settings > Data > "Delete all my data" if you want.

**Arabic**
> أكيد، شكرًا إنك جرّبت. همسح ملفك (ملفاتك) وصفوفك من الشيت النهارده وهقولك لما أخلّص. على موبايلك مفيش حاجة تانية مطلوبة: تمارينك موجودة على موبايلك بس، وتقدر تمسحها من الإعدادات > البيانات > "امسح كل بياناتي" لو عايز.
