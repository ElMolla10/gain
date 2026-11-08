# Live Dynamic Type regression

Confirmed on the dedicated iPhoneSE3 simulator, actual iOS26.3.1 (runtime label26.3/build23D8133), Xcode27.0, local native Release1.0.1(1). Native executable5558430; JS before482611c, after482611c plus the AppText patch. These are native simulator captures, not browser/device screenshots.

1. On the disposable QA simulator, rename the active program to `QA Full Body Plan` and open Plan.
2. Use normal system text (`xcrun simctl ui 3AAE743E-D5BC-4AED-92E9-DCED819AA2D5 content_size large`), launch the app, and keep Plan open.
3. Without terminating the app, change to `accessibility-large` using the same command.
4. Before the patch, larger glyphs paint inside stale standard-size line boxes. The title stays34pt high and clips. Restarting the app reflows it, showing that the data and static layout are intact.
5. After the patch, repeat the live change. The title wraps in a146pt-high box without restart; native font scaling remains enabled. Only each AppText native Text child is refreshed, preserving surrounding React state.
6. Parent-state check: type `QA unsaved font size draft` in the program editor at normal size, dismiss the keyboard, change system text size live, and read the TextInput value. DeviceHub/CUA confirms the exact value remains and Back still presents Discardchanges/Keepediting. Discard that QA draft; saved name/version remain unchanged. Maestro completed the preparation interactions, but its JUnit writer failed when the temporary installation disappeared; this supplementary state assertion is not claimed as a complete Maestro process pass.

Recorded native-bounds regression (no device access or mutations):

```sh
# Expected failure: stale34pt line box.
python3 scripts/qa/assert-ios-text-layout.py docs/qa/evidence/ios-2026-11-08/51-live-large-before.json --text 'QA Full Body Plan' --min-height 100 --screen-width 375
# Expected PASS:146pt, within375pt viewport.
python3 scripts/qa/assert-ios-text-layout.py docs/qa/evidence/ios-2026-11-08/53-live-large-after.json --text 'QA Full Body Plan' --min-height 100 --screen-width 375
```

The100pt threshold belongs to this known fixture at this text category, not product styling. The script checks actual native geometry rather than equating a successful tap with a usable layout. Before/after PNGs accompany the JSON files.75 focused source tests and workspace typechecks passed. Broader Arabic, keyboard and screen variations have separate QA statuses; no physical VoiceOver or iPhone claim is made.
