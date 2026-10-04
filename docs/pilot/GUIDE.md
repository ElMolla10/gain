# GAIN pilot: how to install and how to report a problem (one page, English and Arabic) (DRAFT)

Status: **DRAFT. No non-technical person has followed it yet** (G2 asks for one who does, without help; record the result in [consent-log-template.csv](consent-log-template.csv) column `setup_without_help`). Phone screens differ by maker, so wording like "Allow from this source" may look different on yours. The Arabic is a builder's draft nobody native has read. A print-ready bilingual page of the same text is [../site/pilot-guide.html](../site/pilot-guide.html) (open it, then Print or Save as PDF). The longer beta version is [../INSTALL-GUIDE.md](../INSTALL-GUIDE.md).

Placeholders: `[CONTACT]` = how to reach the person running the pilot.

---

## English

**GAIN pilot: install, update, report**

GAIN is a free lifting log. This is a test version (Android only). It works without internet and without an account. Your workouts stay on your phone.

**1. Install (first time)**
1. On your phone open `https://github.com/ElMolla10/gain/releases` and download the newest file named **gain-vX.Y.Z-arm64.apk** (the one at the top; if there are two APKs, take the one whose name starts with `gain-v`, unless the runner told you otherwise).
2. Open the downloaded file. If Android says it can't install from this source, tap **Settings**, switch on **Allow from this source**, go back, tap **Install**.
3. If Google Play Protect shows a warning for an unknown app, tap **Install anyway** (the app is signed by the developer; Google hasn't scanned it).
4. Open GAIN. Pick your language and units. The runner will help you with your program and gym weights the first time.
5. Check: Settings (bottom tab), at the very bottom shows **Version X.Y.Z**. Tell the runner that number.
If it says "app not compatible", the phone is not 64-bit ARM: tell the runner which phone you have.

**2. Every workout**
Today tab > **Start workout** > tick each set as you do it (it saves at once, even without internet) > **Finish workout** > for each next weight press **Accept**, **Edit weight** or **Reject**, whatever you would really do. **Why** shows the reason. There is no right answer; we are testing the app, not you.

**3. Update (when the runner tells you)**
First, if you can: Settings > Data > "Your data" > **Export a full backup (JSON)** and keep the file. Then Settings > **Check for updates** > **Download and install**. **Do not uninstall first** (that erases your data). Afterwards check your workouts are there and read the runner your version number.

**4. Send your backup (only if you agreed; weeks 1, 2 and 6)**
Settings > Data > "Your data" > **Export a full backup (JSON)** > choose the way the runner asked (email or USB). Not a group chat.

**5. Something went wrong? Report it**
Stop, don't retry five times. Send the runner at `[CONTACT]`:
1. What you were doing (which screen, what you tapped).
2. What you expected and what happened.
3. Phone make/model, Android version, GAIN version (Settings, bottom).
4. A screenshot or screen recording if you can.
5. If the app crashed or said "something went wrong": Settings > **Diagnostics and crash log** > **Send feedback** (or **Share the report**) and send it. It never contains your sets, weights or notes.
**If a set or workout is missing, tell the runner immediately** and do not update or uninstall: that is the most important kind of report.

**Safety:** GAIN is a training log, not a doctor or coach. Its numbers are suggestions. You decide what to lift. If something hurts, stop and ask a qualified professional.

---

## Arabic

<div dir="rtl" lang="ar">

**تجربة GAIN: التثبيت والتحديث والإبلاغ**

GAIN سجل تمارين مجاني. دي نسخة تجريبية (أندرويد بس). بتشتغل من غير نت ومن غير حساب. تمارينك بتفضل على موبايلك.

**١. التثبيت (أول مرة)**
١. من موبايلك افتح `https://github.com/ElMolla10/gain/releases` ونزّل أحدث ملف اسمه **gain-vX.Y.Z-arm64.apk** (اللي فوق خالص؛ لو فيه ملفين، خد اللي اسمه بيبدأ بـ `gain-v` إلا لو اللي بيدير التجربة قالك غير كده).
٢. افتح الملف اللي نزل. لو أندرويد قال إنه مش هيثبّت من المصدر ده، دوس **الإعدادات**، شغّل **السماح من هذا المصدر**، ارجع، ودوس **تثبيت**.
٣. لو Google Play Protect ظهر تحذير لتطبيق غير معروف، دوس **تثبيت على أي حال** (التطبيق موقّع من المطوّر، وجوجل لسه ما فحصوش).
٤. افتح GAIN. اختار اللغة والوحدات. اللي بيدير التجربة هيساعدك في البرنامج وأوزان الجيم أول مرة.
٥. اتأكد: الإعدادات (التبويب اللي تحت)، آخر الصفحة مكتوب **النسخة X.Y.Z**. قول الرقم ده للي بيدير التجربة.
لو ظهر "التطبيق غير متوافق"، الموبايل مش 64-bit ARM: قول للي بيدير التجربة موبايلك إيه.

**٢. كل تمرينة**
تبويب النهارده > **ابدأ التمرين** > علّم على كل مجموعة وإنت بتعملها (بتتحفظ فورًا حتى من غير نت) > **خلّص التمرين** > لكل وزن جاي دوس **موافق** أو **عدّل الوزن** أو **ارفض**، على حسب اللي هتعمله فعلًا. **ليه الوزن ده؟** بيوضّح السبب. مفيش إجابة صح؛ إحنا بنختبر التطبيق مش إنت.

**٣. التحديث (لما اللي بيدير التجربة يقولك)**
الأول، لو تقدر: الإعدادات > البيانات > "بياناتك" > **صدّر نسخة احتياطية كاملة (JSON)** واحتفظ بالملف. بعدين الإعدادات > **دوّر على تحديثات** > **نزّل وثبّت**. **متمسحش التطبيق الأول** (ده بيمسح بياناتك). بعدها اتأكد إن تمارينك موجودة وقول رقم النسخة للي بيدير التجربة.

**٤. ابعت نسختك الاحتياطية (بس لو وافقت؛ أسابيع ١ و٢ و٦)**
الإعدادات > البيانات > "بياناتك" > **صدّر نسخة احتياطية كاملة (JSON)** > اختار الطريقة اللي اتفقنا عليها (إيميل أو فلاشة). مش جروب.

**٥. حصلت مشكلة؟ بلّغ**
وقّف، متعيدش المحاولة ٥ مرات. ابعت للي بيدير التجربة على `[CONTACT]`:
١. كنت بتعمل إيه (أنهي شاشة، دوست على إيه).
٢. كنت متوقع إيه وحصل إيه.
٣. نوع الموبايل، نسخة أندرويد، نسخة GAIN (الإعدادات، آخر الصفحة).
٤. صورة شاشة أو تسجيل شاشة لو تقدر.
٥. لو التطبيق قفل أو قال "حصلت مشكلة": الإعدادات > **التشخيص وسجل الأعطال** > **ابعت ملاحظاتك** (أو **شارك التقرير**) وابعته. مفيهوش مجموعاتك ولا أوزانك ولا ملاحظاتك.
**لو مجموعة أو تمرينة ضاعت، قول للي بيدير التجربة فورًا** ومتحدّثش ولا تمسح التطبيق: ده أهم نوع بلاغ.

**السلامة:** GAIN سجل تمارين مش دكتور ولا مدرب. أرقامه اقتراحات. إنت اللي بتقرر ترفع كام. لو في حاجة بتوجعك وقّف واسأل متخصص.

</div>
