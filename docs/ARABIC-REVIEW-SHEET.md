# Arabic names and aliases: review sheet (DRAFT)

**Status: no sign-off is recorded on this sheet.** Every Arabic name and alias below began as my draft (literal or transliterated). Reported OK by Mohamed 2026-10-03 (on his word): he reviewed the Arabic and it looks good; reviewer identity and scope not recorded, and no per-row verdicts are in this file. That report predates the v0.12.0 library growth: rows 51 onward (added in v0.12.0) were drafted afterwards and have **not** been reviewed by anyone. Two native Egyptian lifters or trainers must still sign off before any "draft" label is removed (MASTER-PLAN Step 8). This file is generated from `apps/mobile/src/db/seedData.ts`, `libraryDraft.ts` and `library/*.ts` (`npm run review-sheet -w apps/mobile`); a test fails if it is out of date.

## How to review
For each row, write one of: **OK**, **change to: ...**, **remove**. Add the words you really use in your gym that are missing from "Aliases". Say which city you train in: slang differs. Do not copy names from a book or site you cannot share.

| # | Key | English | Arabic name (draft) | Aliases (draft) | Verdict | Your wording | City / notes |
|---|-----|---------|---------------------|-----------------|---------|--------------|--------------|
| 1 | bench_press | Barbell Bench Press | بنش برس بالبار | بنش، بنش بريس، ضغط صدر بالبار | | | |
| 2 | incline_db_press | Incline Dumbbell Press | ضغط علوي بالدمبل | انكلاين، إنكلاين دمبل، صدر علوي | | | |
| 3 | chest_press_machine | Machine Chest Press | ضغط صدر بالماكينة | تشيست بريس، ماكينة صدر | | | |
| 4 | shoulder_press_db | Seated Dumbbell Shoulder Press | ضغط كتف بالدمبل | شولدر بريس، ضغط كتف | | | |
| 5 | lateral_raise_db | Dumbbell Lateral Raise | رفرفة جانبي بالدمبل | لاترال، رفرفة، رفرفة جانبي | | | |
| 6 | triceps_pushdown | Cable Triceps Pushdown | ترايسبس كابل | تراي كابل، بوش داون، ترايسبس نزول | | | |
| 7 | lat_pulldown | Lat Pulldown | سحب أمامي (لات) | لات، لات بول داون، سحب عالي | | | |
| 8 | seated_cable_row | Seated Cable Row | تجديف كابل جالس | روينج كابل، تجديف، سحب أفقي | | | |
| 9 | db_row | One-Arm Dumbbell Row | تجديف دمبل بذراع واحدة | دمبل رو، تجديف دمبل | | | |
| 10 | face_pull | Face Pull | سحب للوجه (فيس بول) | فيس بول، سحب للوجه | | | |
| 11 | db_curl | Dumbbell Biceps Curl | تبادل بالدمبل (باي) | باي، بايسبس، تبادل، باي دمبل | | | |
| 12 | hammer_curl | Hammer Curl | هامر كيرل | هامر، مطرقة | | | |
| 13 | back_squat | Barbell Back Squat | سكوات بالبار | سكوات، قرفصاء | | | |
| 14 | leg_press | Leg Press | ليج بريس | ليج بريس، ضغط أرجل | | | |
| 15 | romanian_deadlift | Romanian Deadlift | ديدلفت روماني | رومانيان، ديدلفت، آر دي إل | | | |
| 16 | leg_curl | Seated Leg Curl | رجل خلفي (ليج كيرل) | ليج كيرل، رجل خلفي، هامسترنج | | | |
| 17 | leg_extension | Leg Extension | رجل أمامي (ليج اكستنشن) | ليج اكستنشن، رجل أمامي، كوادريسبس | | | |
| 18 | calf_raise | Seated Calf Raise | سمانة جالس | سمانة، كالف | | | |
| 19 | assisted_pullup | Assisted Pull-Up (machine) | عقلة بمساعدة الجهاز | عقلة مساعدة، بول أب مساعد | | | |
| 20 | dip | Dip (bodyweight + added) | باراليل | ديبس، متوازي | | | |
| 21 | incline_bench_barbell | Incline Barbell Bench Press | بنش مائل بالبار | بنش مائل، انكلاين بار | | | |
| 22 | db_bench | Dumbbell Bench Press | بنش بالدمبل | ضغط صدر بالدمبل، دمبل بنش | | | |
| 23 | close_grip_bench | Close-Grip Bench Press | بنش ضيق | بنش قبضة ضيقة | | | |
| 24 | cable_fly | Cable Fly | فلاي كابل | فتح صدر كابل | | | |
| 25 | pec_deck | Pec Deck (machine fly) | بك ديك | فلاي ماكينة، فتح صدر ماكينة | | | |
| 26 | overhead_press_barbell | Barbell Overhead Press | ضغط كتف بالبار | أوفر هيد بريس، شولدر بريس بار | | | |
| 27 | machine_shoulder_press | Machine Shoulder Press | ضغط كتف بالماكينة | شولدر بريس ماكينة | | | |
| 28 | cable_lateral_raise | Cable Lateral Raise | رفرفة جانبي كابل | لاترال كابل | | | |
| 29 | rear_delt_fly_db | Dumbbell Rear Delt Fly | رفرفة خلفي بالدمبل | ريير دلت، كتف خلفي | | | |
| 30 | reverse_pec_deck | Reverse Pec Deck | رفرفة خلفي ماكينة | ريفرس بك ديك، كتف خلفي ماكينة | | | |
| 31 | skullcrusher | Lying Triceps Extension (skullcrusher) | سكل كراشر | ترايسبس مستلقي | | | |
| 32 | overhead_triceps_cable | Cable Overhead Triceps Extension | ترايسبس فوق الراس كابل | أوفر هيد ترايسبس | | | |
| 33 | pullup | Pull-Up (bodyweight + added) | عقلة | بول أب، عقلة بوزن إضافي | | | |
| 34 | barbell_row | Barbell Row | تجديف بالبار | بار رو، تجديف بار | | | |
| 35 | machine_row | Machine Row | تجديف ماكينة | رو ماكينة | | | |
| 36 | straight_arm_pulldown | Straight-Arm Cable Pulldown | سحب بذراع مفرودة كابل | ستريت آرم | | | |
| 37 | barbell_curl | Barbell Biceps Curl | باي بالبار | كيرل بار، تبادل بار | | | |
| 38 | cable_curl | Cable Biceps Curl | باي كابل | كيرل كابل | | | |
| 39 | front_squat | Barbell Front Squat | سكوات أمامي | فرونت سكوات | | | |
| 40 | goblet_squat | Goblet Squat | جوبلت سكوات | سكوات بدمبل | | | |
| 41 | hack_squat | Machine Hack Squat | هاك سكوات | هاك سكوات ماكينة | | | |
| 42 | bulgarian_split_squat | Dumbbell Bulgarian Split Squat | سبليت سكوات بلغاري | بلغاري، سبليت سكوات | | | |
| 43 | db_lunge | Dumbbell Lunge | لانج بالدمبل | لانجز، طعن بالدمبل | | | |
| 44 | deadlift | Conventional Deadlift | ديدلفت | ديدلفت بالبار، رفعة ميتة | | | |
| 45 | db_rdl | Dumbbell Romanian Deadlift | ديدلفت روماني بالدمبل | رومانيان دمبل | | | |
| 46 | hip_thrust | Barbell Hip Thrust | هيب ثراست | هيب ثرست | | | |
| 47 | lying_leg_curl | Lying Leg Curl | ليج كيرل نائم | رجل خلفي نائم | | | |
| 48 | standing_calf_raise | Standing Calf Raise | سمانة واقف | كالف واقف | | | |
| 49 | db_shrug | Dumbbell Shrug | شراج بالدمبل | رفع كتف بالدمبل | | | |
| 50 | cable_crunch | Cable Crunch | بطن كابل | كرنش كابل | | | |
| 51 | bench_press_smith_machine | Bench Press (Smith Machine) | بنش برس سميث | بنش برس، بنش سميث | | | |
| 52 | incline_bench_press_dumbbell | Incline Bench Press (Dumbbell) | بنش مائل بالدمبل | بنش مائل، انكلاين دمبل، إنكلاين | | | |
| 53 | incline_bench_press_smith_machine | Incline Bench Press (Smith Machine) | بنش مائل سميث | بنش مائل، انكلاين سميث | | | |
| 54 | decline_bench_press_barbell | Decline Bench Press (Barbell) | بنش سفلي بالبار | بنش سفلي، ديكلاين بار، ديكلاين | | | |
| 55 | decline_bench_press_dumbbell | Decline Bench Press (Dumbbell) | بنش سفلي بالدمبل | بنش سفلي، ديكلاين دمبل، ديكلاين | | | |
| 56 | decline_bench_press_smith_machine | Decline Bench Press (Smith Machine) | بنش سفلي سميث | بنش سفلي، ديكلاين سميث | | | |
| 57 | floor_press_barbell | Floor Press (Barbell) | ضغط من الأرض بالبار | ضغط من الأرض، فلور بريس | | | |
| 58 | floor_press_dumbbell | Floor Press (Dumbbell) | ضغط من الأرض بالدمبل | ضغط من الأرض، فلور بريس | | | |
| 59 | close_grip_bench_press_smith_machine | Close Grip Bench Press (Smith Machine) | بنش ضيق سميث | بنش ضيق، بنش قبضة ضيقة | | | |
| 60 | iso_lateral_chest_press_machine | Iso-Lateral Chest Press (Machine) | ضغط صدر أيزو ماكينة | ضغط صدر أيزو، تشيست بريس | | | |
| 61 | iso_lateral_incline_press_machine | Iso-Lateral Incline Press (Machine) | ضغط صدر علوي أيزو ماكينة | ضغط صدر علوي أيزو، انكلاين ماكينة | | | |
| 62 | decline_chest_press_machine | Decline Chest Press (Machine) | ضغط صدر سفلي ماكينة | ضغط صدر سفلي، ديكلاين ماكينة | | | |
| 63 | chest_press_plate_loaded | Chest Press (Plate Loaded) | ضغط صدر ماكينة بالأطباق | ضغط صدر، تشيست بريس | | | |
| 64 | incline_chest_press_plate_loaded | Incline Chest Press (Plate Loaded) | ضغط صدر علوي ماكينة بالأطباق | ضغط صدر علوي، انكلاين | | | |
| 65 | seated_chest_press_cable | Seated Chest Press (Cable) | ضغط صدر جالس كابل | ضغط صدر جالس، تشيست بريس كابل | | | |
| 66 | standing_chest_press_cable | Standing Chest Press (Cable) | ضغط صدر واقف كابل | ضغط صدر واقف، بريس واقف | | | |
| 67 | single_arm_chest_press_cable | Single Arm Chest Press (Cable) | ضغط صدر بذراع واحدة كابل | ضغط صدر بذراع واحدة، بريس دراع واحدة | | | |
| 68 | chest_fly_dumbbell | Chest Fly (Dumbbell) | فلاي صدر بالدمبل | فلاي صدر، فلاي، فتح صدر دمبل | | | |
| 69 | incline_chest_fly_dumbbell | Incline Chest Fly (Dumbbell) | فلاي صدر علوي بالدمبل | فلاي صدر علوي، فلاي انكلاين | | | |
| 70 | decline_chest_fly_dumbbell | Decline Chest Fly (Dumbbell) | فلاي صدر سفلي بالدمبل | فلاي صدر سفلي، فلاي ديكلاين | | | |
| 71 | butterfly_pec_deck | Butterfly (Pec Deck) | فلاي ماكينة ماكينة | فلاي ماكينة، بك ديك، فراشة، فتح صدر ماكينة | | | |
| 72 | inclined_flight_machine | Inclined Flight Machine | فلاي علوي ماكينة ماكينة | فلاي علوي ماكينة، فلاي انكلاين ماكينة | | | |
| 73 | cable_crossover | Cable Crossover | كروس أوفر كابل كابل | كروس أوفر كابل، كروس كابل، فتح صدر كابل | | | |
| 74 | low_cable_fly | Low Cable Fly | فلاي كابل من تحت كابل | فلاي كابل من تحت، فلاي كابل علوي، لو كابل | | | |
| 75 | high_cable_fly | High Cable Fly | فلاي كابل من فوق كابل | فلاي كابل من فوق، كروس أوفر عالي | | | |
| 76 | single_arm_cable_fly | Single Arm Cable Fly | فلاي كابل بذراع واحدة كابل | فلاي كابل بذراع واحدة | | | |
| 77 | chest_fly_band | Chest Fly (Band) | فلاي صدر بالأستيك | فلاي صدر، فلاي أستيك | | | |
| 78 | pullover_dumbbell | Pullover (Dumbbell) | بول أوفر بالدمبل | بول أوفر، بلوفر، بولوفر | | | |
| 79 | pullover_barbell | Pullover (Barbell) | بول أوفر بالبار | بول أوفر، بلوفر، بولوفر | | | |
| 80 | pullover_machine | Pullover (Machine) | بول أوفر ماكينة | بول أوفر، بلوفر، بولوفر | | | |
| 81 | svend_press | Svend Press | ضغط بالأطباق من الصدر بالدمبل | ضغط بالأطباق من الصدر، سفند بريس | | | |
| 82 | push_up | Push Up | ضغط | بوش أب، تمرين الضغط | | | |
| 83 | incline_push_up | Incline Push Up | ضغط مائل | بوش أب انكلاين | | | |
| 84 | decline_push_up | Decline Push Up | ضغط بالرجلين مرفوعة | بوش أب ديكلاين | | | |
| 85 | knee_push_up | Knee Push Up | ضغط على الركبة | بوش أب ركبة | | | |
| 86 | diamond_push_up | Diamond Push Up | ضغط ضيق (دايموند) | دايموند بوش أب، ضغط الماس | | | |
| 87 | wide_push_up | Wide Push Up | ضغط واسع | بوش أب واسع | | | |
| 88 | archer_push_up | Archer Push Up | ضغط أرشر | بوش أب أرشر | | | |
| 89 | clap_push_up | Clap Push Up | ضغط بتصفيق | بوش أب تصفيق | | | |
| 90 | deficit_push_up | Deficit Push Up | ضغط بعمق زيادة | بوش أب ديفيسيت | | | |
| 91 | ring_push_up | Ring Push Up | ضغط على الحلقات (TRX) | ضغط على الحلقات، بوش أب رينج | | | |
| 92 | chest_dip | Chest Dip | باراليل للصدر | ديبس صدر، متوازي صدر | | | |
| 93 | chest_dip_assisted | Chest Dip (Assisted) | باراليل للصدر بمساعدة الجهاز | باراليل للصدر، ديبس صدر مساعد | | | |
| 94 | dip_machine | Dip (Machine) | باراليل ماكينة | باراليل، ديبس ماكينة | | | |
| 95 | assisted_dip_machine | Assisted Dip (Machine) | باراليل بمساعدة الجهاز | باراليل، ديبس مساعد | | | |
| 96 | pin_press_barbell | Pin Press (Barbell) | بنش من الدبابيس بالبار | بنش من الدبابيس، بن بريس | | | |
| 97 | board_press_barbell | Board Press (Barbell) | بنش بالألواح بالبار | بنش بالألواح، بورد بريس | | | |
| 98 | pause_bench_press_barbell | Pause Bench Press (Barbell) | بنش بتوقف بالبار | بنش بتوقف، بوز بنش | | | |
| 99 | chest_press_band | Chest Press (Band) | ضغط صدر بالأستيك | ضغط صدر، بنش أستيك | | | |
| 100 | hindu_push_up | Hindu Push Up | ضغط هندي | هندو بوش أب | | | |
| 101 | pull_up_assisted | Pull Up (Assisted) | عقلة بمساعدة الجهاز | عقلة، بول أب مساعد، عقلة مساعدة | | | |
| 102 | chin_up | Chin Up | عقلة قبضة عكسية | شين أب، عقلة | | | |
| 103 | chin_up_assisted | Chin Up (Assisted) | عقلة قبضة عكسية بمساعدة الجهاز | عقلة قبضة عكسية، شين أب مساعد | | | |
| 104 | wide_pull_up | Wide Pull Up | عقلة واسعة | بول أب واسع | | | |
| 105 | neutral_grip_pull_up | Neutral Grip Pull Up | عقلة قبضة محايدة | عقلة قبضة ضيقة | | | |
| 106 | commando_pull_up | Commando Pull Up | عقلة كوماندو | كوماندو بول أب | | | |
| 107 | archer_pull_up | Archer Pull Up | عقلة أرشر | أرشر بول أب | | | |
| 108 | muscle_up | Muscle Up | ماسل أب | مسل أب | | | |
| 109 | lat_pulldown_machine | Lat Pulldown (Machine) | سحب أمامي ماكينة | سحب أمامي، لات ماكينة، سحب عالي | | | |
| 110 | lat_pulldown_plate_loaded | Lat Pulldown (Plate Loaded) | سحب أمامي ماكينة بالأطباق | سحب أمامي، لات | | | |
| 111 | wide_grip_lat_pulldown_cable | Wide Grip Lat Pulldown (Cable) | سحب أمامي قبضة واسعة كابل | سحب أمامي قبضة واسعة، لات واسع | | | |
| 112 | close_grip_lat_pulldown_cable | Close Grip Lat Pulldown (Cable) | سحب أمامي قبضة ضيقة كابل | سحب أمامي قبضة ضيقة، لات ضيق | | | |
| 113 | reverse_grip_lat_pulldown_cable | Reverse Grip Lat Pulldown (Cable) | سحب أمامي قبضة عكسية كابل | سحب أمامي قبضة عكسية، لات عكسي | | | |
| 114 | neutral_grip_lat_pulldown_cable | Neutral Grip Lat Pulldown (Cable) | سحب أمامي قبضة محايدة كابل | سحب أمامي قبضة محايدة، لات محايد | | | |
| 115 | behind_the_neck_lat_pulldown_cable | Behind The Neck Lat Pulldown (Cable) | سحب خلف الرقبة كابل | سحب خلف الرقبة، لات خلفي | | | |
| 116 | single_arm_lat_pulldown | Single Arm Lat Pulldown | سحب أمامي بذراع واحدة كابل | سحب أمامي بذراع واحدة، لات دراع واحدة | | | |
| 117 | iso_lateral_lat_pulldown_machine | Iso-Lateral Lat Pulldown (Machine) | سحب أمامي أيزو ماكينة | سحب أمامي أيزو، لات أيزو | | | |
| 118 | straight_arm_lat_pulldown_cable | Straight Arm Lat Pulldown (Cable) | سحب بذراع مفرودة كابل | سحب بذراع مفرودة، ستريت آرم | | | |
| 119 | lat_pulldown_band | Lat Pulldown (Band) | سحب أمامي بالأستيك | سحب أمامي، لات أستيك | | | |
| 120 | iso_lateral_row_machine | Iso-Lateral Row (Machine) | تجديف أيزو ماكينة | تجديف أيزو، رو أيزو | | | |
| 121 | seated_cable_row_v_grip_cable | Seated Cable Row - V Grip (Cable) | تجديف جالس قبضة V كابل | تجديف جالس قبضة V، روينج كابل، تجديف V | | | |
| 122 | seated_cable_row_bar_wide_grip | Seated Cable Row - Bar Wide Grip | تجديف جالس قبضة واسعة كابل | تجديف جالس قبضة واسعة، روينج واسع | | | |
| 123 | seated_cable_row_bar_grip | Seated Cable Row - Bar Grip | تجديف جالس بالبار كابل | تجديف جالس بالبار، روينج بار | | | |
| 124 | single_arm_cable_row | Single Arm Cable Row | تجديف كابل بذراع واحدة كابل | تجديف كابل بذراع واحدة، رو دراع واحدة | | | |
| 125 | standing_cable_row | Standing Cable Row | تجديف واقف كابل | تجديف واقف، رو واقف كابل | | | |
| 126 | seated_row_machine | Seated Row (Machine) | تجديف جالس ماكينة | تجديف جالس، رو ماكينة | | | |
| 127 | seated_row_plate_loaded | Seated Row (Plate Loaded) | تجديف جالس ماكينة بالأطباق | تجديف جالس، رو | | | |
| 128 | chest_supported_row_machine | Chest Supported Row (Machine) | تجديف بإسناد الصدر ماكينة | تجديف بإسناد الصدر، رو بصدر مسنود | | | |
| 129 | bent_over_row_barbell | Bent Over Row (Barbell) | تجديف منحني بالبار | تجديف منحني، بنت أوفر رو، بار رو | | | |
| 130 | bent_over_row_dumbbell | Bent Over Row (Dumbbell) | تجديف منحني بالدمبل | تجديف منحني، بنت أوفر رو، دمبل رو | | | |
| 131 | pendlay_row_barbell | Pendlay Row (Barbell) | تجديف بندلاي بالبار | تجديف بندلاي، بندلاي رو | | | |
| 132 | reverse_grip_bent_over_row_barbell | Reverse Grip Bent Over Row (Barbell) | تجديف منحني قبضة عكسية بالبار | تجديف منحني قبضة عكسية، رو عكسي | | | |
| 133 | dumbbell_row | Dumbbell Row | تجديف دمبل بالدمبل | تجديف دمبل، دمبل رو | | | |
| 134 | meadows_row_barbell | Meadows Row (Barbell) | تجديف ميدوز بالبار | تجديف ميدوز، ميدوز رو | | | |
| 135 | chest_supported_row_dumbbell | Chest Supported Row (Dumbbell) | تجديف بإسناد الصدر بالدمبل | تجديف بإسناد الصدر، رو على بنش مائل | | | |
| 136 | t_bar_row | T Bar Row | تجديف تي بار | تي بار، تي بار رو | | | |
| 137 | t_bar_row_landmine | T Bar Row (Landmine) | تجديف لاندماين بالبار | تجديف لاندماين، لاندماين رو | | | |
| 138 | inverted_row | Inverted Row | تجديف مقلوب | رو مقلوب، تجديف على البار | | | |
| 139 | inverted_row_smith_machine | Inverted Row (Smith Machine) | تجديف مقلوب سميث | تجديف مقلوب، رو مقلوب سميث | | | |
| 140 | ring_row | Ring Row | تجديف على الحلقات (TRX) | تجديف على الحلقات، رو حلقات، تجديف TRX | | | |
| 141 | rack_pull_barbell | Rack Pull (Barbell) | راك بول بالبار | راك بول، ديدلفت من الراك | | | |
| 142 | deficit_deadlift_barbell | Deficit Deadlift (Barbell) | ديدلفت من فوق منصة بالبار | ديدلفت من فوق منصة، ديدلفت ديفيسيت | | | |
| 143 | back_extension_hyperextension | Back Extension (Hyperextension) | تمدد الظهر | هايبر اكستنشن، ظهر سفلي | | | |
| 144 | back_extension_weighted_hyperextension | Back Extension (Weighted Hyperextension) | تمدد الظهر بوزن | هايبر اكستنشن بوزن | | | |
| 145 | back_extension_machine | Back Extension (Machine) | تمدد الظهر ماكينة | تمدد الظهر، ظهر سفلي ماكينة | | | |
| 146 | superman | Superman | سوبرمان | تمرين سوبرمان | | | |
| 147 | reverse_hyperextension_machine | Reverse Hyperextension (Machine) | ريفرس هايبر ماكينة | ريفرس هايبر، هايبر عكسي | | | |
| 148 | good_morning_barbell | Good Morning (Barbell) | جود مورنينج بالبار | جود مورنينج، قود مورنينج | | | |
| 149 | seated_good_morning_barbell | Seated Good Morning (Barbell) | جود مورنينج جالس بالبار | جود مورنينج جالس، قود مورنينج | | | |
| 150 | face_pull_band | Face Pull (Band) | سحب للوجه بالأستيك | سحب للوجه، فيس بول أستيك | | | |
| 151 | band_pull_apart | Band Pull Apart | فتح الأستيك بالأستيك | فتح الأستيك، بول أبارت، سحب أستيك | | | |
| 152 | shrug_machine | Shrug (Machine) | رفع كتف ماكينة | رفع كتف، شراج ماكينة | | | |
| 153 | high_row_machine | High Row (Machine) | سحب عالي ماكينة | سحب عالي، هاي رو | | | |
| 154 | low_row_machine | Low Row (Machine) | تجديف منخفض ماكينة | تجديف منخفض، لو رو | | | |
| 155 | iso_lateral_high_row_machine | Iso-Lateral High Row (Machine) | سحب عالي أيزو ماكينة بالأطباق | سحب عالي أيزو، هاي رو أيزو | | | |
| 156 | iso_lateral_low_row_machine | Iso-Lateral Low Row (Machine) | تجديف منخفض أيزو ماكينة بالأطباق | تجديف منخفض أيزو، لو رو أيزو | | | |
| 157 | kroc_row_dumbbell | Kroc Row (Dumbbell) | تجديف كروك بالدمبل | تجديف كروك، كروك رو | | | |
| 158 | renegade_row_dumbbell | Renegade Row (Dumbbell) | تجديف رينيجيد بالدمبل | تجديف رينيجيد، رينيجيد رو | | | |
| 159 | helms_row_dumbbell | Helms Row (Dumbbell) | تجديف هيلمز بالدمبل | تجديف هيلمز، هيلمز رو | | | |
| 160 | half_kneeling_lat_pulldown_cable | Half Kneeling Lat Pulldown (Cable) | سحب أمامي على ركبة كابل | سحب أمامي على ركبة، لات على ركبة | | | |
| 161 | kneeling_single_arm_high_row_cable | Kneeling Single Arm High Row (Cable) | سحب عالي على ركبة بذراع واحدة كابل | سحب عالي على ركبة بذراع واحدة، هاي رو كابل | | | |
| 162 | rope_pullover_cable | Rope Pullover (Cable) | بول أوفر بالحبل كابل | بول أوفر بالحبل، بلوفر حبل | | | |
| 163 | shotgun_row_cable | Shotgun Row (Cable) | تجديف شوت جن كابل | تجديف شوت جن، شوت جن رو | | | |
| 164 | seated_row_band | Seated Row (Band) | تجديف جالس بالأستيك | تجديف جالس، رو أستيك | | | |
| 165 | scapular_pull_up | Scapular Pull Up | عقلة للكتف | سكابيولار بول أب | | | |
| 166 | shoulder_press_dumbbell | Shoulder Press (Dumbbell) | ضغط كتف بالدمبل | ضغط كتف، شولدر بريس، ضغط كتف دمبل | | | |
| 167 | seated_shoulder_press_barbell | Seated Shoulder Press (Barbell) | ضغط كتف جالس بالبار | ضغط كتف جالس، شولدر بريس بار | | | |
| 168 | standing_military_press_barbell | Standing Military Press (Barbell) | ضغط كتف واقف بالبار | ضغط كتف واقف، ميليتري بريس | | | |
| 169 | shoulder_press_smith_machine | Shoulder Press (Smith Machine) | ضغط كتف سميث | ضغط كتف، شولدر بريس سميث | | | |
| 170 | seated_shoulder_press_machine | Seated Shoulder Press (Machine) | ضغط كتف جالس ماكينة | ضغط كتف جالس، شولدر بريس ماكينة | | | |
| 171 | seated_shoulder_press_machine_plates | Seated Shoulder Press (Machine Plates) | ضغط كتف جالس ماكينة بالأطباق | ضغط كتف جالس، شولدر بريس | | | |
| 172 | shoulder_press_machine_plates | Shoulder Press (Machine Plates) | ضغط كتف ماكينة بالأطباق | ضغط كتف، شولدر بريس | | | |
| 173 | iso_lateral_shoulder_press_machine | Iso-Lateral Shoulder Press (Machine) | ضغط كتف أيزو ماكينة | ضغط كتف أيزو، شولدر بريس أيزو | | | |
| 174 | arnold_press_dumbbell | Arnold Press (Dumbbell) | أرنولد بريس بالدمبل | أرنولد بريس، ضغط أرنولد | | | |
| 175 | push_press_barbell | Push Press (Barbell) | بوش بريس بالبار | بوش بريس، ضغط كتف بدفع الرجل | | | |
| 176 | landmine_press_barbell | Landmine Press (Barbell) | ضغط لاندماين بالبار | ضغط لاندماين، لاندماين بريس | | | |
| 177 | single_arm_shoulder_press_cable | Single Arm Shoulder Press (Cable) | ضغط كتف بذراع واحدة كابل | ضغط كتف بذراع واحدة، شولدر بريس كابل | | | |
| 178 | pike_push_up | Pike Push Up | ضغط بايك | بايك بوش أب | | | |
| 179 | handstand_push_up | Handstand Push Up | ضغط الوقوف على اليدين | هاند ستاند بوش أب | | | |
| 180 | front_raise_dumbbell | Front Raise (Dumbbell) | رفرفة أمامي بالدمبل | رفرفة أمامي، رفع أمامي، فرونت ريز | | | |
| 181 | front_raise_barbell | Front Raise (Barbell) | رفع أمامي بالبار | رفع أمامي، فرونت ريز | | | |
| 182 | front_raise_cable | Front Raise (Cable) | رفرفة أمامي كابل | رفرفة أمامي، فرونت ريز كابل | | | |
| 183 | plate_front_raise | Plate Front Raise | رفع أمامي بالطبق ماكينة بالأطباق | رفع أمامي بالطبق، فرونت ريز بلات | | | |
| 184 | lateral_raise_machine | Lateral Raise (Machine) | رفرفة جانبي ماكينة | رفرفة جانبي، لاترال ماكينة | | | |
| 185 | lateral_raise_band | Lateral Raise (Band) | رفرفة جانبي بالأستيك | رفرفة جانبي، لاترال أستيك | | | |
| 186 | seated_lateral_raise_dumbbell | Seated Lateral Raise (Dumbbell) | رفرفة جانبي جالس بالدمبل | رفرفة جانبي جالس، لاترال جالس | | | |
| 187 | single_arm_lateral_raise_cable | Single Arm Lateral Raise (Cable) | رفرفة جانبي بذراع واحدة كابل | رفرفة جانبي بذراع واحدة، لاترال كابل دراع واحدة | | | |
| 188 | single_arm_lateral_raise_dumbbell | Single Arm Lateral Raise (Dumbbell) | رفرفة جانبي بذراع واحدة بالدمبل | رفرفة جانبي بذراع واحدة، لاترال دراع واحدة | | | |
| 189 | leaning_lateral_raise_dumbbell | Leaning Lateral Raise (Dumbbell) | رفرفة جانبي مع الميل بالدمبل | رفرفة جانبي مع الميل، لاترال مائل | | | |
| 190 | lying_lateral_raise_dumbbell | Lying Lateral Raise (Dumbbell) | رفرفة جانبي نائم على الجنب بالدمبل | رفرفة جانبي نائم على الجنب، لاترال نائم | | | |
| 191 | lateral_raise_smith_machine | Lateral Raise (Smith Machine) | رفرفة جانبي سميث | رفرفة جانبي، لاترال سميث | | | |
| 192 | upright_row_barbell | Upright Row (Barbell) | سحب عمودي للذقن بالبار | سحب عمودي للذقن، أبرايت رو | | | |
| 193 | upright_row_dumbbell | Upright Row (Dumbbell) | سحب عمودي للذقن بالدمبل | سحب عمودي للذقن، أبرايت رو | | | |
| 194 | upright_row_cable | Upright Row (Cable) | سحب عمودي للذقن كابل | سحب عمودي للذقن، أبرايت رو | | | |
| 195 | upright_row_smith_machine | Upright Row (Smith Machine) | سحب عمودي للذقن سميث | سحب عمودي للذقن، أبرايت رو | | | |
| 196 | rear_delt_reverse_fly_machine | Rear Delt Reverse Fly (Machine) | رفرفة خلفي ماكينة | رفرفة خلفي، ريفرس فلاي، كتف خلفي | | | |
| 197 | rear_delt_reverse_fly_dumbbell | Rear Delt Reverse Fly (Dumbbell) | رفرفة خلفي بالدمبل | رفرفة خلفي، ريفرس فلاي، كتف خلفي | | | |
| 198 | rear_delt_reverse_fly_cable | Rear Delt Reverse Fly (Cable) | رفرفة خلفي كابل | رفرفة خلفي، ريفرس فلاي كابل، كتف خلفي | | | |
| 199 | seated_rear_delt_fly_dumbbell | Seated Rear Delt Fly (Dumbbell) | رفرفة خلفي جالس بالدمبل | رفرفة خلفي جالس، ريير دلت جالس | | | |
| 200 | lying_rear_delt_fly_dumbbell | Lying Rear Delt Fly (Dumbbell) | رفرفة خلفي على بنش مائل بالدمبل | رفرفة خلفي على بنش مائل، ريير دلت | | | |
| 201 | single_arm_rear_delt_fly_cable | Single Arm Rear Delt Fly (Cable) | رفرفة خلفي بذراع واحدة كابل | رفرفة خلفي بذراع واحدة، ريير دلت كابل | | | |
| 202 | rear_delt_row_dumbbell | Rear Delt Row (Dumbbell) | تجديف للكتف الخلفي بالدمبل | تجديف للكتف الخلفي، ريير دلت رو | | | |
| 203 | rear_delt_row_cable | Rear Delt Row (Cable) | تجديف للكتف الخلفي كابل | تجديف للكتف الخلفي، ريير دلت رو | | | |
| 204 | cuban_press_dumbbell | Cuban Press (Dumbbell) | كوبان بريس بالدمبل | كوبان بريس، كيوبان بريس | | | |
| 205 | y_raise_dumbbell | Y Raise (Dumbbell) | رفرفة Y بالدمبل | رفرفة Y، واي ريز | | | |
| 206 | cable_y_raise | Cable Y Raise | رفرفة Y كابل كابل | رفرفة Y كابل، واي ريز كابل | | | |
| 207 | external_rotation_cable | External Rotation (Cable) | دوران خارجي للكتف كابل | دوران خارجي للكتف، اكسترنال روتيشن | | | |
| 208 | external_rotation_dumbbell | External Rotation (Dumbbell) | دوران خارجي للكتف بالدمبل | دوران خارجي للكتف، اكسترنال روتيشن | | | |
| 209 | external_rotation_band | External Rotation (Band) | دوران خارجي للكتف بالأستيك | دوران خارجي للكتف، اكسترنال روتيشن | | | |
| 210 | bus_driver_plate | Bus Driver (Plate) | باص درايفر بالطبق ماكينة بالأطباق | باص درايفر بالطبق، دوران الطبق | | | |
| 211 | scaption_dumbbell | Scaption (Dumbbell) | رفرفة سكابشن بالدمبل | رفرفة سكابشن، سكابشن | | | |
| 212 | w_raise_dumbbell | W Raise (Dumbbell) | رفرفة W بالدمبل | رفرفة W، دابليو ريز | | | |
| 213 | bent_over_rear_delt_raise_dumbbell | Bent Over Rear Delt Raise (Dumbbell) | رفرفة خلفي منحني بالدمبل | رفرفة خلفي منحني، ريير دلت منحني | | | |
| 214 | chest_supported_rear_delt_raise_dumbbell | Chest Supported Rear Delt Raise (Dumbbell) | رفرفة خلفي بإسناد الصدر بالدمبل | رفرفة خلفي بإسناد الصدر، ريير دلت على بنش مائل | | | |
| 215 | z_press_barbell | Z Press (Barbell) | زد بريس بالبار | زد بريس، ضغط كتف من الأرض | | | |
| 216 | z_press_dumbbell | Z Press (Dumbbell) | زد بريس بالدمبل | زد بريس، ضغط كتف من الأرض | | | |
| 217 | behind_the_neck_press_barbell | Behind the Neck Press (Barbell) | ضغط كتف خلف الرقبة بالبار | ضغط كتف خلف الرقبة، بيهايند نيك بريس | | | |
| 218 | bradford_press_barbell | Bradford Press (Barbell) | برادفورد بريس بالبار | برادفورد بريس، ضغط كتف أمام وخلف | | | |
| 219 | shoulder_press_band | Shoulder Press (Band) | ضغط كتف بالأستيك | ضغط كتف، شولدر بريس أستيك | | | |
| 220 | internal_rotation_cable | Internal Rotation (Cable) | دوران داخلي للكتف كابل | دوران داخلي للكتف، انترنال روتيشن | | | |
| 221 | shrug_barbell | Shrug (Barbell) | رفع كتف بالبار | رفع كتف، شراج بار، ترابيس | | | |
| 222 | shrug_smith_machine | Shrug (Smith Machine) | رفع كتف سميث | رفع كتف، شراج سميث، ترابيس | | | |
| 223 | shrug_cable | Shrug (Cable) | رفع كتف كابل | رفع كتف، شراج كابل، ترابيس | | | |
| 224 | shrug_trap_bar | Shrug (Trap Bar) | رفع كتف بالترب بار | رفع كتف، شراج ترب بار، ترابيس | | | |
| 225 | low_machine_shrug | Low Machine Shrug | رفع كتف من تحت ماكينة | رفع كتف من تحت، شراج ماكينة، ترابيس | | | |
| 226 | incline_shrug_dumbbell | Incline Shrug (Dumbbell) | رفع كتف على بنش مائل بالدمبل | رفع كتف على بنش مائل، شراج انكلاين، ترابيس | | | |
| 227 | behind_the_back_shrug_barbell | Behind The Back Shrug (Barbell) | رفع كتف من الخلف بالبار | رفع كتف من الخلف، شراج خلفي، ترابيس | | | |
| 228 | farmers_walk | Farmers Walk | مشي المزارع بالدمبل | مشي المزارع، فارمر ووك، حمل الأثقال | | | |
| 229 | suitcase_carry_dumbbell | Suitcase Carry (Dumbbell) | حمل بذراع واحدة بالدمبل | حمل بذراع واحدة، سوت كيس كاري | | | |
| 230 | overhead_carry_dumbbell | Overhead Carry (Dumbbell) | حمل فوق الراس بالدمبل | حمل فوق الراس، أوفر هيد كاري | | | |
| 231 | neck_flexion_weighted | Neck Flexion (Weighted) | رقبة أمامي بوزن ماكينة بالأطباق | رقبة أمامي بوزن، رقبة أمام | | | |
| 232 | neck_extension_weighted | Neck Extension (Weighted) | رقبة خلفي بوزن ماكينة بالأطباق | رقبة خلفي بوزن، رقبة خلف | | | |
| 233 | neck_flexion_machine | Neck Flexion (Machine) | رقبة أمامي ماكينة | رقبة أمامي، رقبة أمام | | | |
| 234 | neck_extension_machine | Neck Extension (Machine) | رقبة خلفي ماكينة | رقبة خلفي، رقبة خلف | | | |
| 235 | neck_side_flexion_machine | Neck Side Flexion (Machine) | رقبة جانبي ماكينة | رقبة جانبي، رقبة جنب | | | |
| 236 | neck_flexion_band | Neck Flexion (Band) | رقبة أمامي بالأستيك | رقبة أمامي، رقبة أمام | | | |
| 237 | neck_extension_band | Neck Extension (Band) | رقبة خلفي بالأستيك | رقبة خلفي، رقبة خلف | | | |
| 238 | neck_bridge | Neck Bridge | كوبري الرقبة | نيك بريدج | | | |
| 239 | bicep_curl_machine | Bicep Curl (Machine) | باي ماكينة | باي، باي ماكينة | | | |
| 240 | bicep_curl_band | Bicep Curl (Band) | باي بالأستيك | باي، باي أستيك | | | |
| 241 | ez_bar_biceps_curl | EZ Bar Biceps Curl | باي بالبار (EZ) | باي، باي بار ز، كيرل بار ز | | | |
| 242 | reverse_curl_barbell | Reverse Curl (Barbell) | باي عكسي بالبار | باي عكسي، ريفرس كيرل | | | |
| 243 | reverse_curl_dumbbell | Reverse Curl (Dumbbell) | باي عكسي بالدمبل | باي عكسي، ريفرس كيرل | | | |
| 244 | reverse_curl_cable | Reverse Curl (Cable) | باي عكسي كابل | باي عكسي، ريفرس كيرل | | | |
| 245 | reverse_curl_ez_bar | Reverse Curl (EZ Bar) | باي عكسي بالبار (EZ) | باي عكسي، ريفرس كيرل | | | |
| 246 | hammer_curl_cable | Hammer Curl (Cable) | هامر كيرل كابل | هامر كيرل، هامر كابل، هامر حبل | | | |
| 247 | cross_body_hammer_curl | Cross Body Hammer Curl | هامر كيرل عبر الجسم بالدمبل | هامر كيرل عبر الجسم، كروس بودي هامر | | | |
| 248 | seated_hammer_curl_dumbbell | Seated Hammer Curl (Dumbbell) | هامر كيرل جالس بالدمبل | هامر كيرل جالس، هامر جالس | | | |
| 249 | preacher_curl_barbell | Preacher Curl (Barbell) | بريتشر كيرل بالبار | بريتشر كيرل، بريتشر، باي على المنضدة | | | |
| 250 | preacher_curl_dumbbell | Preacher Curl (Dumbbell) | بريتشر كيرل بالدمبل | بريتشر كيرل، بريتشر، باي على المنضدة | | | |
| 251 | preacher_curl_ez_bar | Preacher Curl (EZ Bar) | بريتشر كيرل بالبار (EZ) | بريتشر كيرل، بريتشر | | | |
| 252 | preacher_curl_machine | Preacher Curl (Machine) | بريتشر كيرل ماكينة | بريتشر كيرل، بريتشر ماكينة | | | |
| 253 | preacher_curl_cable | Preacher Curl (Cable) | بريتشر كيرل كابل | بريتشر كيرل، بريتشر كابل | | | |
| 254 | seated_incline_curl_dumbbell | Seated Incline Curl (Dumbbell) | باي على بنش مائل بالدمبل | باي على بنش مائل، انكلاين كيرل، كيرل مائل | | | |
| 255 | incline_curl_cable | Incline Curl (Cable) | باي على بنش مائل كابل | باي على بنش مائل، انكلاين كيرل كابل | | | |
| 256 | concentration_curl | Concentration Curl | كونسنتريشن كيرل بالدمبل | كونسنتريشن كيرل، باي تركيز، باي جالس | | | |
| 257 | spider_curl_dumbbell | Spider Curl (Dumbbell) | سبايدر كيرل بالدمبل | سبايدر كيرل، باي سبايدر | | | |
| 258 | spider_curl_barbell | Spider Curl (Barbell) | سبايدر كيرل بالبار | سبايدر كيرل، باي سبايدر | | | |
| 259 | zottman_curl_dumbbell | Zottman Curl (Dumbbell) | زوتمان كيرل بالدمبل | زوتمان كيرل، زوتمان | | | |
| 260 | drag_curl_barbell | Drag Curl (Barbell) | دراج كيرل بالبار | دراج كيرل، باي سحب | | | |
| 261 | bayesian_curl_cable | Bayesian Curl (Cable) | باي بايزيان كابل | باي بايزيان، بايزيان كيرل | | | |
| 262 | overhead_curl_cable | Overhead Curl (Cable) | باي فوق الراس كابل كابل | باي فوق الراس كابل، كيرل أوفر هيد، دبل بايسبس | | | |
| 263 | high_cable_curl | High Cable Curl | باي كابل عالي كابل | باي كابل عالي، دبل بايسبس كابل | | | |
| 264 | single_arm_curl_cable | Single Arm Curl (Cable) | باي بذراع واحدة كابل | باي بذراع واحدة، باي كابل دراع واحدة | | | |
| 265 | waiter_curl_dumbbell | Waiter Curl (Dumbbell) | باي ويتر بالدمبل | باي ويتر، ويتر كيرل | | | |
| 266 | 21s_curl_barbell | 21s Curl (Barbell) | باي واحد وعشرين بالبار | باي واحد وعشرين، كيرل 21 | | | |
| 267 | cable_rope_hammer_curl | Cable Rope Hammer Curl | هامر كيرل حبل كابل | هامر كيرل حبل، هامر حبل | | | |
| 268 | lying_biceps_curl_cable | Lying Biceps Curl (Cable) | باي نائم كابل | باي نائم، باي نائم كابل | | | |
| 269 | incline_hammer_curl_dumbbell | Incline Hammer Curl (Dumbbell) | هامر كيرل على بنش مائل بالدمبل | هامر كيرل على بنش مائل، هامر انكلاين | | | |
| 270 | zottman_preacher_curl | Zottman Preacher Curl | زوتمان بريتشر بالدمبل | زوتمان بريتشر، زوتمان | | | |
| 271 | cheat_curl_barbell | Cheat Curl (Barbell) | باي بالتأرجح بالبار | باي بالتأرجح، تشيت كيرل | | | |
| 272 | triceps_rope_pushdown | Triceps Rope Pushdown | ترايسبس حبل كابل | تراي حبل، بوش داون حبل | | | |
| 273 | triceps_pushdown_straight_bar | Triceps Pushdown (Straight Bar) | ترايسبس نزول بالبار كابل | ترايسبس نزول بالبار، بوش داون بار | | | |
| 274 | triceps_pushdown_v_bar | Triceps Pushdown (V Bar) | ترايسبس نزول بقبضة V كابل | ترايسبس نزول بقبضة V، بوش داون V | | | |
| 275 | reverse_grip_triceps_pushdown_cable | Reverse Grip Triceps Pushdown (Cable) | ترايسبس نزول قبضة عكسية كابل | ترايسبس نزول قبضة عكسية، بوش داون عكسي | | | |
| 276 | single_arm_triceps_pushdown_cable | Single Arm Triceps Pushdown (Cable) | ترايسبس نزول بذراع واحدة كابل | ترايسبس نزول بذراع واحدة، بوش داون دراع واحدة | | | |
| 277 | triceps_pushdown_band | Triceps Pushdown (Band) | ترايسبس نزول بالأستيك | ترايسبس نزول، بوش داون أستيك | | | |
| 278 | overhead_triceps_extension_dumbbell | Overhead Triceps Extension (Dumbbell) | ترايسبس فوق الراس بالدمبل | ترايسبس فوق الراس، أوفر هيد دمبل | | | |
| 279 | overhead_triceps_extension_barbell | Overhead Triceps Extension (Barbell) | ترايسبس فوق الراس بالبار | ترايسبس فوق الراس، أوفر هيد بار | | | |
| 280 | overhead_triceps_extension_ez_bar | Overhead Triceps Extension (EZ Bar) | ترايسبس فوق الراس بالبار (EZ) | ترايسبس فوق الراس، أوفر هيد بار ز | | | |
| 281 | overhead_triceps_extension_rope | Overhead Triceps Extension (Rope) | ترايسبس فوق الراس حبل كابل | ترايسبس فوق الراس حبل، أوفر هيد حبل | | | |
| 282 | triceps_extension_barbell | Triceps Extension (Barbell) | ترايسبس خلف الراس بالبار | ترايسبس خلف الراس، ترايسبس اكستنشن | | | |
| 283 | triceps_extension_dumbbell | Triceps Extension (Dumbbell) | ترايسبس خلف الراس بالدمبل | ترايسبس خلف الراس، ترايسبس اكستنشن | | | |
| 284 | triceps_extension_machine | Triceps Extension (Machine) | ترايسبس ماكينة | ترايسبس، ترايسبس ماكينة | | | |
| 285 | single_arm_tricep_extension_dumbbell | Single Arm Tricep Extension (Dumbbell) | ترايسبس بذراع واحدة بالدمبل | ترايسبس بذراع واحدة، ترايسبس دراع واحدة | | | |
| 286 | skullcrusher_barbell | Skullcrusher (Barbell) | سكل كراشر بالبار | سكل كراشر، ترايسبس مستلقي | | | |
| 287 | skullcrusher_dumbbell | Skullcrusher (Dumbbell) | سكل كراشر بالدمبل | سكل كراشر، ترايسبس مستلقي | | | |
| 288 | skullcrusher_ez_bar | Skullcrusher (EZ Bar) | سكل كراشر بالبار (EZ) | سكل كراشر، ترايسبس مستلقي | | | |
| 289 | skullcrusher_cable | Skullcrusher (Cable) | سكل كراشر كابل | سكل كراشر، ترايسبس مستلقي كابل | | | |
| 290 | skullcrusher_smith_machine | Skullcrusher (Smith Machine) | سكل كراشر سميث | سكل كراشر، ترايسبس مستلقي | | | |
| 291 | triceps_kickback_dumbbell | Triceps Kickback (Dumbbell) | ترايسبس خلفي بالدمبل | ترايسبس خلفي، كيك باك ترايسبس | | | |
| 292 | triceps_kickback_cable | Triceps Kickback (Cable) | ترايسبس خلفي كابل | ترايسبس خلفي، كيك باك ترايسبس كابل | | | |
| 293 | triceps_dip | Triceps Dip | باراليل للترايسبس | ديبس ترايسبس | | | |
| 294 | triceps_dip_assisted | Triceps Dip (Assisted) | باراليل للترايسبس بمساعدة الجهاز | باراليل للترايسبس، ديبس ترايسبس مساعد | | | |
| 295 | bench_dip | Bench Dip | ديبس على البنش | بنش ديبس | | | |
| 296 | jm_press_barbell | JM Press (Barbell) | جي إم بريس بالبار | جي إم بريس، جيه إم بريس | | | |
| 297 | jm_press_smith_machine | JM Press (Smith Machine) | جي إم بريس سميث | جي إم بريس، جيه إم بريس | | | |
| 298 | tate_press_dumbbell | Tate Press (Dumbbell) | تيت بريس بالدمبل | تيت بريس، تيت بريس | | | |
| 299 | close_grip_push_up | Close Grip Push Up | ضغط ضيق | بوش أب ضيق | | | |
| 300 | cross_body_triceps_extension_cable | Cross Body Triceps Extension (Cable) | ترايسبس عبر الجسم كابل كابل | ترايسبس عبر الجسم كابل، كروس بودي ترايسبس | | | |
| 301 | kneeling_triceps_extension_cable | Kneeling Triceps Extension (Cable) | ترايسبس على الركبة كابل | ترايسبس على الركبة، ترايسبس كابل راكع | | | |
| 302 | seated_triceps_press_dumbbell | Seated Triceps Press (Dumbbell) | ترايسبس جالس بالدمبل | ترايسبس جالس، ترايسبس خلف الراس جالس | | | |
| 303 | incline_skullcrusher_dumbbell | Incline Skullcrusher (Dumbbell) | سكل كراشر على بنش مائل بالدمبل | سكل كراشر على بنش مائل، سكل كراشر انكلاين | | | |
| 304 | triceps_extension_band | Triceps Extension (Band) | ترايسبس فوق الراس بالأستيك | ترايسبس فوق الراس، ترايسبس أستيك | | | |
| 305 | seated_palms_up_wrist_curl | Seated Palms Up Wrist Curl | رسغ باطن اليد لأعلى جالس | ريست كيرل، رسغ | | | |
| 306 | wrist_curl_barbell | Wrist Curl (Barbell) | رسغ بالبار | رسغ، ريست كيرل، ساعد | | | |
| 307 | wrist_curl_dumbbell | Wrist Curl (Dumbbell) | رسغ بالدمبل | رسغ، ريست كيرل، ساعد | | | |
| 308 | wrist_curl_cable | Wrist Curl (Cable) | رسغ كابل | رسغ، ريست كيرل، ساعد | | | |
| 309 | behind_the_back_wrist_curl_barbell | Behind the Back Wrist Curl (Barbell) | رسغ من خلف الظهر بالبار | رسغ من خلف الظهر، ريست كيرل خلفي، ساعد | | | |
| 310 | reverse_wrist_curl_barbell | Reverse Wrist Curl (Barbell) | رسغ عكسي بالبار | رسغ عكسي، ريفرس ريست كيرل، ساعد | | | |
| 311 | reverse_wrist_curl_dumbbell | Reverse Wrist Curl (Dumbbell) | رسغ عكسي بالدمبل | رسغ عكسي، ريفرس ريست كيرل، ساعد | | | |
| 312 | seated_wrist_extension_barbell | Seated Wrist Extension (Barbell) | فرد الرسغ جالس بالبار | فرد الرسغ جالس، ريست اكستنشن، ساعد | | | |
| 313 | seated_wrist_barbell_palm_down | Seated wrist barbell palm down | رسغ باطن اليد لأسفل بالبار | رسغ باطن اليد لأسفل، ريست كيرل عكسي، ساعد | | | |
| 314 | cable_forearm_palms_up | Cable Forearm (palms up) | ساعد كابل باطن اليد لأعلى كابل | ساعد كابل باطن اليد لأعلى، ريست كيرل كابل، ساعد | | | |
| 315 | dead_hang | Dead Hang | تعليق على العقلة | ديد هانج، تعليق، قبضة | | | |
| 316 | plate_pinch | Plate Pinch | قرص الأطباق بالأصابع ماكينة بالأطباق | قرص الأطباق بالأصابع، بلات بينش، قبضة | | | |
| 317 | farmers_walk_trap_bar | Farmers Walk (Trap Bar) | مشي المزارع بالترب بار بالترب بار | مشي المزارع بالترب بار، فارمر ووك، قبضة | | | |
| 318 | finger_curl_barbell | Finger Curl (Barbell) | ثني الأصابع بالبار | ثني الأصابع، فينجر كيرل، قبضة | | | |
| 319 | wrist_roller | Wrist Roller | رولر الرسغ ماكينة بالأطباق | رولر الرسغ، ريست رولر، ساعد | | | |
| 320 | radial_deviation_dumbbell | Radial Deviation (Dumbbell) | ثني الرسغ جانبياً بالدمبل | ثني الرسغ جانبياً، ساعد | | | |
| 321 | pronation_supination_dumbbell | Pronation Supination (Dumbbell) | لف الساعد بالدمبل | لف الساعد، ساعد | | | |
| 322 | towel_pull_up | Towel Pull Up | عقلة بالفوطة | بول أب منشفة، قبضة | | | |
| 323 | grip_squeeze_hand_gripper | Grip Squeeze (Hand Gripper) | ضغط القابض اليدوي | هاند جريبر، قبضة | | | |
| 324 | squat_barbell | Squat (Barbell) | سكوات بالبار | سكوات، سكوات بار، قرفصاء | | | |
| 325 | squat_dumbbell | Squat (Dumbbell) | سكوات بالدمبل | سكوات، سكوات دمبل | | | |
| 326 | squat_smith_machine | Squat (Smith Machine) | سكوات سميث | سكوات، سكوات سميث | | | |
| 327 | squat_machine | Squat (Machine) | سكوات ماكينة | سكوات، سكوات ماكينة | | | |
| 328 | squat_bodyweight | Squat (Bodyweight) | سكوات بوزن الجسم | سكوات | | | |
| 329 | low_bar_squat_barbell | Low Bar Squat (Barbell) | سكوات بار منخفض بالبار | سكوات بار منخفض، لو بار سكوات | | | |
| 330 | high_bar_squat_barbell | High Bar Squat (Barbell) | سكوات بار عالي بالبار | سكوات بار عالي، هاي بار سكوات | | | |
| 331 | box_squat_barbell | Box Squat (Barbell) | سكوات على الصندوق بالبار | سكوات على الصندوق، بوكس سكوات | | | |
| 332 | pause_squat_barbell | Pause Squat (Barbell) | سكوات بتوقف بالبار | سكوات بتوقف، بوز سكوات | | | |
| 333 | overhead_squat_barbell | Overhead Squat (Barbell) | سكوات فوق الراس بالبار | سكوات فوق الراس، أوفر هيد سكوات | | | |
| 334 | zercher_squat_barbell | Zercher Squat (Barbell) | سكوات زيرشر بالبار | سكوات زيرشر، زيرشر سكوات | | | |
| 335 | safety_bar_squat | Safety Bar Squat | سكوات بار الأمان بالبار | سكوات بار الأمان، سيفتي بار سكوات | | | |
| 336 | front_squat_smith_machine | Front Squat (Smith Machine) | سكوات أمامي سميث | سكوات أمامي، فرونت سكوات سميث | | | |
| 337 | sumo_squat_dumbbell | Sumo Squat (Dumbbell) | سكوات سومو بالدمبل | سكوات سومو، سومو سكوات | | | |
| 338 | sumo_squat_barbell | Sumo Squat (Barbell) | سكوات سومو بالبار | سكوات سومو، سومو سكوات | | | |
| 339 | sumo_squat_kettlebell | Sumo Squat (Kettlebell) | سكوات سومو بالكيتل بيل | سكوات سومو، سومو سكوات | | | |
| 340 | goblet_squat_kettlebell | Goblet Squat (Kettlebell) | جوبلت سكوات بالكيتل بيل | جوبلت سكوات، سكوات كيتل بيل | | | |
| 341 | sissy_squat | Sissy Squat | سيسي سكوات | سكوات سيسي | | | |
| 342 | sissy_squat_machine | Sissy Squat (Machine) | سيسي سكوات ماكينة | سيسي سكوات، سكوات سيسي | | | |
| 343 | pistol_squat | Pistol Squat | سكوات رجل واحدة (بيستول) | بيستول سكوات | | | |
| 344 | jump_squat | Jump Squat | سكوات قفز | جامب سكوات | | | |
| 345 | wall_sit | Wall Sit | جلوس على الحائط | وول سيت | | | |
| 346 | belt_squat_machine | Belt Squat (Machine) | سكوات بالحزام ماكينة بالأطباق | سكوات بالحزام، بيلت سكوات | | | |
| 347 | pendulum_squat_machine | Pendulum Squat (Machine) | سكوات بندول ماكينة بالأطباق | سكوات بندول، بندولم سكوات | | | |
| 348 | v_squat_machine | V Squat (Machine) | في سكوات ماكينة بالأطباق | في سكوات، في سكوات ماكينة | | | |
| 349 | hack_squat_barbell | Hack Squat (Barbell) | هاك سكوات بالبار بالبار | هاك سكوات بالبار، هاك سكوات خلفي | | | |
| 350 | hack_squat_smith_machine | Hack Squat (Smith Machine) | هاك سكوات سميث | هاك سكوات، هاك سكوات سميث | | | |
| 351 | hack_squat_plate_loaded | Hack Squat (Plate Loaded) | هاك سكوات ماكينة بالأطباق | هاك سكوات، هاك سكوات | | | |
| 352 | leg_press_horizontal_machine | Leg Press Horizontal (Machine) | ليج بريس أفقي ماكينة | ليج بريس أفقي، ليج بريس | | | |
| 353 | leg_press_plate_loaded | Leg Press (Plate Loaded) | ليج بريس ماكينة بالأطباق | ليج بريس، ضغط أرجل | | | |
| 354 | 45_degree_leg_press_plate_loaded | 45 Degree Leg Press (Plate Loaded) | ليج بريس ٤٥ درجة ماكينة بالأطباق | ليج بريس ٤٥ درجة، ليج بريس مائل | | | |
| 355 | single_leg_press_machine | Single Leg Press (Machine) | ليج بريس برجل واحدة ماكينة | ليج بريس برجل واحدة، ليج بريس رجل واحدة | | | |
| 356 | narrow_stance_leg_press_machine | Narrow Stance Leg Press (Machine) | ليج بريس قدم ضيقة ماكينة | ليج بريس قدم ضيقة، ليج بريس ضيق | | | |
| 357 | wide_stance_leg_press_machine | Wide Stance Leg Press (Machine) | ليج بريس قدم واسعة ماكينة | ليج بريس قدم واسعة، ليج بريس واسع | | | |
| 358 | leg_extension_single_leg_machine | Leg Extension (Single Leg Machine) | رجل أمامي برجل واحدة ماكينة | رجل أمامي برجل واحدة، ليج اكستنشن رجل واحدة | | | |
| 359 | leg_extension_cable | Leg Extension (Cable) | رجل أمامي كابل | رجل أمامي، ليج اكستنشن كابل | | | |
| 360 | leg_extension_band | Leg Extension (Band) | رجل أمامي بالأستيك | رجل أمامي، ليج اكستنشن أستيك | | | |
| 361 | lunge_barbell | Lunge (Barbell) | لانج بالبار | لانج، لانجز بار، طعن بالبار | | | |
| 362 | lunge_smith_machine | Lunge (Smith Machine) | لانج سميث | لانج، لانجز سميث | | | |
| 363 | lunge_bodyweight | Lunge (Bodyweight) | لانج | لانجز، طعن | | | |
| 364 | walking_lunge_dumbbell | Walking Lunge (Dumbbell) | لانج مشي بالدمبل | لانج مشي، ووكنج لانج | | | |
| 365 | walking_lunge_barbell | Walking Lunge (Barbell) | لانج مشي بالبار | لانج مشي، ووكنج لانج | | | |
| 366 | reverse_lunge_dumbbell | Reverse Lunge (Dumbbell) | لانج للخلف بالدمبل | لانج للخلف، ريفرس لانج | | | |
| 367 | reverse_lunge_barbell | Reverse Lunge (Barbell) | لانج للخلف بالبار | لانج للخلف، ريفرس لانج | | | |
| 368 | reverse_lunge_smith_machine | Reverse Lunge (Smith Machine) | لانج للخلف سميث | لانج للخلف، ريفرس لانج | | | |
| 369 | curtsy_lunge_dumbbell | Curtsy Lunge (Dumbbell) | لانج متقاطع بالدمبل | لانج متقاطع، كيرتسي لانج | | | |
| 370 | lateral_lunge_dumbbell | Lateral Lunge (Dumbbell) | لانج جانبي بالدمبل | لانج جانبي، لاترال لانج | | | |
| 371 | split_squat_dumbbell | Split Squat (Dumbbell) | سبليت سكوات بالدمبل | سبليت سكوات، سبليت سكوات دمبل | | | |
| 372 | split_squat_barbell | Split Squat (Barbell) | سبليت سكوات بالبار | سبليت سكوات، سبليت سكوات بار | | | |
| 373 | split_squat_smith_machine | Split Squat (Smith Machine) | سبليت سكوات سميث | سبليت سكوات، سبليت سكوات سميث | | | |
| 374 | bulgarian_split_squat_bodyweight | Bulgarian Split Squat (Bodyweight) | سبليت سكوات بلغاري | بلغاري | | | |
| 375 | bulgarian_split_squat_barbell | Bulgarian Split Squat (Barbell) | سبليت سكوات بلغاري بالبار | سبليت سكوات بلغاري، بلغاري | | | |
| 376 | bulgarian_split_squat_smith_machine | Bulgarian Split Squat (Smith Machine) | سبليت سكوات بلغاري سميث | سبليت سكوات بلغاري، بلغاري | | | |
| 377 | step_up_dumbbell | Step Up (Dumbbell) | صعود على الصندوق بالدمبل | صعود على الصندوق، ستيب أب | | | |
| 378 | step_up_barbell | Step Up (Barbell) | صعود على الصندوق بالبار | صعود على الصندوق، ستيب أب | | | |
| 379 | step_up_bodyweight | Step Up (Bodyweight) | صعود على الصندوق | ستيب أب | | | |
| 380 | box_jump | Box Jump | قفز على الصندوق | بوكس جامب | | | |
| 381 | broad_jump | Broad Jump | قفز للأمام | برود جامب | | | |
| 382 | sled_push | Sled Push | دفع الزحافة ماكينة بالأطباق | دفع الزحافة، سليد بوش | | | |
| 383 | sled_pull | Sled Pull | سحب الزحافة ماكينة بالأطباق | سحب الزحافة، سليد بول | | | |
| 384 | tibialis_raise | Tibialis Raise | رفع مقدمة القدم | تيبياليس ريز | | | |
| 385 | tibialis_raise_machine | Tibialis Raise (Machine) | رفع مقدمة القدم ماكينة | رفع مقدمة القدم، تيبياليس ريز | | | |
| 386 | squat_band | Squat (Band) | سكوات بالأستيك | سكوات، سكوات أستيك | | | |
| 387 | squat_trap_bar | Squat (Trap Bar) | سكوات بالترب بار | سكوات، سكوات ترب بار | | | |
| 388 | reverse_hack_squat_machine | Reverse Hack Squat (Machine) | هاك سكوات عكسي ماكينة بالأطباق | هاك سكوات عكسي، ريفرس هاك | | | |
| 389 | step_back_lunge_dumbbell | Step Back Lunge (Dumbbell) | لانج للخلف بالدمبل | لانج للخلف، ستيب باك لانج | | | |
| 390 | deadlift_barbell | Deadlift (Barbell) | ديدلفت بالبار | ديدلفت، ديدلفت بار، رفعة ميتة | | | |
| 391 | deadlift_dumbbell | Deadlift (Dumbbell) | ديدلفت بالدمبل | ديدلفت، ديدلفت دمبل | | | |
| 392 | deadlift_smith_machine | Deadlift (Smith Machine) | ديدلفت سميث | ديدلفت، ديدلفت سميث | | | |
| 393 | deadlift_trap_bar | Deadlift (Trap Bar) | ديدلفت بالترب بار | ديدلفت، ديدلفت ترب بار | | | |
| 394 | deadlift_kettlebell | Deadlift (Kettlebell) | ديدلفت بالكيتل بيل | ديدلفت، ديدلفت كيتل بيل | | | |
| 395 | sumo_deadlift_barbell | Sumo Deadlift (Barbell) | ديدلفت سومو بالبار | ديدلفت سومو، سومو ديدلفت | | | |
| 396 | sumo_deadlift_dumbbell | Sumo Deadlift (Dumbbell) | ديدلفت سومو بالدمبل | ديدلفت سومو، سومو ديدلفت | | | |
| 397 | sumo_deadlift_trap_bar | Sumo Deadlift (Trap Bar) | ديدلفت سومو بالترب بار | ديدلفت سومو، سومو ديدلفت | | | |
| 398 | deadlift_high_pull_barbell | Deadlift High Pull (Barbell) | ديدلفت مع سحب عالي بالبار | ديدلفت مع سحب عالي، ديدلفت هاي بول | | | |
| 399 | romanian_deadlift_smith_machine | Romanian Deadlift (Smith Machine) | ديدلفت روماني سميث | ديدلفت روماني، رومانيان سميث | | | |
| 400 | romanian_deadlift_trap_bar | Romanian Deadlift (Trap Bar) | ديدلفت روماني بالترب بار | ديدلفت روماني، رومانيان ترب بار | | | |
| 401 | romanian_deadlift_cable | Romanian Deadlift (Cable) | ديدلفت روماني كابل | ديدلفت روماني، رومانيان كابل | | | |
| 402 | stiff_leg_deadlift_barbell | Stiff Leg Deadlift (Barbell) | ديدلفت بأرجل مفرودة بالبار | ديدلفت بأرجل مفرودة، ستيف ليج ديدلفت | | | |
| 403 | stiff_leg_deadlift_dumbbell | Stiff Leg Deadlift (Dumbbell) | ديدلفت بأرجل مفرودة بالدمبل | ديدلفت بأرجل مفرودة، ستيف ليج ديدلفت | | | |
| 404 | single_leg_romanian_deadlift_dumbbell | Single Leg Romanian Deadlift (Dumbbell) | ديدلفت روماني برجل واحدة بالدمبل | ديدلفت روماني برجل واحدة، رومانيان رجل واحدة | | | |
| 405 | single_leg_romanian_deadlift_kettlebell | Single Leg Romanian Deadlift (Kettlebell) | ديدلفت روماني برجل واحدة بالكيتل بيل | ديدلفت روماني برجل واحدة، رومانيان رجل واحدة | | | |
| 406 | single_leg_romanian_deadlift_barbell | Single Leg Romanian Deadlift (Barbell) | ديدلفت روماني برجل واحدة بالبار | ديدلفت روماني برجل واحدة، رومانيان رجل واحدة | | | |
| 407 | leg_curl_dumbbell | Leg Curl (Dumbbell) | ليج كيرل بالدمبل | ليج كيرل، رجل خلفي دمبل | | | |
| 408 | standing_leg_curl_machine | Standing Leg Curl (Machine) | ليج كيرل واقف ماكينة | ليج كيرل واقف، رجل خلفي واقف | | | |
| 409 | single_leg_curl_machine | Single Leg Curl (Machine) | ليج كيرل برجل واحدة ماكينة | ليج كيرل برجل واحدة، رجل خلفي رجل واحدة | | | |
| 410 | standing_leg_curl_cable | Standing Leg Curl (Cable) | ليج كيرل واقف كابل | ليج كيرل واقف، رجل خلفي كابل | | | |
| 411 | leg_curl_band | Leg Curl (Band) | ليج كيرل بالأستيك | ليج كيرل، رجل خلفي أستيك | | | |
| 412 | nordic_hamstring_curl | Nordic Hamstring Curl | نورديك كيرل | نوردك هامسترنج | | | |
| 413 | glute_ham_raise | Glute Ham Raise | جلوت هام ريز | جي إتش آر | | | |
| 414 | glute_ham_raise_machine | Glute Ham Raise (Machine) | جلوت هام ريز ماكينة | جلوت هام ريز، جي إتش آر | | | |
| 415 | slider_leg_curl | Slider Leg Curl | ليج كيرل بالسلايدر | سلايدر كيرل | | | |
| 416 | stability_ball_leg_curl | Stability Ball Leg Curl | ليج كيرل بالكورة | ليج كيرل سويسري | | | |
| 417 | hamstring_curl_machine | Hamstring Curl (Machine) | رجل خلفي ماكينة | رجل خلفي، هامسترنج ماكينة | | | |
| 418 | good_morning_smith_machine | Good Morning (Smith Machine) | جود مورنينج سميث | جود مورنينج، قود مورنينج سميث | | | |
| 419 | pull_through_cable | Pull Through (Cable) | بول ثرو كابل | بول ثرو، سحب بين الرجلين | | | |
| 420 | stiff_leg_deadlift_smith_machine | Stiff Leg Deadlift (Smith Machine) | ديدلفت بأرجل مفرودة سميث | ديدلفت بأرجل مفرودة، ستيف ليج سميث | | | |
| 421 | kickstand_romanian_deadlift_dumbbell | Kickstand Romanian Deadlift (Dumbbell) | ديدلفت روماني بقدم خلفية بالدمبل | ديدلفت روماني بقدم خلفية، كيك ستاند رومانيان | | | |
| 422 | deadlift_band | Deadlift (Band) | ديدلفت بالأستيك | ديدلفت، ديدلفت أستيك | | | |
| 423 | hip_thrust_dumbbell | Hip Thrust (Dumbbell) | هيب ثراست بالدمبل | هيب ثراست، هيب ثرست | | | |
| 424 | hip_thrust_smith_machine | Hip Thrust (Smith Machine) | هيب ثراست سميث | هيب ثراست، هيب ثرست | | | |
| 425 | hip_thrust_machine | Hip Thrust (Machine) | هيب ثراست ماكينة | هيب ثراست، هيب ثرست | | | |
| 426 | hip_thrust_bodyweight | Hip Thrust (Bodyweight) | هيب ثراست | هيب ثرست | | | |
| 427 | single_leg_hip_thrust | Single Leg Hip Thrust | هيب ثراست برجل واحدة | هيب ثرست رجل واحدة | | | |
| 428 | hip_thrust_band | Hip Thrust (Band) | هيب ثراست بالأستيك | هيب ثراست، هيب ثرست أستيك | | | |
| 429 | glute_bridge | Glute Bridge | جلوت بريدج | كوبري الأرداف | | | |
| 430 | glute_bridge_barbell | Glute Bridge (Barbell) | جلوت بريدج بالبار | جلوت بريدج، كوبري الأرداف | | | |
| 431 | single_leg_glute_bridge | Single Leg Glute Bridge | جلوت بريدج برجل واحدة | كوبري الأرداف رجل واحدة | | | |
| 432 | frog_pump | Frog Pump | فروج بامب | ضفدع | | | |
| 433 | glute_kickback_machine | Glute Kickback (Machine) | ركلة خلفية للأرداف ماكينة | ركلة خلفية للأرداف، جلوت كيك باك | | | |
| 434 | glute_kickback_cable | Glute Kickback (Cable) | ركلة خلفية للأرداف كابل | ركلة خلفية للأرداف، جلوت كيك باك كابل | | | |
| 435 | glute_kickback_band | Glute Kickback (Band) | ركلة خلفية للأرداف بالأستيك | ركلة خلفية للأرداف، جلوت كيك باك أستيك | | | |
| 436 | donkey_kick | Donkey Kick | دونكي كيك | ركلة الحمار | | | |
| 437 | donkey_kick_cable | Donkey Kick (Cable) | دونكي كيك كابل | دونكي كيك، دونكي كيك كابل | | | |
| 438 | fire_hydrant | Fire Hydrant | فاير هيدرنت | فتح الرجل للجنب | | | |
| 439 | fire_hydrant_band | Fire Hydrant (Band) | فاير هيدرنت بالأستيك | فاير هيدرنت، فاير هيدرنت أستيك | | | |
| 440 | cable_hip_extension | Cable Hip Extension | مد الفخذ للخلف كابل كابل | مد الفخذ للخلف كابل، هيب اكستنشن كابل | | | |
| 441 | hip_extension_machine | Hip Extension (Machine) | مد الفخذ للخلف ماكينة | مد الفخذ للخلف، هيب اكستنشن ماكينة | | | |
| 442 | glute_drive_machine | Glute Drive (Machine) | جلوت درايف ماكينة بالأطباق | جلوت درايف، هيب ثراست ماكينة | | | |
| 443 | clamshell | Clamshell | كلام شيل | فتح الرجل | | | |
| 444 | clamshell_band | Clamshell (Band) | كلام شيل بالأستيك | كلام شيل، كلام شيل أستيك | | | |
| 445 | lateral_band_walk | Lateral Band Walk | مشي جانبي بالأستيك بالأستيك | مشي جانبي بالأستيك، ووك جانبي | | | |
| 446 | monster_walk_band | Monster Walk (Band) | مشي مونستر بالأستيك | مشي مونستر، مونستر ووك | | | |
| 447 | cossack_squat | Cossack Squat | سكوات كوساك | كوساك | | | |
| 448 | glute_bridge_band | Glute Bridge (Band) | جلوت بريدج بالأستيك | جلوت بريدج، كوبري الأرداف أستيك | | | |
| 449 | cable_glute_kickback_ankle_strap | Cable Glute Kickback (Ankle Strap) | ركلة خلفية للأرداف بحزام الكاحل كابل | ركلة خلفية للأرداف بحزام الكاحل، كيك باك كابل | | | |
| 450 | standing_calf_raise_smith_machine | Standing Calf Raise (Smith Machine) | سمانة واقف سميث | سمانة واقف، كالف ريز سميث | | | |
| 451 | standing_calf_raise_barbell | Standing Calf Raise (Barbell) | سمانة واقف بالبار | سمانة واقف، كالف ريز بار | | | |
| 452 | standing_calf_raise_dumbbell | Standing Calf Raise (Dumbbell) | سمانة واقف بالدمبل | سمانة واقف، كالف ريز دمبل | | | |
| 453 | single_leg_standing_calf_raise_dumbbell | Single Leg Standing Calf Raise (Dumbbell) | سمانة واقف برجل واحدة بالدمبل | سمانة واقف برجل واحدة، كالف ريز رجل واحدة | | | |
| 454 | standing_calf_raise_bodyweight | Standing Calf Raise (Bodyweight) | سمانة واقف | كالف ريز | | | |
| 455 | seated_calf_raise_plate_loaded | Seated Calf Raise (Plate Loaded) | سمانة جالس ماكينة بالأطباق | سمانة جالس، كالف ريز جالس | | | |
| 456 | calf_extension_machine | Calf Extension (Machine) | سمانة ماكينة ماكينة | سمانة ماكينة، كالف اكستنشن | | | |
| 457 | calf_press_machine | Calf Press (Machine) | سمانة على ماكينة الأرجل ماكينة | سمانة على ماكينة الأرجل، كالف بريس | | | |
| 458 | calf_press_on_leg_press | Calf Press on Leg Press | سمانة على الليج بريس ماكينة | سمانة على الليج بريس، كالف بريس ليج بريس | | | |
| 459 | donkey_calf_raise | Donkey Calf Raise | سمانة دونكي ماكينة | سمانة دونكي، دونكي كالف | | | |
| 460 | donkey_calf_raise_plate_loaded | Donkey Calf Raise (Plate Loaded) | سمانة دونكي ماكينة بالأطباق | سمانة دونكي، دونكي كالف | | | |
| 461 | hip_adductor_machine | Hip Adductor (Machine) | مقرب الفخذ ماكينة | مقرب الفخذ، ادكتور، الفخذ الداخلي | | | |
| 462 | hip_abductor_machine | Hip Abductor (Machine) | مبعد الفخذ ماكينة | مبعد الفخذ، ابدكتور، الفخذ الخارجي | | | |
| 463 | hip_adduction_cable | Hip Adduction (Cable) | تقريب الفخذ كابل | تقريب الفخذ، ادكتور كابل | | | |
| 464 | hip_abduction_cable | Hip Abduction (Cable) | تبعيد الفخذ كابل | تبعيد الفخذ، ابدكتور كابل | | | |
| 465 | hip_adduction_band | Hip Adduction (Band) | تقريب الفخذ بالأستيك | تقريب الفخذ، ادكتور أستيك | | | |
| 466 | hip_abduction_band | Hip Abduction (Band) | تبعيد الفخذ بالأستيك | تبعيد الفخذ، ابدكتور أستيك | | | |
| 467 | side_lying_hip_abduction | Side Lying Hip Abduction | تبعيد الفخذ نائم على الجنب | ابدكتور أرضي | | | |
| 468 | standing_hip_abduction_machine | Standing Hip Abduction (Machine) | تبعيد الفخذ واقف ماكينة | تبعيد الفخذ واقف، ابدكتور واقف | | | |
| 469 | copenhagen_plank | Copenhagen Plank | بلانك كوبنهاجن | كوبنهاجن | | | |
| 470 | adductor_slide | Adductor Slide | تقريب الفخذ بالانزلاق | ادكتور سلايد | | | |
| 471 | hip_flexor_raise_cable | Hip Flexor Raise (Cable) | رفع الركبة كابل كابل | رفع الركبة كابل، هيب فلكسر كابل | | | |
| 472 | standing_knee_raise_cable | Standing Knee Raise (Cable) | رفع الركبة واقف كابل | رفع الركبة واقف، نى ريز كابل | | | |
| 473 | hip_flexion_machine | Hip Flexion (Machine) | ثني الفخذ ماكينة | ثني الفخذ، هيب فلكسر ماكينة | | | |
| 474 | hip_circle_band | Hip Circle (Band) | دوائر الفخذ بالأستيك | دوائر الفخذ، هيب سيركل | | | |
| 475 | lateral_step_up_dumbbell | Lateral Step Up (Dumbbell) | صعود جانبي بالدمبل | صعود جانبي، ستيب أب جانبي | | | |
| 476 | crunch | Crunch | كرنش | بطن، معدة | | | |
| 477 | crunch_machine | Crunch (Machine) | كرنش ماكينة | كرنش، بطن ماكينة، اب كرنش | | | |
| 478 | weighted_crunch | Weighted Crunch | كرنش بوزن ماكينة بالأطباق | كرنش بوزن، بطن بوزن | | | |
| 479 | decline_crunch | Decline Crunch | كرنش على بنش سفلي | كرنش ديكلاين | | | |
| 480 | reverse_crunch | Reverse Crunch | كرنش عكسي | ريفرس كرنش، بطن سفلي | | | |
| 481 | bicycle_crunch | Bicycle Crunch | كرنش دراجة | بايسكل كرنش | | | |
| 482 | sit_up | Sit Up | سيت أب | تمرين البطن | | | |
| 483 | decline_sit_up | Decline Sit Up | سيت أب على بنش سفلي | سيت أب ديكلاين | | | |
| 484 | v_up | V Up | في أب | طي الجسم | | | |
| 485 | hanging_leg_raise | Hanging Leg Raise | رفع الرجلين معلق | هانجينج ليج ريز، بطن سفلي | | | |
| 486 | hanging_knee_raise | Hanging Knee Raise | رفع الركبتين معلق | هانجينج نى ريز، بطن سفلي | | | |
| 487 | toes_to_bar | Toes to Bar | أصابع القدم للعقلة | تو تو بار | | | |
| 488 | captain_s_chair_leg_raise | Captain's Chair Leg Raise | رفع الرجلين على الكرسي | كابتن تشير، بطن سفلي | | | |
| 489 | lying_leg_raise | Lying Leg Raise | رفع الرجلين نائم | ليج ريز، بطن سفلي | | | |
| 490 | leg_raise_parallel_bars | Leg Raise Parallel Bars | رفع الرجلين على البارالل | ليج ريز باراليل | | | |
| 491 | flutter_kicks | Flutter Kicks | رفرفة الرجلين | فلاتر كيكس | | | |
| 492 | heel_touch | Heel Touch | لمس الكعب | هيل تتش | | | |
| 493 | plank | Plank | بلانك | بلانك ثابت | | | |
| 494 | weighted_plank | Weighted Plank | بلانك بوزن ماكينة بالأطباق | بلانك بوزن، بلانك بطبق | | | |
| 495 | side_plank | Side Plank | بلانك جانبي | سايد بلانك | | | |
| 496 | plank_up_down | Plank Up Down | بلانك طالع نازل | بلانك أب داون | | | |
| 497 | body_saw_plank | Body Saw Plank | بلانك منشار | بودي سو | | | |
| 498 | hollow_hold | Hollow Hold | هولو هولد | ثبات الجسم المقوس | | | |
| 499 | dead_bug | Dead Bug | ديد باج | الحشرة الميتة | | | |
| 500 | bird_dog | Bird Dog | بيرد دوج | ذراع ورجل متقابلين | | | |
| 501 | mountain_climber | Mountain Climber | ماونتن كلايمر | تسلق الجبل | | | |
| 502 | ab_wheel | Ab Wheel | عجلة البطن | اب ويل، رول أوت | | | |
| 503 | dragon_flag | Dragon Flag | دراجون فلاج | علم التنين | | | |
| 504 | l_sit_hold | L-Sit Hold | ثبات حرف L | إل سيت | | | |
| 505 | hanging_windshield_wiper | Hanging Windshield Wiper | ممسحة الزجاج معلق | ويند شيلد وايبر | | | |
| 506 | stir_the_pot | Stir the Pot | ستير ذا بوت | تحريك الكورة | | | |
| 507 | ab_crunch_cable | Ab Crunch (Cable) | كرنش كابل كابل | كرنش كابل، بطن كابل | | | |
| 508 | kneeling_cable_crunch | Kneeling Cable Crunch | كرنش كابل على الركبة كابل | كرنش كابل على الركبة، كرنش كابل | | | |
| 509 | standing_cable_crunch | Standing Cable Crunch | كرنش كابل واقف كابل | كرنش كابل واقف، كرنش كابل | | | |
| 510 | ab_crunch_band | Ab Crunch (Band) | كرنش بالأستيك | كرنش، بطن أستيك | | | |
| 511 | pallof_press_cable | Pallof Press (Cable) | بالوف بريس كابل | بالوف بريس، ضغط مقاوم للدوران | | | |
| 512 | pallof_press_band | Pallof Press (Band) | بالوف بريس بالأستيك | بالوف بريس، ضغط مقاوم للدوران | | | |
| 513 | woodchopper_cable | Woodchopper (Cable) | وود تشوبر كابل | وود تشوبر، قطع الخشب | | | |
| 514 | low_to_high_woodchopper_cable | Low to High Woodchopper (Cable) | وود تشوبر من تحت لفوق كابل | وود تشوبر من تحت لفوق، قطع الخشب | | | |
| 515 | cable_twist | Cable Twist | لف الجذع كابل كابل | لف الجذع كابل، تويست كابل | | | |
| 516 | russian_twist_bodyweight | Russian Twist (Bodyweight) | دوران روسي | راشن تويست | | | |
| 517 | russian_twist_weighted | Russian Twist (Weighted) | دوران روسي بوزن ماكينة بالأطباق | دوران روسي بوزن، راشن تويست بطبق | | | |
| 518 | russian_twist_medicine_ball | Russian Twist (Medicine Ball) | دوران روسي بالكورة الطبية ماكينة بالأطباق | دوران روسي بالكورة الطبية، راشن تويست | | | |
| 519 | torso_rotation_machine | Torso Rotation (Machine) | دوران الجذع ماكينة | دوران الجذع، تورسو روتيشن | | | |
| 520 | oblique_crunch | Oblique Crunch | كرنش جانبي | اوبليك كرنش | | | |
| 521 | side_bend_dumbbell | Side Bend (Dumbbell) | ميل جانبي بالدمبل | ميل جانبي، سايد بند دمبل | | | |
| 522 | side_bend_cable | Side Bend (Cable) | ميل جانبي كابل | ميل جانبي، سايد بند كابل | | | |
| 523 | side_bend_barbell | Side Bend (Barbell) | ميل جانبي بالبار | ميل جانبي، سايد بند بار | | | |
| 524 | landmine_twist_barbell | Landmine Twist (Barbell) | لاندماين تويست بالبار | لاندماين تويست، لف الجذع بالبار | | | |
| 525 | roman_chair_side_bend | Roman Chair Side Bend | ميل جانبي على الكرسي الروماني | سايد بند | | | |
| 526 | roman_chair_sit_up | Roman Chair Sit Up | سيت أب على الكرسي الروماني | سيت أب كرسي روماني | | | |
| 527 | suspension_fallout_trx | Suspension Fallout (TRX) | فول أوت (TRX) | فول أوت، فول أوت TRX | | | |
| 528 | suspension_pike_trx | Suspension Pike (TRX) | بايك (TRX) | بايك، بايك TRX | | | |
| 529 | abdominal_crunch_plate_loaded | Abdominal Crunch (Plate Loaded) | كرنش ماكينة بالأطباق ماكينة بالأطباق | كرنش ماكينة بالأطباق، بطن | | | |
| 530 | toe_touch_crunch | Toe Touch Crunch | كرنش لمس القدم | تو تتش | | | |
| 531 | seated_knee_tuck | Seated Knee Tuck | سحب الركبتين للصدر | نى تك | | | |
| 532 | ab_rollout_barbell | Ab Rollout (Barbell) | عجلة البطن بالبار بالبار | عجلة البطن بالبار، رول أوت بار | | | |
| 533 | hanging_pike | Hanging Pike | بايك معلق | هانجينج بايك | | | |
| 534 | jackknife_sit_up | Jackknife Sit Up | سيت أب جاك نايف | جاك نايف | | | |
| 535 | bent_knee_hip_raise | Bent Knee Hip Raise | رفع الحوض بركبة مثنية | هيب ريز بطن سفلي | | | |
| 536 | cross_body_crunch | Cross Body Crunch | كرنش متقاطع | كروس بودي كرنش | | | |
| 537 | plank_shoulder_taps | Plank Shoulder Taps | بلانك لمس الكتف | شولدر تاب | | | |
| 538 | incline_plank | Incline Plank | بلانك مائل | إنكلاين بلانك | | | |
| 539 | kettlebell_swing | Kettlebell Swing | كيتل بيل سوينج | سوينج، أرجحة الكيتل بيل | | | |
| 540 | single_arm_kettlebell_swing | Single Arm Kettlebell Swing | كيتل بيل سوينج بذراع واحدة | سوينج دراع واحدة | | | |
| 541 | american_kettlebell_swing | American Kettlebell Swing | كيتل بيل سوينج أمريكي | سوينج أمريكان | | | |
| 542 | kettlebell_clean | Kettlebell Clean | كيتل بيل كلين | كلين كيتل بيل | | | |
| 543 | kettlebell_snatch | Kettlebell Snatch | كيتل بيل سناتش | سناتش كيتل بيل | | | |
| 544 | kettlebell_clean_and_press | Kettlebell Clean and Press | كيتل بيل كلين وبريس | كلين اند بريس | | | |
| 545 | kettlebell_turkish_get_up | Kettlebell Turkish Get Up | كيتل بيل تيركش جيت أب | تيركش جيت أب | | | |
| 546 | kettlebell_shoulder_press | Kettlebell Shoulder Press | ضغط كتف بالكيتل بيل | ضغط كتف، شولدر بريس كيتل بيل | | | |
| 547 | kettlebell_row | Kettlebell Row | تجديف بالكيتل بيل | تجديف، رو كيتل بيل | | | |
| 548 | kettlebell_high_pull | Kettlebell High Pull | سحب عالي بالكيتل بيل | سحب عالي، هاي بول كيتل بيل | | | |
| 549 | kettlebell_halo | Kettlebell Halo | هيلو بالكيتل بيل | هيلو، هالو كيتل بيل | | | |
| 550 | kettlebell_windmill | Kettlebell Windmill | طاحونة الهواء بالكيتل بيل | طاحونة الهواء، ويندميل كيتل بيل | | | |
| 551 | kettlebell_lunge | Kettlebell Lunge | لانج بالكيتل بيل | لانج، لانجز كيتل بيل | | | |
| 552 | kettlebell_front_squat | Kettlebell Front Squat | سكوات أمامي بالكيتل بيل | سكوات أمامي، فرونت سكوات كيتل بيل | | | |
| 553 | kettlebell_curl | Kettlebell Curl | باي بالكيتل بيل | باي، باي كيتل بيل | | | |
| 554 | kettlebell_overhead_triceps_extension | Kettlebell Overhead Triceps Extension | ترايسبس فوق الراس بالكيتل بيل | ترايسبس فوق الراس، ترايسبس كيتل بيل | | | |
| 555 | kettlebell_farmers_carry | Kettlebell Farmers Carry | مشي المزارع بالكيتل بيل | مشي المزارع، فارمر كاري كيتل بيل | | | |
| 556 | kettlebell_sumo_deadlift_high_pull | Kettlebell Sumo Deadlift High Pull | ديدلفت سومو مع سحب عالي بالكيتل بيل | ديدلفت سومو مع سحب عالي، سومو هاي بول | | | |
| 557 | kettlebell_bottoms_up_press | Kettlebell Bottoms Up Press | ضغط الكيتل بيل مقلوب بالكيتل بيل | ضغط الكيتل بيل مقلوب، بوتمز أب | | | |
| 558 | kettlebell_russian_twist | Kettlebell Russian Twist | دوران روسي بالكيتل بيل | دوران روسي، راشن تويست كيتل بيل | | | |
| 559 | clean_barbell | Clean (Barbell) | كلين بالبار | كلين، هانج كلين | | | |
| 560 | power_clean_barbell | Power Clean (Barbell) | باور كلين بالبار | باور كلين، كلين | | | |
| 561 | hang_clean_barbell | Hang Clean (Barbell) | هانج كلين بالبار | هانج كلين، كلين من الركبة | | | |
| 562 | hang_power_clean_barbell | Hang Power Clean (Barbell) | هانج باور كلين بالبار | هانج باور كلين، باور كلين | | | |
| 563 | clean_and_jerk_barbell | Clean and Jerk (Barbell) | كلين اند جيرك بالبار | كلين اند جيرك، كلين وجيرك | | | |
| 564 | clean_and_press_barbell | Clean and Press (Barbell) | كلين اند بريس بالبار | كلين اند بريس، كلين وبريس | | | |
| 565 | snatch_barbell | Snatch (Barbell) | سناتش بالبار | سناتش، خطف | | | |
| 566 | power_snatch_barbell | Power Snatch (Barbell) | باور سناتش بالبار | باور سناتش، سناتش | | | |
| 567 | hang_snatch_barbell | Hang Snatch (Barbell) | هانج سناتش بالبار | هانج سناتش، سناتش من الركبة | | | |
| 568 | snatch_pull_barbell | Snatch Pull (Barbell) | سناتش بول بالبار | سناتش بول، سحب سناتش | | | |
| 569 | clean_pull_barbell | Clean Pull (Barbell) | كلين بول بالبار | كلين بول، سحب كلين | | | |
| 570 | push_jerk_barbell | Push Jerk (Barbell) | بوش جيرك بالبار | بوش جيرك، جيرك | | | |
| 571 | split_jerk_barbell | Split Jerk (Barbell) | سبليت جيرك بالبار | سبليت جيرك، جيرك | | | |
| 572 | overhead_squat_snatch_barbell | Overhead Squat Snatch (Barbell) | سكوات سناتش بالبار | سكوات سناتش، سناتش سكوات | | | |
| 573 | thruster_barbell | Thruster (Barbell) | ثراستر بالبار | ثراستر، سكوات وضغط | | | |
| 574 | thruster_dumbbell | Thruster (Dumbbell) | ثراستر بالدمبل | ثراستر، سكوات وضغط | | | |
| 575 | thruster_kettlebell | Thruster (Kettlebell) | ثراستر بالكيتل بيل | ثراستر، سكوات وضغط | | | |
| 576 | dumbbell_snatch | Dumbbell Snatch | دمبل سناتش بالدمبل | دمبل سناتش، سناتش دمبل | | | |
| 577 | dumbbell_clean_and_press | Dumbbell Clean and Press | دمبل كلين اند بريس بالدمبل | دمبل كلين اند بريس، كلين وبريس دمبل | | | |
| 578 | dumbbell_clean | Dumbbell Clean | دمبل كلين بالدمبل | دمبل كلين، كلين دمبل | | | |
| 579 | man_maker_dumbbell | Man Maker (Dumbbell) | مان ميكر بالدمبل | مان ميكر، مان ميكر | | | |
| 580 | burpee | Burpee | بيربي | تمرين البيربي | | | |
| 581 | burpee_pull_up | Burpee Pull Up | بيربي وعقلة | بيربي بول أب | | | |
| 582 | bear_crawl | Bear Crawl | زحف الدب | بير كرول | | | |
| 583 | ring_dip | Ring Dip | باراليل على الحلقات (TRX) | باراليل على الحلقات، ديبس حلقات | | | |
| 584 | ring_muscle_up | Ring Muscle Up | ماسل أب على الحلقات (TRX) | ماسل أب على الحلقات، مسل أب حلقات | | | |
| 585 | ring_pull_up | Ring Pull Up | عقلة على الحلقات (TRX) | عقلة على الحلقات، بول أب حلقات | | | |
| 586 | ring_face_pull | Ring Face Pull | سحب للوجه على الحلقات (TRX) | سحب للوجه على الحلقات، فيس بول حلقات | | | |
| 587 | ring_biceps_curl | Ring Biceps Curl | باي على الحلقات (TRX) | باي على الحلقات، كيرل حلقات | | | |
| 588 | ring_triceps_extension | Ring Triceps Extension | ترايسبس على الحلقات (TRX) | ترايسبس على الحلقات، ترايسبس حلقات | | | |
| 589 | front_lever | Front Lever | فرونت ليفر | الرافعة الأمامية | | | |
| 590 | handstand_hold | Handstand Hold | ثبات الوقوف على اليدين | هاند ستاند | | | |
| 591 | farmers_carry_dumbbell | Farmers Carry (Dumbbell) | مشي المزارع بالدمبل | مشي المزارع، فارمر كاري | | | |
| 592 | sandbag_carry | Sandbag Carry | حمل كيس الرمل ماكينة بالأطباق | حمل كيس الرمل، ساند باج | | | |
| 593 | sled_drag_backward | Sled Drag (Backward) | سحب الزحافة للخلف ماكينة بالأطباق | سحب الزحافة للخلف، سليد دراج | | | |
| 594 | landmine_squat_to_press_barbell | Landmine Squat to Press (Barbell) | سكوات وضغط لاندماين بالبار | سكوات وضغط لاندماين، لاندماين ثراستر | | | |
| 595 | landmine_rotation_barbell | Landmine Rotation (Barbell) | دوران لاندماين بالبار | دوران لاندماين، لاندماين روتيشن | | | |
| 596 | battle_rope_slam | Battle Rope Slam | حبال المعركة | باتل روب | | | |
| 597 | medicine_ball_slam | Medicine Ball Slam | ضرب الكورة الطبية ماكينة بالأطباق | ضرب الكورة الطبية، ميديسن بول سلام | | | |
| 598 | wall_ball | Wall Ball | رمي الكورة للحائط ماكينة بالأطباق | رمي الكورة للحائط، وول بول | | | |
| 599 | tire_flip | Tire Flip | قلب الإطار ماكينة بالأطباق | قلب الإطار، تاير فليب | | | |
| 600 | power_jerk_barbell | Power Jerk (Barbell) | باور جيرك بالبار | باور جيرك، جيرك | | | |
| 601 | snatch_balance_barbell | Snatch Balance (Barbell) | سناتش بالانس بالبار | سناتش بالانس، سناتش | | | |
| 602 | devil_press_dumbbell | Devil Press (Dumbbell) | ديفل بريس بالدمبل | ديفل بريس، ديفيل بريس | | | |
| 603 | squat_thrust | Squat Thrust | سكوات ثراست | بيربي بدون ضغط | | | |
| 604 | inchworm | Inchworm | إنش وورم | دودة القياس | | | |
| 605 | rope_climb | Rope Climb | تسلق الحبل | روب كلايمب | | | |
| 606 | sledgehammer_swing | Sledgehammer Swing | ضرب بالمطرقة الثقيلة ماكينة بالأطباق | ضرب بالمطرقة الثقيلة، سليدج هامر | | | |
| 607 | dumbbell_curl_to_press | Dumbbell Curl to Press | باي مع ضغط كتف بالدمبل | باي مع ضغط كتف، كيرل بريس | | | |

## Sign-off
| Reviewer | City / gym | Date | Verdict on the whole sheet |
|----------|------------|------|----------------------------|
| | | | |
| | | | |
