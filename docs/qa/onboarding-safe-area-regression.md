# Standalone onboarding top safe area

Native iPhone 17 simulator, iOS 26.3.1 (23D8133), 402 × 874 points, dedicated UUID `211D7C57-B389-48BD-8350-5A2A8B73C892`. Native executable 5558430; JavaScript fix on ce53f28 embedded with Expo. No distribution build/upload or physical-device testing.

Fresh app → Welcome: the first step label started at y=27, overlapping the status bar / Dynamic Island area. The first-run Shell has no navigation header, while OnboardingScreen assumes a header owns the top inset. The existing SafeAreaProvider already supplies the inset; apply it only to the standalone first-run container. Settings → Run setup again retains its native-header inset handling. Bottom padding and workout behavior are unchanged.

[Before](evidence/ios-2026-11-08/83-onboarding-safe-area-before.png), [after](evidence/ios-2026-11-08/84-onboarding-safe-area-after.png). The native label now begins at y=89, below the 62-point top safe area. Captures are native simulator renders.

Regression command (run on each captured JSON; before must fail, after must pass):

```sh
python3 scripts/qa/assert-ios-text-layout.py docs/qa/evidence/ios-2026-11-08/84-onboarding-safe-area.json --text "$(python3 -c 'import json; print(json.load(open("docs/qa/evidence/ios-2026-11-08/84-onboarding-safe-area.json"))["nodes"][0]["attributes"]["accessibilityText"])')" --min-height 1 --screen-width 402 --min-top 62
```

The JSON files are native hierarchy excerpts with hashes of the original complete captures. Before: bounds [16,27,104,45], fails min-top=62. After: [16,89,104,107], passes. Existing onboarding/save/layout tests: 38 pass; workspace typecheck passes. Maestro 83 also verifies Back through the incomplete six-step flow to Welcome (18s). Full fresh onboarding is tracked separately in the execution record; an earlier selector failure is not a successful setup result.
