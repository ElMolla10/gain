# Native label regression checks

Dedicated GAIN QA simulator only: iPhone SE (3rd generation), iOS 26.3.1, 375 × 667 points. Native executable from 5558430; Expo production JS bundle from the fix branch on 00b1d6b. No distribution build or upload.

## Reproduction and causes

1. Today → long gym selector: bundled text font renders the weightlifter emoji as missing glyphs. Replace the decorative text with the existing vector dumbbell icon; preserve the full accessible gym label and selector action.
2. Settings → Light; system text → accessibility-large; Cabinet → Strength: two columns force Workhorse into “Workhors” / “e”. Use one column above font scale 1.8, retaining the existing 4/3/2 columns at smaller sizes and native text scaling.

[Gym before](evidence/ios-2026-11-08/gym-icon-before.png), [gym after](evidence/ios-2026-11-08/gym-icon-after.png), [Cabinet before](evidence/ios-2026-11-08/cabinet-large-before.png), [Cabinet after](evidence/ios-2026-11-08/cabinet-large-after.png). All are native simulator captures. The before gym image uses normal text; the after uses accessibility-large.

## Verification

- English and Arabic render regressions fail before the shelf change (2 failed / 22 passed), then pass.
- 36 focused mobile tests pass; workspace typecheck passes.
- Maestro case 72 passes (8 seconds): Today long-gym selector, Cabinet, scroll to Workhorse. Captures visually confirm the icon and unfragmented name. Database remains nine finished sessions / 62 sets, schema 20, no foreign-key errors; the five original manually logged sets are unchanged.
- Physical-device font rendering and spoken VoiceOver output were not tested. Arabic native layout has a separate QA result; Arabic render tests alone do not establish native RTL coverage.
